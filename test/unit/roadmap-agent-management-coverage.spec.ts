import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgentManagementService } from '../../src/modules/agent-management/application/agent-management.service.js';

const userUuid = '123e4567-e89b-12d3-a456-426614174000';
const agentUuid = '223e4567-e89b-12d3-a456-426614174000';
const actor = { uuid: userUuid, ipAddress: '127.0.0.1', userAgent: 'test', requestId: 'req-1' };

const makeAgent = (overrides: Record<string, unknown> = {}) => ({
  id: 1n,
  uuid: agentUuid,
  userUuid,
  displayName: 'Alice',
  bio: 'Broker',
  status: 'ACTIVE',
  hireDate: null,
  licenseNumberMasked: null,
  timeZone: 'UTC',
  maxActiveAssignments: 10,
  availability: { status: 'ACTIVE', timeZone: 'UTC' },
  weeklySchedules: [],
  availabilityExceptions: [],
  assignments: [],
  specializations: [{ specialization: { uuid: 'spec-1', code: 'RES', name: 'Residential' }, isPrimary: true }],
  coverages: [{ regionUuid: 'region-1' }],
  version: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const dependencies = () => {
  const repo = {
    findProfileByUserUuid: vi.fn().mockResolvedValue(null),
    createProfile: vi.fn().mockResolvedValue(makeAgent()),
    findProfile: vi.fn().mockResolvedValue(makeAgent()),
    listProfiles: vi.fn().mockResolvedValue([makeAgent()]),
    updateProfile: vi.fn().mockResolvedValue(makeAgent()),
    softDeleteProfile: vi.fn().mockResolvedValue(undefined),
    createSpecialization: vi.fn().mockResolvedValue({ uuid: 'spec-1' }),
    listSpecializations: vi.fn().mockResolvedValue([{ uuid: 'spec-1' }]),
    findSpecialization: vi.fn().mockResolvedValue({ id: 1n, uuid: 'spec-1', code: 'RES', name: 'Residential', isActive: true }),
    setSpecialization: vi.fn().mockResolvedValue({ uuid: 'link-1' }),
    removeSpecialization: vi.fn().mockResolvedValue(undefined),
    addCoverage: vi.fn().mockResolvedValue({ uuid: 'coverage-1' }),
    listCoverages: vi.fn().mockResolvedValue([{ uuid: 'coverage-1' }]),
    removeCoverage: vi.fn().mockResolvedValue(undefined),
    saveAvailability: vi.fn().mockResolvedValue(undefined),
    listTargets: vi.fn().mockResolvedValue([{ uuid: 'target-1', metricType: 'propertyAssignments', targetValue: '10', status: 'ACTIVE' }]),
    createTarget: vi.fn().mockResolvedValue({ uuid: 'target-1', metricType: 'propertyAssignments', targetValue: '10', status: 'ACTIVE' }),
    updateTarget: vi.fn().mockResolvedValue({ uuid: 'target-1', metricType: 'propertyAssignments', targetValue: '20', status: 'ACTIVE' }),
    deleteTarget: vi.fn().mockResolvedValue(undefined),
    findTarget: vi.fn().mockResolvedValue({ uuid: 'target-1', targetValue: '10', status: 'ACTIVE' }),
    closeTarget: vi.fn().mockResolvedValue(undefined),
  };
  const authorization = {
    resolve: vi.fn().mockResolvedValue({ userUuid, permissionCodes: [
      'agents.access', 'agents.manage', 'agents.read', 'agents.specialization.manage',
      'agents.location.manage', 'agents.availability.manage', 'agents.assignment.manage',
      'agents.assignment.self', 'agents.target.manage', 'agents.target.read', 'agents.performance.read',
    ], roleCodes: [] }),
    assertPermissions: vi.fn(),
  };
  const users = { getUser: vi.fn().mockResolvedValue({ uuid: userUuid, isActive: true, status: 'active', deletedAt: null }) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const propertyAssignments = {
    assign: vi.fn().mockResolvedValue({ uuid: 'assignment-1' }),
    reassign: vi.fn().mockResolvedValue({ uuid: 'assignment-2' }),
    unassign: vi.fn().mockResolvedValue({ uuid: 'assignment-3' }),
    listHistory: vi.fn().mockResolvedValue([]),
    listCurrent: vi.fn().mockResolvedValue([]),
    countCurrent: vi.fn().mockResolvedValue(0),
  };
  const propertyContext = { getContext: vi.fn().mockResolvedValue({ countryUuid: 'country-1', provinceUuid: 'province-1', cityUuid: null, districtUuid: null, subdistrictUuid: null }) };
  const propertyRegions = { isKnownRegion: vi.fn().mockResolvedValue(true) };
  const crmWorkload = { getWorkload: vi.fn().mockResolvedValue({ assignedLeads: 1, closedLeads: 2, activeAssignments: 0 }) };
  const salesWorkload = { getWorkload: vi.fn().mockResolvedValue({ openOpportunities: 3, openDeals: 4, salesValue: 100000 }) };
  const service = new AgentManagementService(repo as never, authorization as never, users as never, audit as never, propertyAssignments as never, propertyContext as never, propertyRegions as never, crmWorkload as never, salesWorkload as never);
  return { service, repo, authorization, users, audit, propertyAssignments, propertyContext, propertyRegions, crmWorkload, salesWorkload };
};

describe('agent management roadmap coverage', () => {
  it('covers create eligibility failure, inactive specialization and update capacity branch', async () => {
    const d = dependencies();
    d.users.getUser.mockResolvedValueOnce({ uuid: userUuid, isActive: false, status: 'disabled', deletedAt: null });
    d.authorization.resolve.mockResolvedValueOnce({ userUuid, permissionCodes: [], roleCodes: [] });
    await expect(d.service.create({ userUuid, displayName: 'Alice' } as never, actor)).rejects.toBeInstanceOf(ForbiddenException);

    d.repo.findSpecialization.mockResolvedValueOnce({ id: 1n, uuid: 'spec-1', code: 'RES', name: 'Residential', isActive: false });
    await expect(d.service.addSpecialization(agentUuid, 'spec-1', false, actor)).rejects.toBeInstanceOf(NotFoundException);

    await d.service.update(agentUuid, { bio: 'new bio' } as never, actor);
    expect(d.repo.updateProfile).toHaveBeenCalled();
  });

  it('covers availability exception, owner self-path and invalid exception timing', async () => {
    const d = dependencies();
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T01:00:00Z');
    await expect(d.service.updateAvailability(agentUuid, {
      status: 'ACTIVE', schedule: [], exceptions: [{ startsAt: end, endsAt: start, status: 'UNAVAILABLE' }],
    } as never, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(d.service.updateAvailability(agentUuid, {
      status: 'ACTIVE', schedule: [], exceptions: [{ startsAt: start, endsAt: end, status: 'UNAVAILABLE' }],
    } as never, actor)).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(d.repo.saveAvailability).toHaveBeenCalled();
  });

  it('covers assignment permission, capacity rejection, target lifecycle and performance KPIs', async () => {
    const d = dependencies();
    d.authorization.assertPermissions.mockImplementationOnce(() => { throw new Error('denied'); });
    await expect(d.service.assign('property-1', agentUuid, actor)).rejects.toBeInstanceOf(ForbiddenException);

    d.authorization.assertPermissions.mockImplementation(() => undefined);
    d.propertyAssignments.countCurrent.mockResolvedValue(20);
    await expect(d.service.assign('property-1', agentUuid, actor)).rejects.toBeInstanceOf(ConflictException);
    d.propertyAssignments.countCurrent.mockResolvedValue(0);

    const future = new Date('2027-01-01T00:00:00Z');
    const past = new Date('2026-01-01T00:00:00Z');
    await expect(d.service.createTarget(agentUuid, { periodStart: future, periodEnd: past, metricType: 'propertyAssignments', periodType: 'MONTH', targetValue: '10' } as never, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(d.service.createTarget(agentUuid, { periodStart: past, periodEnd: future, metricType: 'propertyAssignments', periodType: 'MONTH', targetValue: '10' } as never, actor)).resolves.toMatchObject({ uuid: 'target-1' });
    await expect(d.service.listTargets(agentUuid, actor)).resolves.toHaveLength(1);
    await expect(d.service.updateTarget('target-1', { targetValue: '20' } as never, actor)).resolves.toMatchObject({ targetValue: '20' });
    d.repo.findTarget.mockResolvedValueOnce(null);
    await expect(d.service.updateTarget('missing', { targetValue: '20' } as never, actor)).rejects.toBeInstanceOf(NotFoundException);
    d.repo.findTarget.mockResolvedValueOnce({ uuid: 'target-1', targetValue: '20', status: 'CLOSED' });
    await expect(d.service.updateTarget('target-1', { targetValue: '30' } as never, actor)).rejects.toBeInstanceOf(ConflictException);
    await expect(d.service.closeTarget('target-1', actor)).resolves.toBeUndefined();

    await expect(d.service.performance(agentUuid, actor)).resolves.toMatchObject({ metrics: { totalWorkload: 4 }, targets: [{ actual: 0, achievementPercent: 0 }] });
  });

  it('covers findCandidates with property context, permission fallback, filtering and missing property', async () => {
    const d = dependencies();
    await expect(d.service.findCandidates({ propertyUuid: 'property-1', limit: 1 }, actor)).resolves.toHaveLength(1);
    expect(d.propertyContext.getContext).toHaveBeenCalledWith('property-1');
    d.propertyContext.getContext.mockResolvedValueOnce(null);
    await expect(d.service.findCandidates({ propertyUuid: 'missing' }, actor)).rejects.toBeInstanceOf(NotFoundException);

    d.authorization.assertPermissions.mockImplementationOnce(() => { throw new Error('read denied'); });
    d.authorization.assertPermissions.mockImplementationOnce(() => undefined);
    await expect(d.service.findCandidates({ regionUuids: ['region-1'] }, actor)).resolves.toBeDefined();

    d.repo.listProfiles.mockResolvedValueOnce([makeAgent({ status: 'ARCHIVED' })]);
    await expect(d.service.findCandidates({ regionUuids: ['region-1'] })).resolves.toEqual([]);
  });
});
