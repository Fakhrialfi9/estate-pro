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
} from './agent-management.request.js';

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
type AgentRecord = Awaited<ReturnType<PrismaAgentRepository['createProfile']>>;
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
    const existing = await this.repo.findProfileByUserUuid(input.userUuid);
    if (existing) throw new ConflictException('User already has an agent profile');
    const result = await this.repo.createProfile({
      uuid: randomUUID(),
      userUuid: input.userUuid,
      displayName: input.displayName?.trim() || null,
      bio: input.bio?.trim() || null,
      status: input.status ?? 'ACTIVE',
      hireDate: input.hireDate ? new Date(input.hireDate) : null,
      licenseNumberMasked: input.licenseNumberMasked?.trim() || null,
      timeZone: input.timeZone ?? 'UTC',
      maxActiveAssignments: input.maxActiveAssignments ?? 10,
      version: 1,
      deletedAt: null,
    });
    await this.record(actor, AUDIT.CREATED, result.uuid);
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

  async update(uuid: string, input: AgentUpdateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.manage');
    await this.requireAgent(uuid);
    const result = await this.repo.updateProfile(uuid, {
      ...(input.displayName !== undefined
        ? { displayName: input.displayName?.trim() || null }
        : {}),
      ...(input.bio !== undefined ? { bio: input.bio?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.hireDate !== undefined
        ? { hireDate: input.hireDate ? new Date(input.hireDate) : null }
        : {}),
      ...(input.licenseNumberMasked !== undefined
        ? {
            licenseNumberMasked: input.licenseNumberMasked?.trim() || null,
          }
        : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...(input.maxActiveAssignments !== undefined
        ? { maxActiveAssignments: input.maxActiveAssignments }
        : {}),
      version: { increment: 1 },
    });
    await this.record(actor, AUDIT.UPDATED, result.uuid);
    return this.serialize(result);
  }

  async archive(uuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.manage');
    await this.requireAgent(uuid);
    await this.repo.softDeleteProfile(uuid);
    await this.record(actor, AUDIT.ARCHIVED, uuid);
  }

  async list(
    query: {
      limit?: number;
      cursor?: string;
      status?: AgentProfileStatus;
      specializationUuid?: string;
      regionUuids?: string[];
    },
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.read');
    const rows = await this.repo.listProfiles({
      limit: Math.min(100, Math.max(1, query.limit ?? 20)),
      cursor: query.cursor,
      status: query.status,
      specializationUuid: query.specializationUuid,
      regionUuids: query.regionUuids,
    });
    return {
      items: rows.map((row) => this.serialize(row)),
      nextCursor: rows.length
        ? rows[rows.length - 1]?.uuid ?? null
        : null,
    };
  }

  async addSpecialization(
    uuid: string,
    input: SpecializationCreateDto,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.specialization.manage');
    const agent = await this.requireAgent(uuid);
    const specialization = await this.repo.findSpecialization(
      input.specializationUuid,
    );
    if (!specialization)
      throw new NotFoundException('Specialization not found');
    const result = await this.repo.setSpecialization(
      agent.id,
      specialization.id,
      input.isPrimary ?? false,
    );
    await this.record(actor, AUDIT.SPECIALIZATION_CHANGED, uuid, {
      specializationUuid: input.specializationUuid,
      isPrimary: input.isPrimary ?? false,
    });
    return result;
  }

  async removeSpecialization(
    uuid: string,
    specializationUuid: string,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.specialization.manage');
    const agent = await this.requireAgent(uuid);
    const specialization = await this.repo.findSpecialization(specializationUuid);
    if (!specialization)
      throw new NotFoundException('Specialization not found');
    await this.repo.removeSpecialization(agent.id, specialization.id);
    await this.record(actor, AUDIT.SPECIALIZATION_CHANGED, uuid, {
      specializationUuid,
      removed: true,
    });
  }

  async addCoverage(uuid: string, input: CoverageCreateDto, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.coverage.manage');
    const agent = await this.requireAgent(uuid);
    const region = await this.propertyRegions.getRegion(input.regionUuid);
    if (!region) throw new NotFoundException('Region not found');
    const result = await this.repo.addCoverage({
      uuid: randomUUID(),
      agentId: agent.id,
      regionUuid: input.regionUuid,
      level: input.level,
      isActive: true,
    });
    await this.record(actor, AUDIT.COVERAGE_CHANGED, uuid, {
      regionUuid: input.regionUuid,
      level: input.level,
    });
    return result;
  }

  async listCoverage(uuid: string, actor: Actor) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.read',
    );
    return this.repo.listCoverages(agent.id);
  }

  async removeCoverage(uuid: string, coverageUuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.coverage.manage');
    const agent = await this.requireAgent(uuid);
    const result = await this.repo.removeCoverage(coverageUuid);
    if (result.agentId !== agent.id)
      throw new ForbiddenException('Coverage does not belong to agent');
    await this.record(actor, AUDIT.COVERAGE_CHANGED, uuid, {
      coverageUuid,
      removed: true,
    });
  }

  async setAvailability(
    uuid: string,
    input: AvailabilityUpdateDto,
    actor: Actor,
  ) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.availability.manage',
    );
    const result = await this.repo.saveAvailability({
      agentId: agent.id,
      status: input.status,
      timeZone: input.timeZone ?? agent.timeZone,
    });
    await this.record(actor, AUDIT.AVAILABILITY_CHANGED, uuid, {
      status: input.status,
    });
    return result;
  }

  async availability(uuid: string, actor: Actor) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.availability.read',
    );
    const full = await this.requireAgent(uuid);
    return {
      status: this.effectiveAvailability(full),
      timeZone: full?.availability?.timeZone ?? agent.timeZone,
      weeklySchedules: full?.weeklySchedules ?? [],
      exceptions: full?.availabilityExceptions ?? [],
    };
  }

  async setCapacity(
    uuid: string,
    maxActiveAssignments: number,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.capacity.manage');
    const result = await this.repo.updateProfile(uuid, {
      maxActiveAssignments,
      version: { increment: 1 },
    });
    await this.record(actor, AUDIT.CAPACITY_CHANGED, uuid, {
      maxActiveAssignments,
    });
    return this.serialize(result);
  }

  async assign(
    agentUuid: string,
    input: {
      propertyUuid: string;
      assignmentType: string;
    },
    actor: Actor,
  ) {
    const agent = await this.requireAgent(agentUuid);
    await this.assignmentPermission(agent.userUuid, actor.uuid);
    await this.ensureAssignable(agent);
    const result = await this.propertyAssignments.assign({
      propertyUuid: input.propertyUuid,
      agentUserUuid: agent.userUuid,
      assignmentType: input.assignmentType,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.ASSIGNED, agentUuid, {
      propertyUuid: input.propertyUuid,
      assignmentType: input.assignmentType,
      assignmentUuid: result.uuid,
    });
    return result;
  }

  async reassign(
    propertyUuid: string,
    toAgentUuid: string,
    actor: Actor,
  ) {
    const target = await this.requireAgent(toAgentUuid);
    await this.assignmentPermission(target.userUuid, actor.uuid);
    await this.ensureAssignable(target);
    const result = await this.propertyAssignments.reassign({
      propertyUuid,
      agentUserUuid: target.userUuid,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.REASSIGNED, toAgentUuid, {
      propertyUuid,
      assignmentUuid: result.uuid,
    });
    return result;
  }

  async unassign(propertyUuid: string, actor: Actor) {
    await this.requirePermission(actor.uuid, 'agents.assignment.manage');
    const result = await this.propertyAssignments.unassign({
      propertyUuid,
      actorUuid: actor.uuid,
    });
    await this.record(actor, AUDIT.UNASSIGNED, result.agentUuid, {
      propertyUuid,
      assignmentUuid: result.uuid,
    });
    return result;
  }

  async createTarget(
    uuid: string,
    input: TargetCreateDto,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.target.manage');
    const agent = await this.requireAgent(uuid);
    const item = await this.repo.createTarget({
      uuid: randomUUID(),
      agentId: agent.id,
      metricType: input.metricType,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      targetValue: input.targetValue,
      status: input.status,
    });
    await this.record(actor, AUDIT.TARGET_CHANGED, uuid, {
      action: 'created',
      targetUuid: item.uuid,
    });
    return item;
  }

  async listTargets(uuid: string, actor: Actor) {
    const agent = await this.requireAgent(uuid);
    await this.requireSelfOrPermission(
      agent.userUuid,
      actor.uuid,
      'agents.performance.read',
    );
    return this.repo.listTargets(agent.id);
  }

  async updateTarget(
    uuid: string,
    targetUuid: string,
    input: TargetUpdateDto,
    actor: Actor,
  ) {
    await this.requirePermission(actor.uuid, 'agents.target.manage');
    const current = await this.repo.getTarget(targetUuid);
    if (!current || current.agentId !== (await this.requireAgent(uuid)).id)
      throw new NotFoundException('Agent target not found');
    const item = await this.repo.updateTarget(targetUuid, {
      ...(input.metricType !== undefined
        ? { metricType: input.metricType }
        : {}),
      ...(input.periodStart !== undefined
        ? { periodStart: new Date(input.periodStart) }
        : {}),
      ...(input.periodEnd !== undefined
        ? { periodEnd: new Date(input.periodEnd) }
        : {}),
      ...(input.targetValue !== undefined
        ? { targetValue: input.targetValue }
        : {}),
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

  private async ensureAssignable(agent: AgentProfileDetails) {
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
        this.effectiveAvailability(agent),
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
    if (!agent || state !== 'ACTIVE') return state;
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