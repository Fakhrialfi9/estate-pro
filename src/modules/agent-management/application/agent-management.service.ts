import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthorizationService } from '../../../common/security/authorization.service.js';
import {
  USER_PUBLIC_PORT,
  type UserPublicPort,
} from '../../../common/contracts/user-public.port.js';
import {
  SECURITY_AUDIT_REPOSITORY,
  type SecurityAuditRepository,
} from '../../../common/audit/security-audit.port.js';
import {
  PROPERTY_AGENT_ASSIGNMENT_PORT,
  type PropertyAgentAssignmentPort,
} from '../../../common/contracts/property-agent-assignment.port.js';
import {
  PROPERTY_AGENT_CONTEXT_PORT,
  type PropertyAgentContextPort,
} from '../../../common/contracts/property-agent-context.port.js';
import {
  PROPERTY_REGION_PORT,
  type PropertyRegionPort,
} from '../../../common/contracts/property-region.port.js';
import {
  CRM_AGENT_WORKLOAD_PORT,
  type CrmAgentWorkloadPort,
} from '../../../common/contracts/crm-agent-workload.port.js';
import {
  SALES_AGENT_WORKLOAD_PORT,
  type SalesAgentWorkloadPort,
} from '../../../common/contracts/sales-agent-workload.port.js';
import {
  isAgentAssignable,
  isUserEligibleForAgent,
} from '../domain/agent-eligibility.policy.js';
import { PrismaAgentRepository } from '../infrastructure/persistence/prisma-agent.repository.js';
import {
  AgentCreateDto,
  AgentUpdateDto,
  AvailabilityUpdateDto,
  CoverageCreateDto,
  SpecializationCreateDto,
  TargetCreateDto,
  TargetUpdateDto,
} from './agent-management.dto.js';

const AUDIT = {
  CREATED: 'AGENT_CREATED',
  UPDATED: 'AGENT_UPDATED',
  ARCHIVED: 'AGENT_ARCHIVED',
  SPECIALIZATION_CHANGED: 'AGENT_SPECIALIZATION_CHANGED',
  COVERAGE_CHANGED: 'AGENT_COVERAGE_CHANGED',
  AVAILABILITY_CHANGED: 'AGENT_AVAILABILITY_CHANGED',
  CAPACITY_CHANGED: 'AGENT_CAPACITY_CHANGED',
  ASSIGNED: 'AGENT_ASSIGNMENT_CREATED',
  REASSIGNED: 'AGENT_ASSIGNMENT_REASSIGNED',
  UNASSIGNED: 'AGENT_ASSIGNMENT_REVOKED',
  TARGET_CHANGED: 'AGENT_TARGET_CHANGED',
} as const;
type Actor = {
  uuid: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};
type AgentRecord = Awaited<
  ReturnType<PrismaAgentRepository['createProfile']>
>;
type AgentProfileDetails = NonNullable<
  Awaited<ReturnType<PrismaAgentRepository['findProfile']>>
>;
type AgentTarget = Awaited<
  ReturnType<PrismaAgentRepository['listTargets']>
>[number];
type AgentAuthorizationSnapshot = Awaited<
  ReturnType<AuthorizationService['resolve']>
>;

type AgentProfileStatus = AgentRecord['status'];

@Injectable()
export class AgentManagementService {
  constructor(
    private readonly repo: PrismaAgentRepository,
    private readonly authorization: AuthorizationService,
    @Inject(USER_PUBLIC_PORT) private readonly users: UserPublicPort,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
    @Inject(PROPERTY_AGENT_ASSIGNMENT_PORT)
    private readonly propertyAssignments: PropertyAgentAssignmentPort,
    @Inject(PROPERTY_AGENT_CONTEXT_PORT)
    private readonly propertyContext: PropertyAgentContextPort,
    @Inject(PROPERTY_REGION_PORT)
    private readonly propertyRegions: PropertyRegionPort,
    @Inject(CRM_AGENT_WORKLOAD_PORT)
    private readonly crmWorkload: CrmAgentWorkloadPort,
    @Inject(SALES_AGENT_WORKLOAD_PORT)
    private readonly salesWorkload: SalesAgentWorkloadPort,
  ) {}

  async create(input: AgentCreateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.manage');
    const user = await this.users.getUser(input.userUuid).catch(() => null);
    const auth = await this.authorization
      .resolve(input.userUuid)
      .catch(() => null);
    if (
      !isUserEligibleForAgent({
        user,
        hasAgentAccess: Boolean(
          auth && this.hasPermission(auth, 'agents.access'),
        ),
      })
    )
      throw new ForbiddenException('User is not eligible to become an agent');
    if (await this.repo.findProfileByUserUuid(input.userUuid))
      throw new ConflictException('User already has an agent profile');
    const result = await this.repo.createProfile({
      uuid: randomUUID(),
      userUuid: input.userUuid,
      displayName: input.displayName ?? null,
      bio: input.bio ?? null,
      status: 'ACTIVE',
      hireDate: input.hireDate ?? null,
      licenseNumberMasked: input.licenseNumberMasked ?? null,
      timeZone: input.timeZone ?? 'UTC',
      maxActiveAssignments: input.maxActiveAssignments ?? 10,
    });
    await this.record(actor, AUDIT.CREATED, result.uuid, {
      userUuid: input.userUuid,
    });
    return this.serialize(result);
  }

  async get(uuid: string, actor: Actor) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return this.serialize(agent);
  }

  async list(
    query: {
      limit?: number;
      cursor?: string;
      status?: AgentProfileStatus;
      specializationUuid?: string;
      regionUuid?: string;
    },
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.read');
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const rows = await this.repo.listProfiles({
      limit,
      cursor: query.cursor,
      status: query.status,
      specializationUuid: query.specializationUuid,
      regionUuids: query.regionUuid ? [query.regionUuid] : undefined,
    });
    return {
      items: rows.map((x) => this.serialize(x)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.uuid ?? null) : null,
    };
  }

  async update(uuid: string, input: AgentUpdateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.manage');
    const current = await this.requireAgent(uuid);
    const result = await this.repo.updateProfile(uuid, {
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.hireDate !== undefined ? { hireDate: input.hireDate } : {}),
      ...(input.licenseNumberMasked !== undefined
        ? { licenseNumberMasked: input.licenseNumberMasked }
        : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...(input.maxActiveAssignments !== undefined
        ? { maxActiveAssignments: input.maxActiveAssignments }
        : {}),
    });
    if (input.maxActiveAssignments !== undefined)
      await this.record(actor, AUDIT.CAPACITY_CHANGED, uuid, {
        oldValue: current.maxActiveAssignments,
        newValue: input.maxActiveAssignments,
      });
    await this.record(actor, AUDIT.UPDATED, uuid);
    return this.serialize(result);
  }

  async archive(uuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.manage');
    await this.requireAgent(uuid);
    await this.repo.softDeleteProfile(uuid);
    await this.record(actor, AUDIT.ARCHIVED, uuid);
  }

  async createSpecialization(input: SpecializationCreateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.specialization.manage');
    const item = await this.repo.createSpecialization({
      uuid: randomUUID(),
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });
    await this.record(actor, AUDIT.SPECIALIZATION_CHANGED, item.uuid);
    return item;
  }

  listSpecializations() {
    return this.repo.listSpecializations();
  }

  async specializations(uuid: string, actor: Actor) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return (agent.specializations ?? []).map((x) => ({
      uuid: x.specialization.uuid,
      code: x.specialization.code,
      name: x.specialization.name,
      isPrimary: x.isPrimary,
    }));
  }

  async addSpecialization(
    agentUuid: string,
    specializationUuid: string,
    primary: boolean,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.specialization.manage');
    const agent = await this.requireAgent(agentUuid);
    const spec = await this.repo.findSpecialization(specializationUuid);
    if (!spec || !spec.isActive)
      throw new NotFoundException('Specialization not found');
    const result = await this.repo.setSpecialization(
      agent.id,
      spec.id,
      primary,
    );
    await this.record(actor, AUDIT.SPECIALIZATION_CHANGED, agentUuid, {
      specializationUuid,
      isPrimary: primary,
    });
    return result;
  }

  async removeSpecialization(
    agentUuid: string,
    specializationUuid: string,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.specialization.manage');
    const agent = await this.requireAgent(agentUuid);
    const spec = await this.repo.findSpecialization(specializationUuid);
    if (!spec) throw new NotFoundException('Specialization not found');
    await this.repo.removeSpecialization(agent.id, spec.id);
    await this.record(actor, AUDIT.SPECIALIZATION_CHANGED, agentUuid, {
      specializationUuid,
      removed: true,
    });
  }

  async addCoverage(agentUuid: string, input: CoverageCreateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.location.manage');
    const agent = await this.requireAgent(agentUuid);
    if (!(await this.propertyRegions.isKnownRegion(input.regionUuid)))
      throw new BadRequestException('Unknown geographic region');
    const item = await this.repo.addCoverage({
      uuid: randomUUID(),
      agentId: agent.id,
      level: input.level,
      regionUuid: input.regionUuid,
      label: input.label ?? null,
      isActive: true,
      createdBy: actor.uuid,
      updatedBy: actor.uuid,
    });
    await this.record(actor, AUDIT.COVERAGE_CHANGED, agentUuid, {
      level: input.level,
      regionUuid: input.regionUuid,
    });
    return item;
  }

  async listCoverage(agentUuid: string, actor: Actor) {
    const agent = await this.requireAgent(agentUuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return this.repo.listCoverages(agent.id);
  }

  async removeCoverage(coverageUuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.location.manage');
    await this.repo.removeCoverage(coverageUuid);
    await this.record(actor, AUDIT.COVERAGE_CHANGED, coverageUuid, {
      removed: true,
    });
  }

  async updateAvailability(
    agentUuid: string,
    input: AvailabilityUpdateDto,
    actor: Actor,
  ) {
    const agent = await this.requireAgent(agentUuid);
    if (actor.uuid !== agent.userUuid)
      await this.requirePermission(actor.uuid, 'agents.availability.manage');
    for (const item of input.schedule) {
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime)
      )
        throw new BadRequestException('Invalid schedule time');
    }
    for (const item of input.exceptions)
      if (item.endsAt <= item.startsAt)
        throw new BadRequestException(
          'Availability exception end must be after start',
        );
    await this.repo.saveAvailability({
      agentId: agent.id,
      status: input.status,
      timeZone: input.timeZone ?? agent.timeZone,
      effectiveAt: input.effectiveAt ?? new Date(),
      schedule: input.schedule,
      exceptions: input.exceptions,
    });
    await this.record(actor, AUDIT.AVAILABILITY_CHANGED, agentUuid);
    return this.getAvailability(agentUuid);
  }

  async getAvailability(agentUuid: string) {
    const agent = await this.requireAgent(agentUuid);
    const full = await this.repo.findProfile(agentUuid);
    return {
      status: this.effectiveAvailability(full),
      timeZone: full?.availability?.timeZone ?? agent.timeZone,
      schedule: full?.weeklySchedules ?? [],
      exceptions: full?.availabilityExceptions ?? [],
    };
  }

  async capacity(agentUuid: string, actor: Actor) {
    const agent = await this.requireAgent(agentUuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return this.capacityForAgent(agent);
  }

  async assign(
    propertyUuid: string,
    agentUuid: string,
    actor: Actor,
    reason?: string,
  ) {
    const target = await this.requireAgent(agentUuid);
    await this.assignmentPermission(target.userUuid, actor.uuid);
    await this.ensureAssignable(target);
    const result = await this.propertyAssignments.assign({
      propertyUuid,
      agentUserUuid: target.userUuid,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.ASSIGNED, result.uuid, {
      propertyUuid,
      agentUserUuid: target.userUuid,
      ...(reason ? { reason } : {}),
    });
    return result;
  }

  async reassign(
    propertyUuid: string,
    toAgentUuid: string,
    actor: Actor,
    fromAgentUuid?: string,
    reason?: string,
  ) {
    await this.requirePermission(actor.uuid, 'agents.assignment.manage');
    const target = await this.requireAgent(toAgentUuid);
    await this.ensureAssignable(target);
    const result = await this.propertyAssignments.reassign({
      propertyUuid,
      fromAgentUserUuid: fromAgentUuid
        ? (await this.requireAgent(fromAgentUuid)).userUuid
        : undefined,
      toAgentUserUuid: target.userUuid,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.REASSIGNED, result.uuid, {
      propertyUuid,
      toAgentUserUuid: target.userUuid,
      ...(reason ? { reason } : {}),
    });
    return result;
  }

  async unassign(
    propertyUuid: string,
    agentUuid: string,
    actor: Actor,
    reason?: string,
  ) {
    await this.requirePermission(actor.uuid, 'agents.assignment.manage');
    const target = await this.requireAgent(agentUuid);
    const result = await this.propertyAssignments.unassign({
      propertyUuid,
      agentUserUuid: target.userUuid,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.UNASSIGNED, result.uuid, {
      propertyUuid,
      agentUserUuid: target.userUuid,
      ...(reason ? { reason } : {}),
    });
    return result;
  }

  async assignments(agentUuid: string, history: boolean, actor: Actor) {
    const agent = await this.requireAgent(agentUuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return history
      ? this.propertyAssignments.listHistory(agent.userUuid, 100)
      : this.propertyAssignments.listCurrent(agent.userUuid, 100);
  }

  async createTarget(agentUuid: string, input: TargetCreateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.target.manage');
    if (input.periodEnd < input.periodStart)
      throw new BadRequestException('periodEnd must be after periodStart');
    const agent = await this.requireAgent(agentUuid);
    const item = await this.repo.createTarget({
      uuid: randomUUID(),
      agentId: agent.id,
      metricType: input.metricType,
      periodType: input.periodType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      targetValue: input.targetValue,
      scope: input.scope ?? null,
      status: 'ACTIVE',
      createdBy: actor.uuid,
      updatedBy: actor.uuid,
    });
    await this.record(actor, AUDIT.TARGET_CHANGED, item.uuid);
    return item;
  }

  async listTargets(agentUuid: string, actor: Actor) {
    const agent = await this.requireAgent(agentUuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.target.read',
    );
    return this.repo.listTargets(agent.id);
  }

  async updateTarget(uuid: string, input: TargetUpdateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.target.manage');
    const current = await this.repo.findTarget(uuid);
    if (!current) throw new NotFoundException('Target not found');
    if (current.status === 'CLOSED')
      throw new ConflictException('Closed target is immutable');
    const item = await this.repo.updateTarget(uuid, {
      ...(input.targetValue !== undefined
        ? { targetValue: input.targetValue }
        : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    await this.record(actor, AUDIT.TARGET_CHANGED, uuid, {
      oldValue: current.targetValue,
      newValue: item.targetValue,
    });
    return item;
  }

  async closeTarget(uuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.target.manage');
    await this.repo.closeTarget(uuid);
    await this.record(actor, AUDIT.TARGET_CHANGED, uuid, { status: 'CLOSED' });
  }

  async performance(agentUuid: string, actor: Actor) {
    const agent = await this.requireAgent(agentUuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.performance.read',
    );
    const [capacity, crm, sales, targets] = await Promise.all([
      this.capacityForAgent(agent),
      this.crmWorkload.getWorkload(agent.userUuid),
      this.salesWorkload.getWorkload(agent.userUuid),
      this.repo.listTargets(agent.id),
    ]);
    const metrics = {
      propertyAssignments: await this.propertyAssignments.countCurrent(
        agent.userUuid,
      ),
      assignedLeads: crm.assignedLeads,
      closedLeads: crm.closedLeads,
      openOpportunities: sales.openOpportunities,
      openDeals: sales.openDeals,
      salesValue: sales.salesValue,
      totalWorkload: capacity.current,
    };
    const kpis = targets.map((target: AgentTarget) => {
      const actual = Number(
        (metrics as Record<string, unknown>)[target.metricType] ?? 0,
      );
      const targetValue = Number(target.targetValue);
      return {
        ...target,
        actual,
        achievementPercent:
          targetValue > 0
            ? Number(((actual / targetValue) * 100).toFixed(2))
            : 0,
      };
    });
    return { agent: this.serialize(agent), metrics, targets: kpis };
  }

  async findCandidates(
    query: {
      propertyUuid?: string;
      specializationUuid?: string;
      regionUuids?: string[];
      limit?: number;
    },
    actor?: Actor,
  ) {
    if (actor)
      await this.requirePermission(actor.uuid, 'agents.read').catch(async () =>
        this.requirePermission(actor.uuid, 'agents.assignment.manage'),
      );
    let regions = query.regionUuids ?? [];
    if (query.propertyUuid) {
      const ctx = await this.propertyContext.getContext(query.propertyUuid);
      if (!ctx) throw new NotFoundException('Property not found');
      regions = [
        ctx.countryUuid,
        ctx.provinceUuid,
        ctx.cityUuid,
        ctx.districtUuid,
        ctx.subdistrictUuid,
      ].filter((x): x is string => Boolean(x));
    }
    const rows = await this.repo.listProfiles({
      limit: Math.min(100, Math.max(1, query.limit ?? 20)),
      specializationUuid: query.specializationUuid,
      regionUuids: regions,
    });
    const results: Array<{
      uuid: string;
      userUuid: string;
      displayName: string | null;
      specializations: string[];
      coverage: string[];
      availability: string;
      capacity: {
        max: number;
        current: number;
        remaining: number;
        utilizationPercent: number;
      };
    }> = [];
    for (const agent of rows) {
      const cap = await this.capacityForAgent(agent);
      const availability = this.effectiveAvailability(agent);
      const user = await this.users.getUser(agent.userUuid).catch(() => null);
      const auth = await this.authorization
        .resolve(agent.userUuid)
        .catch(() => null);
      if (
        !isAgentAssignable(
          {
            user,
            hasAgentAccess: Boolean(
              auth && this.hasPermission(auth, 'agents.access'),
            ),
            agentStatus: agent.status,
          },
          availability,
          cap.remaining,
        )
      )
        continue;
      results.push({
        uuid: agent.uuid,
        userUuid: agent.userUuid,
        displayName: agent.displayName,
        specializations: (agent.specializations ?? []).map(
          (x) => x.specialization.uuid,
        ),
        coverage: (agent.coverages ?? []).map((x) => x.regionUuid),
        availability,
        capacity: cap,
      });
    }
    return results;
  }

  private async capacityForAgent(agent: AgentRecord) {
    const [property, crm, sales] = await Promise.all([
      this.propertyAssignments.countCurrent(agent.userUuid),
      this.crmWorkload.getWorkload(agent.userUuid),
      this.salesWorkload.getWorkload(agent.userUuid),
    ]);
    const current =
      property + crm.assignedLeads + sales.openOpportunities + sales.openDeals;
    const max = agent.maxActiveAssignments;
    return {
      max,
      current,
      remaining: Math.max(0, max - current),
      utilizationPercent: max
        ? Number(((current / max) * 100).toFixed(2))
        : 100,
    };
  }

  private async ensureAssignable(agent: AgentRecord) {
    const user = await this.users.getUser(agent.userUuid).catch(() => null);
    const auth = await this.authorization
      .resolve(agent.userUuid)
      .catch(() => null);
    const cap = await this.capacityForAgent(agent);
    if (
      !isAgentAssignable(
        {
          user,
          hasAgentAccess: Boolean(
            auth && this.hasPermission(auth, 'agents.access'),
          ),
          agentStatus: agent.status,
        },
        this.effectiveAvailability(agent as AgentProfileDetails),
        cap.remaining,
      )
    )
      throw new ConflictException(
        'Agent is not eligible, available, or within capacity for assignment',
      );
  }

  private assignmentPermission(agentUserUuid: string, actorUuid: string) {
    return agentUserUuid === actorUuid
      ? this.requirePermission(actorUuid, 'agents.assignment.self')
      : this.requirePermission(actorUuid, 'agents.assignment.manage');
  }

  private effectiveAvailability(agent: AgentProfileDetails | null): string {
    const state = agent?.availability?.status ?? 'OFFLINE';
    if (state !== 'ACTIVE') return state;
    const now = new Date();
    const exception = (agent.availabilityExceptions ?? []).find(
      (x) => x.startsAt <= now && x.endsAt >= now,
    );
    if (exception) return exception.status;
    const tz = agent?.availability?.timeZone ?? agent?.timeZone ?? 'UTC';
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
    } catch {
      return 'OFFLINE';
    }
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      parts.find((x) => x.type === 'weekday')?.value ?? 'Sun',
    );
    const hour = Number(parts.find((x) => x.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((x) => x.type === 'minute')?.value ?? 0);
    const current = hour * 60 + minute;
    const active = (agent.weeklySchedules ?? []).some((x) => {
      const start =
        Number(x.startTime.slice(0, 2)) * 60 + Number(x.startTime.slice(3));
      const end =
        Number(x.endTime.slice(0, 2)) * 60 + Number(x.endTime.slice(3));
      return (
        x.weekday === weekday &&
        (start <= end
          ? current >= start && current <= end
          : current >= start || current <= end)
      );
    });
    return active ? 'ACTIVE' : 'UNAVAILABLE';
  }

  private async requireAgent(uuid: string): Promise<AgentProfileDetails> {
    const agent = await this.repo.findProfile(uuid);
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  private hasPermission(
    snapshot: AgentAuthorizationSnapshot,
    permission: string,
  ): boolean {
    return snapshot.permissionCodes.includes(permission);
  }

  private async requirePermission(actorUuid: string, permission: string) {
    const snapshot = await this.authorization.resolve(actorUuid);
    try {
      this.authorization.assertPermissions(snapshot, [permission], 'OR');
    } catch {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  private async requireSelfOrPermission(
    userUuid: string,
    actorUuid: string,
    permission: string,
  ) {
    if (userUuid !== actorUuid)
      await this.requirePermission(actorUuid, permission);
  }

  private serialize(agent: AgentRecord) {
    return {
      uuid: agent.uuid,
      userUuid: agent.userUuid,
      displayName: agent.displayName,
      bio: agent.bio,
      status: agent.status,
      hireDate: agent.hireDate,
      licenseNumberMasked: agent.licenseNumberMasked,
      timeZone: agent.timeZone,
      maxActiveAssignments: agent.maxActiveAssignments,
      version: agent.version,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private async record(
    actor: Actor,
    action: string,
    entityUuid: string,
    values?: Record<string, unknown>,
  ) {
    await this.audit.record({
      action,
      actorUuid: actor.uuid,
      userUuid: actor.uuid,
      actorType: 'AUTHENTICATED',
      entityType: 'agent',
      entityUuid,
      result: 'SUCCESS',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      ...(values ? { reason: JSON.stringify(values) } : {}),
    });
  }
}
