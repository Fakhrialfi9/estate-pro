import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AgentManagementService } from '../../src/modules/agent-management/application/agent-management.service.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';
const actor = {
  uuid,
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  requestId: 'req-1',
};
const agent = {
  id: 1n,
  uuid: 'agent-1',
  userUuid: uuid,
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
  specializations: [],
};

const dependencies = () => ({
  repo: {
    findProfileByUserUuid: vi.fn().mockResolvedValue(null),
    createProfile: vi.fn().mockResolvedValue(agent),
    findProfile: vi.fn().mockResolvedValue(agent),
    listProfiles: vi.fn().mockResolvedValue([agent]),
    updateProfile: vi.fn().mockResolvedValue(agent),
    softDeleteProfile: vi.fn().mockResolvedValue(undefined),
    createSpecialization: vi.fn().mockResolvedValue({ uuid: 'spec-1' }),
    listSpecializations: vi.fn().mockResolvedValue([{ uuid: 'spec-1' }]),
    findSpecialization: vi.fn().mockResolvedValue({
      id: 1n,
      uuid: 'spec-1',
      code: 'RES',
      name: 'Residential',
      isActive: true,
    }),
    setSpecialization: vi.fn().mockResolvedValue({ uuid: 'link-1' }),
    removeSpecialization: vi.fn().mockResolvedValue(undefined),
    addCoverage: vi.fn().mockResolvedValue({ uuid: 'coverage-1' }),
    listCoverages: vi.fn().mockResolvedValue([{ uuid: 'coverage-1' }]),
    removeCoverage: vi.fn().mockResolvedValue(undefined),
    saveAvailability: vi.fn().mockResolvedValue(undefined),
    listTargets: vi.fn().mockResolvedValue([]),
    createTarget: vi.fn().mockResolvedValue({ uuid: 'target-1' }),
    updateTarget: vi.fn().mockResolvedValue({ uuid: 'target-1' }),
    deleteTarget: vi.fn().mockResolvedValue(undefined),
  },
  authorization: {
    resolve: vi.fn().mockResolvedValue({
      userUuid: uuid,
      permissionCodes: [
        'agents.access',
        'agents.manage',
        'agents.read',
        'agents.specialization.manage',
        'agents.location.manage',
        'agents.availability.manage',
        'agents.assignment.manage',
        'agents.target.manage',
      ],
      roleCodes: [],
    }),
    assertPermissions: vi.fn(
      (
        snapshot: { permissionCodes: string[] },
        required: readonly string[],
      ) => {
        if (
          !required.every(
            (permission) =>
              snapshot.permissionCodes.includes(permission) ||
              (permission.startsWith('agents.') &&
                snapshot.permissionCodes.includes('agents.manage')),
          )
        ) {
          throw new ForbiddenException();
        }
      },
    ),
  },
  users: {
    getUser: vi.fn().mockResolvedValue({
      uuid,
      isActive: true,
      status: 'active',
      deletedAt: null,
    }),
  },
  audit: { record: vi.fn().mockResolvedValue(undefined) },
  propertyAssignments: {
    assign: vi.fn().mockResolvedValue({ uuid: 'assignment-1' }),
    reassign: vi.fn().mockResolvedValue({ uuid: 'assignment-2' }),
    unassign: vi.fn().mockResolvedValue({ uuid: 'assignment-3' }),
    listHistory: vi.fn().mockResolvedValue([{ uuid: 'assignment-h1' }]),
    listCurrent: vi.fn().mockResolvedValue([{ uuid: 'assignment-c1' }]),
    countCurrent: vi.fn().mockResolvedValue(1),
  },
  propertyContext: {},
  propertyRegions: {
    isKnownRegion: vi.fn().mockResolvedValue(true),
  },
  crmWorkload: {
    getWorkload: vi.fn().mockResolvedValue({
      assignedLeads: 0,
      closedLeads: 0,
      activeAssignments: 0,
    }),
  },
  salesWorkload: {
    getWorkload: vi.fn().mockResolvedValue({
      openOpportunities: 0,
      openDeals: 0,
      salesValue: 0,
    }),
  },
});

describe('AgentManagementService coverage', () => {
  let d: ReturnType<typeof dependencies>;
  let service: AgentManagementService;

  beforeEach(() => {
    d = dependencies();
    service = new AgentManagementService(
      d.repo as never,
      d.authorization as never,
      d.users,
      d.audit,
      d.propertyAssignments as never,
      d.propertyContext as never,
      d.propertyRegions,
      d.crmWorkload,
      d.salesWorkload,
    );
  });

  it('covers profile create/list and authorization failures', async () => {
    await expect(
      service.create({ userUuid: uuid, displayName: 'Alice' }, actor),
    ).resolves.toMatchObject({ uuid: 'agent-1' });
    const list = await service.list(
      { limit: 200, regionUuid: 'region-1' },
      actor,
    );
    expect(list.items).toHaveLength(1);
    expect(list.nextCursor).toBeNull();
    expect(d.repo.listProfiles).toHaveBeenCalledWith({
      limit: 100,
      cursor: undefined,
      status: undefined,
      specializationUuid: undefined,
      regionUuids: ['region-1'],
    });

    d.repo.findProfileByUserUuid.mockResolvedValueOnce({ uuid: 'existing' });
    await expect(
      service.create({ userUuid: uuid, displayName: 'Alice' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);

    d.repo.findProfileByUserUuid.mockResolvedValueOnce(null);
    d.authorization.resolve.mockResolvedValueOnce({
      userUuid: uuid,
      permissionCodes: [],
      roleCodes: [],
    });
    await expect(
      service.create({ userUuid: uuid, displayName: 'Alice' }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('covers get, update and archive paths', async () => {
    await expect(service.get('agent-1', actor)).resolves.toMatchObject({
      uuid: 'agent-1',
    });
    await expect(
      service.update(
        'agent-1',
        { displayName: 'Updated', maxActiveAssignments: 20 },
        actor,
      ),
    ).resolves.toMatchObject({ uuid: 'agent-1' });
    await expect(service.archive('agent-1', actor)).resolves.toBeUndefined();

    d.repo.findProfile.mockResolvedValueOnce(null);
    await expect(service.get('missing', actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('covers specialization and coverage lifecycle', async () => {
    await expect(
      service.createSpecialization(
        { code: ' RES ', name: ' Residential ' },
        actor,
      ),
    ).resolves.toMatchObject({ uuid: 'spec-1' });
    await expect(service.listSpecializations()).resolves.toEqual([
      { uuid: 'spec-1' },
    ]);
    await expect(service.specializations('agent-1', actor)).resolves.toEqual(
      [],
    );
    await expect(
      service.addSpecialization('agent-1', 'spec-1', true, actor),
    ).resolves.toEqual({ uuid: 'link-1' });
    await expect(
      service.removeSpecialization('agent-1', 'spec-1', actor),
    ).resolves.toBeUndefined();

    d.repo.findSpecialization.mockResolvedValueOnce(null);
    await expect(
      service.addSpecialization('agent-1', 'missing', false, actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.addCoverage(
        'agent-1',
        { level: 'CITY', regionUuid: 'region-1' } as never,
        actor,
      ),
    ).resolves.toEqual({ uuid: 'coverage-1' });
    await expect(service.listCoverage('agent-1', actor)).resolves.toEqual([
      { uuid: 'coverage-1' },
    ]);
    await expect(
      service.removeCoverage('coverage-1', actor),
    ).resolves.toBeUndefined();
    d.propertyRegions.isKnownRegion.mockResolvedValueOnce(false);
    await expect(
      service.addCoverage(
        'agent-1',
        { level: 'CITY', regionUuid: 'bad-region' } as never,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('covers availability validation and persistence', async () => {
    const schedule = [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }];
    const exceptions = [
      {
        startsAt: new Date('2026-01-01T09:00:00Z'),
        endsAt: new Date('2026-01-01T10:00:00Z'),
      },
    ];
    await expect(
      service.updateAvailability(
        'agent-1',
        { status: 'AVAILABLE', schedule, exceptions } as never,
        actor,
      ),
    ).resolves.toMatchObject({ status: 'AVAILABLE' });
    expect(d.repo.saveAvailability).toHaveBeenCalled();
    await expect(
      service.updateAvailability(
        'agent-1',
        {
          status: 'AVAILABLE',
          schedule: [{ dayOfWeek: 1, startTime: 'bad', endTime: '17:00' }],
          exceptions,
        } as never,
        actor,
      ),
    ).rejects.toThrow('Invalid schedule time');
  });

  it('covers assignment history and current views', async () => {
    await expect(
      service.assign('property-1', 'agent-1', actor, 'manual'),
    ).resolves.toEqual({ uuid: 'assignment-1' });
    await expect(
      service.reassign('property-1', 'agent-1', actor, 'agent-1', 'capacity'),
    ).resolves.toEqual({ uuid: 'assignment-2' });
    await expect(
      service.unassign('property-1', 'agent-1', actor, 'sold'),
    ).resolves.toEqual({ uuid: 'assignment-3' });
    await expect(service.assignments('agent-1', true, actor)).resolves.toEqual([
      { uuid: 'assignment-h1' },
    ]);
    await expect(service.assignments('agent-1', false, actor)).resolves.toEqual(
      [{ uuid: 'assignment-c1' }],
    );
  });
});