import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { AutomationRepository } from '../../domain/automation.ports.js';

const clean = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      typeof entry === 'bigint' ? entry.toString() : entry,
    ]),
  );
};

@Injectable()
export class PrismaAutomationRepository implements AutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkflow(input: {
    uuid: string;
    name: string;
    description?: string | null;
    ownerUserUuid: string;
    createdBy: string;
    updatedBy: string;
  }) {
    return clean(await this.prisma.automationWorkflow.create({ data: input }));
  }

  async updateWorkflow(uuid: string, input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationWorkflow.update({
        where: { uuid },
        data: input,
      }),
    );
  }

  async getWorkflow(uuid: string) {
    const result = await this.prisma.automationWorkflow.findUnique({
      where: { uuid },
      include: { versions: true },
    });
    return result ? clean(result) : null;
  }

  async listWorkflows(input: Record<string, unknown>) {
    const page = Math.max(1, Number(input.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit ?? 20)));
    const where: Record<string, unknown> = {};
    if (typeof input.status === 'string') where.status = input.status;
    if (typeof input.ownerUserUuid === 'string')
      where.ownerUserUuid = input.ownerUserUuid;
    const [items, total] = await Promise.all([
      this.prisma.automationWorkflow.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.automationWorkflow.count({ where }),
    ]);
    return { items: items.map(clean), total, page, limit };
  }

  async createVersion(input: {
    uuid: string;
    workflowUuid: string;
    version: number;
    status: string;
    triggerDefinition: unknown;
    definition: unknown;
    checksum: string;
    createdBy: string;
    activatedAt?: Date | null;
  }) {
    return clean(
      await this.prisma.automationWorkflowVersion.create({
        data: input as never,
      }),
    );
  }

  async getVersion(uuid: string) {
    const result = await this.prisma.automationWorkflowVersion.findUnique({
      where: { uuid },
      include: { workflow: true },
    });
    return result ? clean(result) : null;
  }

  async listActiveVersions() {
    const rows = await this.prisma.automationWorkflowVersion.findMany({
      where: { status: 'ACTIVE', workflow: { status: 'ACTIVE' } },
    });
    return rows.map(clean);
  }

  async updateVersion(uuid: string, input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationWorkflowVersion.update({
        where: { uuid },
        data: input as never,
      }),
    );
  }

  async createExecution(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationWorkflowExecution.create({
        data: input as never,
      }),
    );
  }

  async getExecution(uuid: string) {
    const result = await this.prisma.automationWorkflowExecution.findUnique({
      where: { uuid },
      include: { actions: true, version: true },
    });
    return result ? clean(result) : null;
  }

  async listExecutions(input: Record<string, unknown>) {
    const page = Math.max(1, Number(input.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit ?? 20)));
    const where: Record<string, unknown> = {};
    for (const key of [
      'state',
      'workflowUuid',
      'eventType',
      'entityType',
      'entityUuid',
    ])
      if (typeof input[key] === 'string') where[key] = input[key];
    if (typeof input.ownerUserUuid === 'string')
      where.workflow = { ownerUserUuid: input.ownerUserUuid };
    const [items, total] = await Promise.all([
      this.prisma.automationWorkflowExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.automationWorkflowExecution.count({ where }),
    ]);
    return { items: items.map(clean), total, page, limit };
  }

  async updateExecution(uuid: string, input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationWorkflowExecution.update({
        where: { uuid },
        data: input as never,
      }),
    );
  }

  async createAction(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationActionExecution.create({
        data: input as never,
      }),
    );
  }

  async getAction(uuid: string) {
    const result = await this.prisma.automationActionExecution.findUnique({
      where: { uuid },
    });
    return result ? clean(result) : null;
  }

  async listActions(executionUuid: string) {
    const rows = await this.prisma.automationActionExecution.findMany({
      where: { executionUuid },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(clean);
  }

  async updateAction(uuid: string, input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationActionExecution.update({
        where: { uuid },
        data: input as never,
      }),
    );
  }

  async claimDueExecution(workerId: string, leaseMs: number) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const candidate = await this.prisma.automationWorkflowExecution.findFirst({
      where: {
        state: { in: ['PENDING', 'WAITING'] },
        OR: [{ retryAt: null }, { retryAt: { lte: now } }],
        AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.automationWorkflowExecution.updateMany({
      where: {
        uuid: candidate.uuid,
        state: candidate.state,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseUntil,
        claimedBy: workerId,
        state: 'RUNNING',
        startedAt: candidate.startedAt ?? now,
      },
    });
    if (claimed.count !== 1) return null;
    const result = await this.prisma.automationWorkflowExecution.findUnique({
      where: { uuid: candidate.uuid },
    });
    return result ? clean(result) : null;
  }

  async claimDueAction(workerId: string, leaseMs: number) {
    const now = new Date();
    const candidate = await this.prisma.automationActionExecution.findFirst({
      where: {
        state: { in: ['PENDING', 'RETRYABLE'] },
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
        AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.automationActionExecution.updateMany({
      where: {
        uuid: candidate.uuid,
        state: candidate.state,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseUntil: new Date(now.getTime() + leaseMs),
        claimedBy: workerId,
        state: 'RUNNING',
        startedAt: candidate.startedAt ?? now,
        attempt: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    const result = await this.prisma.automationActionExecution.findUnique({
      where: { uuid: candidate.uuid },
    });
    return result ? clean(result) : null;
  }

  async reclaimExpired(workerId: string, now: Date) {
    const result = await this.prisma.automationWorkflowExecution.updateMany({
      where: { state: 'RUNNING', leaseUntil: { lt: now } },
      data: { state: 'WAITING', leaseUntil: null, claimedBy: workerId },
    });
    await this.prisma.automationActionExecution.updateMany({
      where: { state: 'RUNNING', leaseUntil: { lt: now } },
      data: { state: 'RETRYABLE', leaseUntil: null, claimedBy: workerId },
    });
    return result.count;
  }

  async countRecentActionExecutions(
    workflowUuid: string,
    entityUuid: string,
    since: Date,
  ) {
    return this.prisma.automationWorkflowExecution.count({
      where: { workflowUuid, entityUuid, createdAt: { gte: since } },
    });
  }

  async createAssignmentRule(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationAssignmentRule.create({
        data: input as never,
      }),
    );
  }

  async createSlaPolicy(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationSlaPolicy.create({ data: input as never }),
    );
  }

  async createSlaInstance(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationSlaInstance.create({ data: input as never }),
    );
  }

  async claimDueSla(workerId: string, leaseMs: number) {
    const now = new Date();
    const candidate = await this.prisma.automationSlaInstance.findFirst({
      where: {
        state: 'RUNNING',
        deadlineAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { deadlineAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.automationSlaInstance.updateMany({
      where: {
        uuid: candidate.uuid,
        state: 'RUNNING',
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseUntil: new Date(now.getTime() + leaseMs),
        claimedBy: workerId,
        state: 'BREACHED',
        breachedAt: now,
      },
    });
    if (claimed.count !== 1) return null;
    return clean(
      await this.prisma.automationSlaInstance.findUnique({
        where: { uuid: candidate.uuid },
      }),
    );
  }

  async updateSlaInstance(uuid: string, input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationSlaInstance.update({
        where: { uuid },
        data: input as never,
      }),
    );
  }

  async createEscalationPolicy(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationEscalationPolicy.create({
        data: input as never,
      }),
    );
  }

  async getEscalationPolicy(uuid: string) {
    const row = await this.prisma.automationEscalationPolicy.findUnique({
      where: { uuid },
    });
    return row ? clean(row) : null;
  }

  async createNotification(input: Record<string, unknown>) {
    return clean(
      await this.prisma.automationNotification.create({ data: input as never }),
    );
  }
}
