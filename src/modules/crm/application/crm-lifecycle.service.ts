import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';
import { SALES_CONVERSION_PORT } from '../../../common/contracts/sales-conversion.port.js';
import type { SalesConversionPort } from '../../../common/contracts/sales-conversion.port.js';
import type { CrmActor, PageQuery } from '../domain/crm.types.js';
import { CrmService } from './crm.service.js';
import { PrismaCrmLifecycleRepository } from '../infrastructure/persistence/prisma-crm-lifecycle.repository.js';
import { LeadLifecyclePolicy } from '../domain/lead-lifecycle.policy.js';
import { QualificationPolicy } from '../domain/qualification.policy.js';
import { ClosurePolicy, type ClosureOutcome } from '../domain/closure.policy.js';

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
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
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

  private async auditLifecycle(
    action: string,
    uuid: string,
    actor: ActorWithPermissions,
    reason?: string,
  ): Promise<void> {
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      userUuid: actor.actorUuid,
      actorType: 'AUTHENTICATED',
      entityType: 'lead',
      entityUuid: uuid,
      requestId: actor.requestId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      result: 'SUCCESS',
      ...(reason ? { reason } : {}),
    });
  }

  private logLifecycle(
    action: string,
    uuid: string,
    actor: ActorWithPermissions,
    extra: Record<string, unknown> = {},
  ): void {
    this.logger.info(
      {
        actionId: action,
        resourceType: 'lead',
        resourceUuid: uuid,
        actorUuid: actor.actorUuid,
        requestId: actor.requestId,
        ...extra,
      },
      `CRM ${action}`,
    );
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
    await this.auditLifecycle(
      AUDIT_ACTIONS.CRM_LEAD_QUALIFIED,
      uuid,
      actor,
      decision.reason,
    );
    this.logLifecycle('crm.lead.qualify', uuid, actor);
    return result;
  }

  async nurture(uuid: string, actor: ActorWithPermissions) {
    const lead = await this.scopedLead(uuid, actor);
    this.lifecycle.assertCan('NURTURE', lead.statusCode);
    const result = await this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: 'NURTURING',
      actor,
    });
    await this.auditLifecycle(AUDIT_ACTIONS.CRM_LEAD_NURTURED, uuid, actor);
    this.logLifecycle('crm.lead.nurture', uuid, actor);
    return result;
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
    const result = await this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: 'CONTACTED',
      actor,
    });
    await this.auditLifecycle(
      AUDIT_ACTIONS.CRM_LEAD_REACTIVATED,
      uuid,
      actor,
    );
    this.logLifecycle('crm.lead.reactivate', uuid, actor);
    return result;
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
    const result = await this.repo.setLifecycle({
      leadUuid: uuid,
      toStatus: decision.outcome === 'WON' ? 'CLOSED_WON' : 'CLOSED_LOST',
      closureReason: decision.reason,
      closureOutcome: decision.outcome,
      actor,
    });
    await this.auditLifecycle(
      AUDIT_ACTIONS.CRM_LEAD_CLOSED,
      uuid,
      actor,
      `${decision.outcome}: ${decision.reason}`,
    );
    this.logLifecycle('crm.lead.close', uuid, actor, {
      outcome: decision.outcome,
    });
    return result;
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
    await this.auditLifecycle(
      AUDIT_ACTIONS.CRM_LEAD_CONVERTED,
      uuid,
      actor,
    );
    this.logLifecycle('crm.lead.convert', uuid, actor, {
      opportunityUuid: result.opportunityUuid,
      created: result.created,
    });
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
    const result = await this.crm.merge(sourceUuid, targetUuid, actor);
    await this.auditLifecycle(
      AUDIT_ACTIONS.CRM_LEAD_MERGED,
      sourceUuid,
      actor,
      `merged into ${targetUuid}`,
    );
    this.logLifecycle('crm.lead.merge', sourceUuid, actor, {
      targetUuid,
    });
    return result;
  }

  async timeline(
    uuid: string,
    query: PageQuery,
    actor: ActorWithPermissions,
  ) {
    await this.scopedLead(uuid, actor);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const fetchLimit = Math.min(500, page * limit);
    const sourceQuery = { ...query, page: 1, limit: fetchLimit };

    const [lead, history, activities, inquiries, communications] =
      await Promise.all([
        this.crm.getLead(uuid),
        this.crm.history(uuid, sourceQuery),
        this.crm.activityList({ ...sourceQuery, leadUuid: uuid }),
        this.crm.inquiryList({ ...sourceQuery, leadUuid: uuid }),
        this.crm.communicationList({ ...sourceQuery, leadUuid: uuid }),
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
      if (left !== right) return right - left;
      return String(a.source ?? '').localeCompare(String(b.source ?? ''));
    });

    const start = (page - 1) * limit;
    const total =
      1 + history.total + activities.total + inquiries.total + communications.total;
    return {
      items: events.slice(start, start + limit),
      total,
      page,
      limit,
    };
  }
}
