import { describe, expect, it } from 'vitest';

import {
  ArticleEntity,
  RevisionEntity,
} from '../../src/modules/content/domain/entities/content.entities.js';
import {
  ContactEntity,
  type ContactProps,
} from '../../src/modules/crm/domain/entities/contact.entity.js';
import {
  LeadEntity,
  type LeadProps,
} from '../../src/modules/crm/domain/entities/lead.entity.js';
import { ClosurePolicy } from '../../src/modules/crm/domain/closure.policy.js';
import { LeadLifecyclePolicy } from '../../src/modules/crm/domain/lead-lifecycle.policy.js';
import { QualificationPolicy } from '../../src/modules/crm/domain/qualification.policy.js';
import {
  allowedTransitions,
  canTransition,
} from '../../src/modules/crm/domain/lifecycle.policy.js';
import { DuplicateDetector } from '../../src/modules/crm/application/ports/duplicate-detector.js';
import { LeadMergePolicy } from '../../src/modules/crm/application/ports/merge.policy.js';
import {
  PermissionEntity,
  buildPermissionCode,
  isProtectedPermissionCode,
  normalizePermissionName,
  normalizePermissionSegment,
} from '../../src/modules/permissions/domain/entities/permission.entity.js';
import * as permissionErrors from '../../src/modules/permissions/domain/errors/permission.errors.js';
import {
  RoleEntity,
  isProtectedRoleCode,
  normalizeRoleCode,
  normalizeRoleName,
} from '../../src/modules/roles/domain/entities/role.entity.js';
import { RolePermissionEntity } from '../../src/modules/roles/domain/entities/role-permission.entity.js';
import { PropertyPreference } from '../../src/modules/property-matching/domain/property-preference.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-01-01T00:00:00.000Z');

const contactProps = (overrides: Partial<ContactProps> = {}): ContactProps => ({
  uuid,
  firstName: 'Alice',
  lastName: 'Smith',
  displayName: 'Alice Smith',
  companyName: null,
  jobTitle: null,
  status: 'ACTIVE',
  ownerUserUuid: null,
  source: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const leadProps = (overrides: Partial<LeadProps> = {}): LeadProps => ({
  uuid,
  code: 'LEAD-001',
  contactUuid: uuid2,
  sourceUuid: uuid,
  typeUuid: uuid2,
  campaignUuid: null,
  status: 'NEW',
  ownerUserUuid: null,
  score: 10,
  scoreVersion: 1,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('phase 6-10 domain coverage', () => {
  it('covers article construction, transitions, updates and revisions', () => {
    const entity = new ArticleEntity(uuid, 'Title', 'title', { body: 'x' });
    expect(entity.status).toBe('DRAFT');
    expect(entity.visibility).toBe('PUBLIC');
    expect(entity.contentFormat).toBe('RICH_TEXT');
    expect(entity.type).toBe('ARTICLE');

    const transitions: readonly [
      Parameters<ArticleEntity['transition']>[0],
      Parameters<ArticleEntity['transition']>[0],
    ][] = [
      ['DRAFT', 'IN_REVIEW'],
      ['IN_REVIEW', 'APPROVED'],
      ['APPROVED', 'SCHEDULED'],
      ['SCHEDULED', 'PUBLISHED'],
      ['PUBLISHED', 'ARCHIVED'],
      ['ARCHIVED', 'DRAFT'],
      ['REJECTED', 'IN_REVIEW'],
    ];
    for (const [from, to] of transitions) {
      const current = new ArticleEntity(uuid, 'Title', 'title', {}, from);
      current.transition(to);
      expect(current.status).toBe(to);
    }

    expect(() => entity.transition('PUBLISHED')).toThrow(
      'Invalid article transition',
    );
    entity.update({
      title: '  New title  ',
      slug: 'new-title',
      content: 'new',
      visibility: 'PRIVATE',
    });
    expect(entity.title).toBe('New title');
    expect(entity.slug).toBe('new-title');
    expect(entity.content).toBe('new');
    expect(entity.visibility).toBe('PRIVATE');
    expect(() => entity.update({ title: '   ' })).toThrow(
      'Article title is required',
    );
    expect(() => new ArticleEntity(uuid, '', 'title', {})).toThrow(
      'Article title is required',
    );
    expect(() => new ArticleEntity(uuid, 'Title', '', {})).toThrow(
      'Article slug is required',
    );
    expect(
      () => new ArticleEntity(uuid, 'Title', 'slug', {}, 'UNKNOWN' as never),
    ).toThrow('Invalid content status');
    expect(
      () =>
        new ArticleEntity(
          uuid,
          'Title',
          'slug',
          {},
          'DRAFT',
          'INVALID' as never,
        ),
    ).toThrow('Invalid visibility');
    expect(() => new RevisionEntity('article', uuid, 0, {}, now)).toThrow(
      'Revision version must be positive',
    );
    expect(new RevisionEntity('article', uuid, 1, {}, now).version).toBe(1);
  });

  it('covers CRM policies and entities including boundary failures', () => {
    expect(new ClosurePolicy().decide('  reason  ', 'WON')).toEqual({
      reason: 'reason',
      outcome: 'WON',
    });
    expect(() => new ClosurePolicy().decide('   ', 'WON')).toThrow();
    expect(new QualificationPolicy().evaluate(0, 'reason').qualified).toBe(
      false,
    );
    expect(new QualificationPolicy().evaluate(1, 'reason').qualified).toBe(
      true,
    );
    expect(() => new QualificationPolicy().evaluate(1, '   ')).toThrow();

    const lifecycle = new LeadLifecyclePolicy();
    lifecycle.assertCan('QUALIFY', 'NEW');
    lifecycle.assertCan('NURTURE', 'NEW');
    lifecycle.assertCan('REACTIVATE', 'CLOSED_LOST');
    lifecycle.assertCan('CLOSE', 'NEW');
    expect(() => lifecycle.assertCan('QUALIFY', 'CLOSED_LOST')).toThrow();
    expect(() => lifecycle.assertCan('NURTURE', 'ARCHIVED')).toThrow();
    expect(() => lifecycle.assertCan('REACTIVATE', 'NEW')).toThrow();
    expect(() => lifecycle.assertCan('CLOSE', 'CLOSED_WON')).toThrow();
    expect(() => lifecycle.assertCan('CLOSE', '')).toThrow();

    expect(canTransition('NEW', 'CONTACTED')).toBe(true);
    expect(canTransition('NEW', 'CLOSED_WON')).toBe(false);
    expect(allowedTransitions('NURTURING')).toContain('QUALIFIED');
    expect(allowedTransitions('ARCHIVED')).toEqual(['CONTACTED']);

    const contact = ContactEntity.create(contactProps());
    expect(contact.uuid).toBe(uuid);
    expect(contact.archive(now).status).toBe('ARCHIVED');
    expect(contact.update({ firstName: 'Bob' }, now).toProps().firstName).toBe(
      'Bob',
    );
    expect(() => ContactEntity.create(contactProps({ uuid: 'bad' }))).toThrow(
      'Invalid contact UUID',
    );
    expect(() =>
      ContactEntity.create(contactProps({ firstName: ' ' })),
    ).toThrow();
    expect(() =>
      ContactEntity.create(contactProps({ displayName: ' ' })),
    ).toThrow();
    expect(() =>
      ContactEntity.create(
        contactProps({ status: 'ARCHIVED', archivedAt: null }),
      ),
    ).toThrow();
    expect(() =>
      contact.archive(now).update({ firstName: 'Blocked' }, now),
    ).toThrow('Archived contact cannot be mutated');

    const lead = LeadEntity.create(leadProps());
    expect(lead.transitionTo('CONTACTED', canTransition, now).status).toBe(
      'CONTACTED',
    );
    expect(lead.transitionTo('NEW', canTransition)).toBe(lead);
    expect(() => lead.transitionTo('CLOSED_WON', canTransition)).toThrow();
    expect(lead.assign(uuid2, now).ownerUserUuid).toBe(uuid2);
    expect(lead.assign(null, now).ownerUserUuid).toBeNull();
    expect(() => lead.assign('bad')).toThrow('Invalid assignee UUID');
    expect(lead.withScore(0, now).scoreVersion).toBe(2);
    expect(() => lead.withScore(-1)).toThrow();
    expect(lead.archive(now).status).toBe('ARCHIVED');
    expect(() =>
      lead.archive(now).transitionTo('CONTACTED', canTransition),
    ).toThrow();
    expect(() => lead.archive(now).assign(uuid2)).toThrow();
    expect(() => LeadEntity.create(leadProps({ score: -1 }))).toThrow();
    expect(() => LeadEntity.create(leadProps({ scoreVersion: 0 }))).toThrow();

    const detector = new DuplicateDetector();
    const matches = detector.detect(
      {
        leadUuid: uuid,
        email: 'Alice@Example.COM',
        phone: '+62 812',
        displayName: 'Alice Smith',
      },
      [
        {
          leadUuid: uuid2,
          email: 'alice@example.com',
          phone: '+62812',
          displayName: 'alice smith',
        },
        {
          leadUuid: '33333333-3333-4333-8333-333333333333',
          email: 'other@example.com',
          phone: null,
          displayName: 'Other',
        },
      ],
    );
    expect(matches[0].signals).toEqual(['EMAIL', 'PHONE', 'NAME']);
    expect(matches[0].confidence).toBe(110);
    expect(detector.detect({ leadUuid: uuid }, [{ leadUuid: uuid2 }])).toEqual(
      [],
    );

    const merge = new LeadMergePolicy();
    merge.assertAllowed(uuid, uuid2, true);
    expect(() => merge.assertAllowed(uuid, uuid2, false)).toThrow();
    expect(() => merge.assertAllowed(uuid, uuid, true)).toThrow();
    expect(
      merge.merge(
        { uuid, a: null, b: 'target', c: '' },
        { uuid: uuid2, a: 'value', b: 'keep', c: 'target' },
      ),
    ).toEqual({
      uuid: uuid2,
      a: 'value',
      b: 'keep',
      c: 'target',
    });
  });

  it('covers permission and role entities and error constructors', () => {
    expect(normalizePermissionSegment('  Sales  ')).toBe('sales');
    expect(normalizePermissionName('  Display   Name ')).toBe('Display Name');
    expect(buildPermissionCode('sales', 'leads', 'read')).toBe('leads.read');
    expect(buildPermissionCode('permissions', 'manage', 'protected')).toBe(
      'permissions.manage.protected',
    );
    expect(isProtectedPermissionCode('permissions.manage.protected')).toBe(
      true,
    );
    expect(isProtectedPermissionCode('leads.read')).toBe(false);

    const permission = PermissionEntity.create({
      uuid,
      name: '  Read Leads ',
      code: 'leads.read',
      module: ' Sales ',
      domain: ' Leads ',
      action: ' Read ',
      createdAt: now,
      updatedAt: now,
    });
    expect(permission.resource).toBe('sales:leads');
    expect(permission.isSystem).toBe(false);
    permission.update({ name: ' Updated Name ' });
    expect(permission.name).toBe('Updated Name');
    expect(() =>
      PermissionEntity.create({ ...permission.toSnapshot(), uuid: 'bad' }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({ ...permission.toSnapshot(), name: '' }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({
        ...permission.toSnapshot(),
        module: 'BAD MODULE',
      }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({
        ...permission.toSnapshot(),
        domain: 'BAD DOMAIN',
      }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({
        ...permission.toSnapshot(),
        action: 'BAD ACTION',
      }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({ ...permission.toSnapshot(), code: 'bad' }),
    ).toThrow();
    expect(() =>
      PermissionEntity.create({
        ...permission.toSnapshot(),
        code: 'leads.write',
      }),
    ).toThrow();

    const permissionErrorsToInstantiate = [
      permissionErrors.PermissionNotFoundException,
      permissionErrors.PermissionAlreadyExistsException,
      permissionErrors.PermissionResourceActionAlreadyExistsException,
      permissionErrors.PermissionInUseException,
      permissionErrors.SystemPermissionProtectedException,
      permissionErrors.PermissionUpdateNotAllowedException,
      permissionErrors.PermissionDeleteNotAllowedException,
      permissionErrors.UnauthorizedPermissionOperationException,
      permissionErrors.ForbiddenPermissionOperationException,
    ];
    for (const ErrorType of permissionErrorsToInstantiate) {
      expect(new ErrorType()).toBeInstanceOf(Error);
    }
    expect(
      new permissionErrors.InvalidPermissionException('CUSTOM', 'message'),
    ).toBeInstanceOf(Error);

    expect(normalizeRoleName('  Role   Name ')).toBe('Role Name');
    expect(normalizeRoleCode('  SALES ')).toBe('sales');
    expect(isProtectedRoleCode(' Admin ')).toBe(true);
    expect(isProtectedRoleCode('staff')).toBe(false);
    const role = RoleEntity.create({
      uuid,
      name: '  Staff ',
      code: ' STAFF ',
      description: ' Description ',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      isSystem: false,
    });
    role.update({ name: ' Manager ', description: null, isActive: false });
    expect(role.name).toBe('Manager');
    expect(role.description).toBeNull();
    expect(role.isActive).toBe(false);
    expect(() =>
      RoleEntity.create({ ...role.toSnapshot(), uuid: 'bad' }),
    ).toThrow();
    expect(() =>
      RoleEntity.create({ ...role.toSnapshot(), name: '' }),
    ).toThrow();
    expect(() =>
      RoleEntity.create({ ...role.toSnapshot(), code: 'Bad Code' }),
    ).toThrow();
    expect(() =>
      RoleEntity.create({
        ...role.toSnapshot(),
        code: 'admin',
        isSystem: false,
        isActive: true,
      }),
    ).toThrow();
    expect(() =>
      RoleEntity.create({
        ...role.toSnapshot(),
        code: 'admin',
        isSystem: true,
        isActive: false,
      }),
    ).toThrow();

    const assignment = RolePermissionEntity.create({
      roleUuid: uuid,
      permissionUuid: uuid2,
      createdAt: now,
      updatedAt: now,
    });
    expect(assignment.toSnapshot()).toMatchObject({
      roleUuid: uuid,
      permissionUuid: uuid2,
    });
    expect(() =>
      RolePermissionEntity.create({
        ...assignment.toSnapshot(),
        roleUuid: 'bad',
      }),
    ).toThrow();
    expect(() =>
      RolePermissionEntity.create({
        ...assignment.toSnapshot(),
        permissionUuid: 'bad',
      }),
    ).toThrow();
  });

  it('covers property preference validation branches', () => {
    const base = {
      transactionTypes: ['SALE'] as const,
      propertyTypeUuids: [uuid],
      propertyCategoryUuids: [],
      hardCriteria: ['transactionType', 'propertyType'] as const,
    };
    const preference = PropertyPreference.create({ ...base, version: 2 });
    expect(preference.value.version).toBe(2);
    expect(preference.withVersion(3).value.version).toBe(3);
    expect(() => preference.withVersion(2)).toThrow();
    expect(() => PropertyPreference.create({ ...base, version: 0 })).toThrow();
    expect(() =>
      PropertyPreference.create({
        transactionTypes: [],
        propertyTypeUuids: [],
        propertyCategoryUuids: [],
        hardCriteria: [],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({ ...base, propertyTypeUuids: ['bad'] }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        hardCriteria: ['unknown'] as never,
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        transactionTypes: [],
        hardCriteria: ['transactionType'],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        propertyTypeUuids: [],
        hardCriteria: ['propertyType'],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        propertyCategoryUuids: [],
        hardCriteria: ['propertyCategory'],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        location: undefined,
        hardCriteria: ['location'],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.create({
        ...base,
        budget: undefined,
        hardCriteria: ['budget'],
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'ID',
        frequency: 'TOTAL',
        min: '1',
        max: '2',
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'IDR',
        frequency: 'BAD' as never,
        min: '1',
        max: '2',
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'IDR',
        frequency: 'TOTAL',
        min: '2',
        max: '1',
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'IDR',
        frequency: 'TOTAL',
        min: '-1',
        max: '2',
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertBudget({
        currency: 'IDR',
        frequency: 'TOTAL',
        min: '1',
        max: '2',
        tolerancePercent: 101,
      }),
    ).toThrow();
    expect(() => PropertyPreference.assertLocation({ latitude: 1 })).toThrow();
    expect(() => PropertyPreference.assertLocation({ radiusKm: 1 })).toThrow();
    expect(() =>
      PropertyPreference.assertLocation({ latitude: 91, longitude: 1 }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertLocation({ latitude: 1, longitude: 181 }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertLocation({
        radiusKm: 501,
        latitude: 1,
        longitude: 1,
      }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertSpecification({ bedrooms: { min: 2.5 } }),
    ).toThrow();
    expect(() =>
      PropertyPreference.assertSpecification({
        bathrooms: { min: '2', max: '1' },
      }),
    ).toThrow();
    expect(PropertyPreference.assertBudget(undefined)).toBeUndefined();
    expect(PropertyPreference.assertLocation(undefined)).toBeUndefined();
    expect(PropertyPreference.assertSpecification(undefined)).toBeUndefined();
  });
});
