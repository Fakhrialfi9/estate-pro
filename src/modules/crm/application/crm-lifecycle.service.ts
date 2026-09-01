import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { CrmActor, PageQuery } from '../domain/crm.types.js';
import { CrmService } from './crm.service.js';
import { PrismaCrmLifecycleRepository } from '../infrastructure/persistence/prisma-crm-lifecycle.repository.js';
import { LeadLifecyclePolicy } from '../domain/lead-lifecycle.policy.js';
import { QualificationPolicy } from '../domain/qualification.policy.js';
import { ClosurePolicy, type ClosureOutcome } from '../domain/closure.policy.js';
import { SALES_CONVERSION_PORT } from '../../../common/contracts/sales-conversion.port.js';
import type { SalesConversionPort } from '../../../common/contracts/sales-conversion.port.js';

interface ActorWithPermissions extends CrmActor {
  readonly permissions?: readonly string[];
}

@Injectable()
export class CrmLifecycleService {
  constructor(
    private readonly crm: CrmService,
    private readonly repo: PrismaCrmLifecycleRepository,
    private readonly lifecycle: LeadLifecyclePolicy,
    private readonly qualification: QualificationPolicy,
    private readonly closure: ClosurePolicy,
    @Inject(SALES_CONVERSION_PORT)
    private readonly sales: SalesConversionPort,
    private readonly logger: PinoLogger,
  ) {}

  private async scopedLead(uuid: string, actor: ActorWithPermissions) {
    const permissions = new Set(actor.permissions ?? []);
    const globalAccess =
      permissions.has('crm.manage') || permissions.has('crm.leads.manage');
    const lead = await this.repo.getScopedLead(
      uuid,
      actor.actorUuid,
      globalAccess,
    );
    if (!lead.accessible) {
      throw new ForbiddenException('CRM lead is outside your permitted scope');
    }
    return lead;
  }

  async qualify(uuid: string, reason: string, actor: ActorWithPermissions) {
    const lead = await this.scopedLead(uuid, actor);
    this.lifecycle.assertCan('QUALIFY', lead.statusCode);
    const scored = (await this.crm.score(uuid)) as { score?: number };
    const decision = this.qualification.evaluate(
      Number(scored.score ?? 0),
      reason,
    );
    if (!decision.qualified) {
      throw new BadRequestException(
        'Lead does not satisfy qualification criteria',
      );
    }
    const result = await this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: 'QUALIFIED',
      qualificationReason: decision.reason,
      actor,
    });
    this.logger.info(
      {
        actionId: 'crm.lead.qualify',
        resourceType: 'lead',
        resourceUuid: uuid,
        actorUuid: actor.actorUuid,
      },
      'CRM lead qualified',
    );
    return result;
  }

  async nurture(uuid: string, actor: ActorWithPermissions) {
    const lead = await this.scopedLead(uuid, actor);
    this.lifecycle.assertCan('NURTURE', lead.statusCode);
    return this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: 'NURTURING',
      actor,
    });
  }

  async nurtureWorkflow(uuid: string, actor: ActorWithPermissions) {
    const lead = await this.nurture(uuid, actor);
    const activity = await this.crm.activityCreate(
      {
        type: 'FOLLOW_UP',
        subject: 'Lead nurturing follow-up',
        leadUuid: uuid,
      },
      actor,
    );
    return { lead, activity };
  }

  async reactivate(uuid: string, actor: ActorWithPermissions) {
    const lead = await this.scopedLead(uuid, actor);
    this.lifecycle.assertCan('REACTIVATE', lead.statusCode);
    return this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: 'CONTACTED',
      actor,
    });
  }

  async close(
    uuid: string,
    reason: string,
    outcome: ClosureOutcome,
    actor: ActorWithPermissions,
  ) {
    const lead = await this.scopedLead(uuid, actor);
    this.lifecycle.assertCan('CLOSE', lead.statusCode);
    const decision = this.closure.decide(reason, outcome);
    return this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: decision.outcome === 'WON' ? 'CLOSED_WON' : 'CLOSED_LOST',
      closureReason: decision.reason,
      closureOutcome: decision.outcome,
      actor,
    });
  }

  async convert(
    uuid: string,
    actor: ActorWithPermissions,
    idempotencyKey?: string,
  ) {
    const lead = await this.scopedLead(uuid, actor);
    if (lead.statusCode !== 'QUALIFIED') {
      throw new BadRequestException(
        'Lead must be QUALIFIED before conversion',
      );
    }
    const key = idempotencyKey?.trim() || `lead:${uuid}:conversion`;
    const result = await this.sales.createFromQualifiedLead({
      leadUuid: uuid,
      contactUuid: lead.contactUuid,
      ownerUserUuid: lead.ownerUserUuid,
      idempotencyKey: key,
    });
    await this.repo.markConverted(uuid, key);
    this.logger.info(
      {
        actionId: 'crm.lead.convert',
        resourceType: 'lead',
        resourceUuid: uuid,
        opportunityUuid: result.opportunityUuid,
        actorUuid: actor.actorUuid,
      },
      'CRM lead converted',
    );
    return {
      leadUuid: uuid,
      opportunityUuid: result.opportunityUuid,
      created: result.created,
    };
  }

  async merge(
    sourceUuid: string,
    targetUuid: string,
    actor: ActorWithPermissions,
  ) {
    await this.scopedLead(sourceUuid, actor);
    await this.scopedLead(targetUuid, actor);
    return this.crm.merge(sourceUuid, targetUuid, actor);
  }

  async timeline(
    uuid: string,
    query: PageQuery,
    actor: ActorWithPermissions,
  ) {
    await this.scopedLead(uuid, actor);
    const [lead, history, activities, inquiries, communications] =
      await Promise.all([
        this.crm.getLead(uuid),
        this.crm.history(uuid, query),
        this.crm.activityList({ ...query, leadUuid: uuid }),
        this.crm.inquiryList({ ...query, leadUuid: uuid }),
        this.crm.communicationList({ ...query, leadUuid: uuid }),
      ]);

    const events: Array<Record<string, unknown>> = [];
    const append = (source: string, items: readonly unknown[]) => {
      for (const item of items) {
        if (item && typeof item === 'object') {
          events.push({ ...(item as Record<string, unknown>), source });
        }
      }
    };

    append('LEAD_HISTORY', history.items);
    append('ACTIVITY', activities.items);
    append('INQUIRY', inquiries.items);
    append('COMMUNICATION', communications.items);
    if (lead && typeof lead === 'object') {
      events.push({ ...(lead as Record<string, unknown>), source: 'LEAD' });
    }

    events.sort((a, b) => {
      const left = new Date(String(a.createdAt ?? '')).getTime();
      const right = new Date(String(b.createdAt ?? '')).getTime();
      return left - right;
    });

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const start = (page - 1) * limit;
    return {
      items: events.slice(start, start + limit),
      total: events.length,
      page,
      limit,
    };
  }
}
