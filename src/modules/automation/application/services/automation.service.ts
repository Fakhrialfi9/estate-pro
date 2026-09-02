import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ACTION_TYPES,
  TRIGGER_TYPES,
  decideRetry,
  parseDefinition,
  type ActionNode,
  type ConditionNode,
  type WorkflowDefinition,
} from '../../domain/automation.types.js';
import type {
  AutomationEvent,
  AutomationRepository,
  ActionHandler,
} from '../../domain/automation.ports.js';
import {
  CRM_AUTOMATION_PORT,
  type AutomationCrmPort,
} from '../../../../common/contracts/automation-crm.port.js';
import {
  SALES_AUTOMATION_PORT,
  type AutomationSalesPort,
} from '../../../../common/contracts/automation-sales.port.js';
import {
  USER_PUBLIC_PORT,
  type UserPublicPort,
} from '../../../../common/contracts/user-public.port.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import { AUTOMATION_REPOSITORY } from '../../infrastructure/persistence/automation.repository.token.js';
import { WorkflowValidator } from '../validation/workflow-validator.js';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const unknownArray = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const recordArray = (value: unknown): readonly Record<string, unknown>[] =>
  unknownArray(value).filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );

const stringArray = (value: unknown): readonly string[] =>
  unknownArray(value).filter(
    (item): item is string => typeof item === 'string',
  );

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  return fallback;
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toDateValue = (value: unknown, field: string): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value;
    throw new BadRequestException(`Invalid ${field}`);
  }
  if (typeof value !== 'string')
    throw new BadRequestException(`Invalid ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`Invalid ${field}`);
  return date;
};

const safeJson = (value: unknown): Record<string, unknown> => {
  const text = JSON.stringify(value, (key, entry) =>
    /token|secret|password|credential/i.test(key) ? '[REDACTED]' : entry,
  );
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return record(parsed);
  } catch {
    return {};
  }
};

const isTriggerType = (
  value: unknown,
): value is (typeof TRIGGER_TYPES)[number] => {
  if (typeof value !== 'string') return false;
  return TRIGGER_TYPES.some((item) => item === value);
};

@Injectable()
export class AutomationService {
  constructor(
    @Inject(AUTOMATION_REPOSITORY) private readonly repo: AutomationRepository,
    @Inject(CRM_AUTOMATION_PORT) private readonly crm: AutomationCrmPort,
    @Inject(SALES_AUTOMATION_PORT) private readonly sales: AutomationSalesPort,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    private readonly validator: WorkflowValidator,
    private readonly handlers: readonly ActionHandler[],
  ) {}

  async createWorkflow(
    input: { name: string; description?: string; ownerUserUuid: string },
    actorUuid: string,
  ): Promise<Record<string, unknown>> {
    if (!input.name?.trim())
      throw new BadRequestException('Workflow name is required');
    const owner = await this.users.getUser(input.ownerUserUuid);
    if (!owner.isActive || owner.deletedAt)
      throw new ForbiddenException('Workflow owner is not active');
    if (owner.uuid !== actorUuid)
      throw new ForbiddenException('Workflow owner is outside your scope');
    const workflow = await this.repo.createWorkflow({
      uuid: randomUUID(),
      name: input.name.trim().slice(0, 180),
      description: input.description?.trim() ?? null,
      ownerUserUuid: owner.uuid,
      createdBy: actorUuid,
      updatedBy: actorUuid,
    });
    await this.auditRecord(
      'AUTOMATION_WORKFLOW_CREATED',
      'automation_workflow',
      toStringValue(workflow.uuid),
      actorUuid,
    );
    return workflow;
  }
