import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CrmService } from '../../../src/modules/crm/application/crm.service.js';

const actor = {
  actorUuid: 'actor-1',
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};
const activeUser = {
  uuid: 'user-1',
  isActive: true,
  deletedAt: null,
};

const makeRepo = () =>
  new Proxy(
    {},
    {
      get: (_target, property) => {
        const name = String(property);
        if (name === 'findProfileByUserUuid') {
          return vi.fn(() => Promise.resolve(null));
        }
        if (name === 'getLead') {
          return vi.fn(() =>
            Promise.resolve({
              uuid: 'lead-1',
              ownerUserUuid: 'user-1',
              score: 10,
              contact: { displayName: 'Alice' },
              source: { code: 'WEB' },
              status: { code: 'NEW' },
              type: { code: 'BUYER' },
            }),
          );
        }
        if (name === 'listScoreRules') {
          return vi.fn(() =>
            Promise.resolve([
              { field: 'score', operator: 'GT', value: 5, points: 10 },
            ]),
          );
        }
        if (name === 'saveScore') {
          return vi.fn(() => Promise.resolve({ uuid: 'lead-1', score: 20 }));
        }
        if (
          name === 'getInquiry' ||
          name === 'getActivity' ||
          name === 'getCommunication' ||
          name === 'getContact'
        ) {
          return vi.fn(() => Promise.resolve({ uuid: 'row-1' }));
        }
        if (name === 'getLeadScore') {
          return vi.fn(() => Promise.resolve({ score: 20 }));
        }
        if (name === 'detectDuplicates') {
          return vi.fn(() => Promise.resolve([]));
        }
        if (name === 'relationship') {
          return vi.fn(() => Promise.resolve({ uuid: 'rel-1' }));
        }
        if (name.startsWith('list')) {
          return vi.fn(() => Promise.resolve([]));
        }
        if (
          name.startsWith('delete') ||
          name.startsWith('archive') ||
          name.startsWith('untag') ||
          name.startsWith('remove')
        ) {
          return vi.fn(() => Promise.resolve(undefined));
        }
        if (
          name.startsWith('add') ||
          name.startsWith('create') ||
          name.startsWith('update') ||
          name.startsWith('change') ||
          name.startsWith('assign') ||
          name.startsWith('unassign') ||
          name.startsWith('tag') ||
          name.startsWith('review') ||
          name.startsWith('merge') ||
          name.startsWith('set') ||
          name.startsWith('upsert') ||
          name.startsWith('convert') ||
          name.startsWith('save')
        ) {
          return vi.fn((...args: unknown[]) => {
            const last = args.at(-1);
            const patch =
              last !== null && typeof last === 'object' && !Array.isArray(last)
                ? (last as Record<string, unknown>)
                : {};
            return Promise.resolve({
              uuid: 'row-1',
              version: 1,
              valueType: 'STRING',
              value: 'ok',
              updatedAt: new Date(),
              ...patch,
            });
          });
        }
        return vi.fn(() => Promise.resolve({ uuid: 'row-1' }));
      },
    },
  ) as never;

const makeAudit = () =>
  ({
    record: vi.fn(() => Promise.resolve(undefined)),
  }) as never;

const makeUserPort = () =>
  ({
    getUser: vi.fn(() => Promise.resolve(activeUser)),
  }) as never;

const makePropertyPort = () =>
  ({
    getProperty: vi.fn(() => Promise.resolve({ uuid: 'property-1' })),
  }) as never;

const service = () =>
  new CrmService(makeRepo(), makeAudit(), makePropertyPort(), makeUserPort());

describe('CrmService coverage', () => {
  it('covers contact CRUD, children, preferences, consent, and relationships', async () => {
    const s = service();
    expect(
      (
        await s.createContact(
          {
            firstName: ' Alice ',
            displayName: 'Alice',
            ownerUserUuid: 'user-1',
          },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    expect((await s.getContact('c')).uuid).toBe('row-1');
    expect(await s.listContacts({ page: 1, limit: 10 })).toEqual([]);
    expect(
      (await s.updateContact('c', { firstName: 'A', lastName: null }, actor))
        .uuid,
    ).toBe('row-1');
    await expect(
      s.updateContact('c', { firstName: '<bad>' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await s.archiveContact('c', actor);
    expect(
      (await s.child('email', 'c', { value: ' User@Example.COM ' }, actor))
        .uuid,
    ).toBe('row-1');
    expect((await s.child('phone', 'c', { value: ' 0812 ' }, actor)).uuid).toBe(
      'row-1',
    );
    expect(
      (
        await s.child(
          'address',
          'c',
          { line1: 'Main 1', countryCode: 'id' },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    await expect(s.child('email', 'c', {}, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      s.child('address', 'c', { line1: 'Main', countryCode: 'IDN' }, actor),
    ).rejects.toThrow('ISO-3166');
    await s.childUpdate('email', 'c', 'cc', { value: 'x@y.com' }, actor);
    await s.childUpdate('phone', 'c', 'cc', { value: '123' }, actor);
    await s.childUpdate('address', 'c', 'cc', { line1: 'Street' }, actor);
    await s.childDelete('email', 'c', 'cc', actor);
    await s.childPrimary('email', 'c', 'cc', actor);
    expect(
      (await s.preferences('c', { contactTime: 'morning' }, actor)).uuid,
    ).toBe('row-1');
    expect((await s.consent('c', { marketing: true }, actor)).uuid).toBe(
      'row-1',
    );
    expect(
      (await s.relationship('c1', 'c2', { type: 'colleague' }, actor)).uuid,
    ).toBe('rel-1');
    await expect(
      s.relationship('same', 'same', {}, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await s.removeRelationship('rel', actor);
  });

  it('covers lead lifecycle, assignment, scoring, duplicate handling and configuration', async () => {
    const s = service();
    expect((await s.createLead({ ownerUserUuid: 'user-1' }, actor)).uuid).toBe(
      'row-1',
    );
    expect((await s.getLead('lead')).uuid).toBe('lead-1');
    expect(await s.listLeads({ page: 1, limit: 10 })).toEqual([]);
    expect((await s.updateLead('lead', { status: 'NEW' }, actor)).uuid).toBe(
      'row-1',
    );
    await s.archiveLead('lead', actor);
    expect((await s.changeStatus('lead', 'QUALIFIED', actor)).uuid).toBe(
      'row-1',
    );
    expect((await s.assign('lead', 'user-1', actor)).uuid).toBe('row-1');
    await expect(s.assign('lead', '', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await s.unassign('lead', actor);
    expect((await s.note('lead', 'A plain note', actor)).uuid).toBe('row-1');
    await expect(s.note('lead', '<script>', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await s.tag('lead', 'hot', actor);
    await s.untag('lead', 'hot', actor);
    expect(await s.history('lead', { page: 1, limit: 10 })).toEqual([]);
    expect((await s.score('lead')).score).toBe(20);
    expect(await s.scoreRules()).toEqual([
      { field: 'score', operator: 'GT', value: 5, points: 10 },
    ]);
    expect(
      (
        await s.createScoreRule(
          { field: 'score', operator: 'GT', points: 5 },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    await expect(
      s.createScoreRule({ field: 'bad', operator: 'GT' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await s.updateScoreRule('r', { field: 'status', operator: 'EQ' }, actor))
        .uuid,
    ).toBe('row-1');
    await expect(
      s.updateScoreRule('r', { operator: 'BAD' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await s.deleteScoreRule('r', actor);
    expect((await s.recalcScore('lead', actor)).factors).toBeDefined();
    expect(await s.duplicates('lead')).toEqual([]);
    expect(await s.duplicateList({ page: 1, limit: 10 })).toEqual([]);
    expect((await s.duplicateReview('dup', 'MERGED', actor)).uuid).toBe(
      'row-1',
    );
    expect((await s.merge('source', 'target', actor)).uuid).toBe('row-1');
    await expect(
      s.configList('invalid', { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await s.configList('source', { page: 1, limit: 10 })).toEqual([]);
    expect((await s.configCreate('source', { code: 'web' }, actor)).uuid).toBe(
      'row-1',
    );
    expect(
      (await s.configUpdate('source', 'c', { name: 'Web' }, actor)).uuid,
    ).toBe('row-1');
    await s.configDelete('source', 'c', actor);
  });

  it('covers inquiry, activity, communication, and templates', async () => {
    const s = service();
    expect(
      (await s.inquiry({ message: 'Hello', propertyUuid: 'property-1' }, actor))
        .uuid,
    ).toBe('row-1');
    expect((await s.inquiry({ message: 'Hello' })).uuid).toBe('row-1');
    await expect(s.inquiry({ message: '<bad>' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((await s.inquiryGet('i')).uuid).toBe('row-1');
    expect(await s.inquiryList({ page: 1, limit: 10 })).toEqual([]);
    expect(
      (await s.inquiryUpdate('i', { message: 'Updated' }, actor)).uuid,
    ).toBe('row-1');
    expect(
      (await s.inquiryConvert('i', { leadUuid: 'lead' }, actor)).uuid,
    ).toBe('row-1');
    expect(
      (await s.activityCreate({ description: 'Call done' }, actor)).uuid,
    ).toBe('row-1');
    await expect(
      s.activityCreate({ description: '<bad>' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await s.activityGet('a')).uuid).toBe('row-1');
    expect(await s.activityList({ page: 1, limit: 10 })).toEqual([]);
    expect(
      (
        await s.activityUpdate(
          'a',
          { subject: 'Subject', description: 'Desc' },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    expect((await s.activityTransition('a', 'DONE', actor)).uuid).toBe('row-1');
    expect((await s.communicationCreate({ body: 'Hello' }, actor)).uuid).toBe(
      'row-1',
    );
    await expect(
      s.communicationCreate({ body: 'Hello', providerSecret: 'secret' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await s.communicationGet('c')).uuid).toBe('row-1');
    expect(await s.communicationList({ page: 1, limit: 10 })).toEqual([]);
    expect(
      (
        await s.communicationTransition(
          'c',
          'SENT',
          { providerMessageId: 'pm' },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    await expect(
      s.communicationTransition(
        'c',
        'SENT',
        { providerSecret: 'secret' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await s.templates({ page: 1, limit: 10 })).toEqual([]);
    expect(
      (
        await s.templateCreate(
          { subject: 'Hi', body: 'Hi {{contact.name}}' },
          actor,
        )
      ).uuid,
    ).toBe('row-1');
    await expect(
      s.templateCreate({ subject: 'Hi', body: '{{unknown.variable}}' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await s.templateUpdate('t', { body: 'Hi {{lead.score}}' }, actor)).uuid,
    ).toBe('row-1');
  });

  it('maps repository errors to stable HTTP exceptions', async () => {
    const repo = {
      getContact: vi.fn(() => Promise.reject(new Error('already exists'))),
    };
    const s = new CrmService(
      repo as never,
      makeAudit(),
      makePropertyPort(),
      makeUserPort(),
    );
    await expect(s.getContact('c')).rejects.toBeInstanceOf(ConflictException);
    repo.getContact.mockImplementationOnce(() =>
      Promise.reject(new Error('not found')),
    );
    await expect(s.getContact('c')).rejects.toBeInstanceOf(NotFoundException);
    repo.getContact.mockImplementationOnce(() =>
      Promise.reject(new Error('bad input')),
    );
    await expect(s.getContact('c')).rejects.toBeInstanceOf(BadRequestException);
    repo.getContact.mockImplementationOnce(() =>
      Promise.reject(new ForbiddenException()),
    );
    await expect(s.getContact('c')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
