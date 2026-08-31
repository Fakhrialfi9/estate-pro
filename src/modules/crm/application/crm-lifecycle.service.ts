import { BadRequestException, Injectable } from '@nestjs/common';
import type { CrmActor, PageQuery } from '../domain/crm.types.js';
import { CrmService } from './crm.service.js';
@Injectable()
export class CrmLifecycleService {
  constructor(private readonly crm: CrmService) {}
  private async status(uuid: string, code: string, actor: CrmActor) {
    const result = await this.crm.configList('status', { page: 1, limit: 100 });
    const item = result.items.find(
      (x) => String((x as Record<string, unknown>).code) === code,
    );
    if (!item)
      throw new BadRequestException(`CRM status ${code} is not configured`);
    return this.crm.changeStatus(
      uuid,
      String((item as Record<string, unknown>).uuid),
      actor,
    );
  }
  async qualify(uuid: string, a: CrmActor) {
    return this.status(uuid, 'QUALIFIED', a);
  }
  async nurture(uuid: string, a: CrmActor) {
    return this.status(uuid, 'NURTURING', a);
  }
  async reactivate(uuid: string, a: CrmActor) {
    return this.status(uuid, 'CONTACTED', a);
  }
  async close(uuid: string, reason: string | undefined, a: CrmActor) {
    const result = await this.status(uuid, 'CLOSED_LOST', a);
    if (reason?.trim())
      await this.crm.note(uuid, `Closure reason: ${reason.trim()}`, a);
    return result;
  }
  async timeline(uuid: string, q: PageQuery) {
    const [lead, activities, inquiries, communications] = await Promise.all([
      this.crm.getLead(uuid),
      this.crm.activityList({ ...q, leadUuid: uuid }),
      this.crm.inquiryList({ ...q, leadUuid: uuid }),
      this.crm.communicationList({ ...q, leadUuid: uuid }),
    ]);
    const l = lead as Record<string, unknown>;
    const history = Array.isArray(l.history) ? l.history : [];
    const events = [
      ...history.map((x) => ({ ...x, source: 'LEAD_HISTORY' })),
      ...activities.items.map((x) => ({
        ...(x as Record<string, unknown>),
        source: 'ACTIVITY',
      })),
      ...inquiries.items.map((x) => ({
        ...(x as Record<string, unknown>),
        source: 'INQUIRY',
      })),
      ...communications.items.map((x) => ({
        ...(x as Record<string, unknown>),
        source: 'COMMUNICATION',
      })),
    ].sort((a, b) =>
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')),
    );
    return {
      items: events,
      total: events.length,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    };
  }
  async conversionPlan(uuid: string) {
    const lead = (await this.crm.getLead(uuid)) as Record<string, unknown>;
    const status = (lead.status as Record<string, unknown> | undefined)?.code;
    if (status !== 'QUALIFIED')
      throw new BadRequestException('Lead must be QUALIFIED before conversion');
    return {
      leadUuid: uuid,
      nextDomain: 'sales',
      action: 'CREATE_SALES_RECORD',
      idempotencyKey: `lead:${uuid}:conversion`,
      note: 'CRM coordinates conversion; Sales remains the owner of the next-domain record.',
    };
  }
  async nurtureWorkflow(uuid: string, a: CrmActor) {
    const lead = await this.nurture(uuid, a);
    const activity = await this.crm.activityCreate(
      {
        type: 'FOLLOW_UP',
        subject: 'Lead nurturing follow-up',
        leadUuid: uuid,
      },
      a,
    );
    return { lead, activity };
  }
}
