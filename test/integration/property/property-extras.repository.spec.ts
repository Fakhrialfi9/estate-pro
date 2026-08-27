import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/infrastructure/database/prisma/prisma.service.js';
import {
  PROPERTY_EXTRAS_REPOSITORY,
  type PropertyExtrasRepository,
} from '../../../src/modules/property/domain/repositories/property-extras.repository.js';
import { randomUUID } from 'node:crypto';

describe('property extras repository integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repo: PropertyExtrasRepository;
  let propertyUuid: string;
  const actor = { actorUuid: randomUUID() };
  async function property() {
    const t = await prisma.propertyType.create({
      data: {
        uuid: randomUUID(),
        code: `T-${randomUUID().slice(0, 8)}`,
        name: 'House',
        slug: `t-${randomUUID()}`,
      },
    });
    const c = await prisma.propertyCategory.create({
      data: {
        uuid: randomUUID(),
        propertyTypeId: t.id,
        code: `C-${randomUUID().slice(0, 8)}`,
        name: 'Residential',
        slug: `c-${randomUUID()}`,
      },
    });
    return prisma.property.create({
      data: {
        uuid: randomUUID(),
        businessCode: `B-${randomUUID().replaceAll('-', '').slice(0, 24)}`,
        referenceNumber: `R-${randomUUID()}`,
        propertyTypeId: t.id,
        propertyCategoryId: c.id,
        title: 'Integration',
        slug: `p-${randomUUID()}`,
      },
    });
  }
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    app = nest;
    prisma = nest.get(PrismaService);
    repo = nest.get(PROPERTY_EXTRAS_REPOSITORY);
    propertyUuid = (await property()).uuid;
  });
  afterEach(async () => {
    await prisma.propertyMedia.deleteMany();
    await prisma.propertyCertificate.deleteMany();
    await prisma.propertySeo.deleteMany();
    await prisma.propertyEnvironment.deleteMany();
    await prisma.propertySecurity.deleteMany();
    await prisma.propertyFeatures.deleteMany();
    await prisma.propertyFinancial.deleteMany();
    await prisma.propertyLegal.deleteMany();
    await prisma.propertyUtility.deleteMany();
  });
  afterAll(async () => {
    await prisma.property.deleteMany({ where: { uuid: propertyUuid } });
    await app.close();
  });
  it('upserts scoped utilities and supports explicit null clearing', async () => {
    const x = (await repo.upsertUtilities(
      propertyUuid,
      { electricityProvider: 'PLN', electricityCapacityKva: '10.50' },
      actor,
    )) as { electricityProvider: string };
    expect(x.electricityProvider).toBe('PLN');
    const y = (await repo.upsertUtilities(
      propertyUuid,
      { electricityProvider: null },
      actor,
    )) as { electricityProvider: null };
    expect(y.electricityProvider).toBeNull();
  });
  it('masks certificate number and blocks foreign resource access', async () => {
    const c = (await repo.createCertificate(
      propertyUuid,
      { type: 'SHM', number: 'CERT-123456', issueDate: '2026-01-01' },
      actor,
    )) as { numberMasked: string };
    expect(c.numberMasked).toBe('*******3456');
    const other = await property();
    const foreignCertificateUuid = (
      (await repo.createCertificate(
        propertyUuid,
        { type: 'HGB', number: 'X-987654' },
        actor,
      )) as { uuid: string }
    ).uuid;
    await expect(
      repo.updateCertificate(
        other.uuid,
        foreignCertificateUuid,
        { issuer: 'x' },
        actor,
      ),
    ).rejects.toThrow('Certificate not found');
  });
  it('keeps cover unique and requires complete reorder set', async () => {
    const a = (await repo.addMedia(
      propertyUuid,
      {
        type: 'IMAGE',
        url: 'https://cdn.example.test/a.jpg',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        isCover: true,
      },
      actor,
    )) as { uuid: string };
    const b = (await repo.addMedia(
      propertyUuid,
      {
        type: 'IMAGE',
        url: 'https://cdn.example.test/b.jpg',
        mimeType: 'image/jpeg',
        extension: 'jpg',
      },
      actor,
    )) as { uuid: string };
    expect(
      (
        (await repo.listMedia(propertyUuid)) as Array<{ isCover: boolean }>
      ).filter((x) => x.isCover).length,
    ).toBe(1);
    await repo.setCover(propertyUuid, b.uuid, actor);
    expect(
      (
        (await repo.listMedia(propertyUuid)) as Array<{
          uuid: string;
          isCover: boolean;
        }>
      ).find((x) => x.uuid === b.uuid)?.isCover,
    ).toBe(true);
    await expect(
      repo.reorderMedia(propertyUuid, [a.uuid], actor),
    ).rejects.toThrow('every active media');
    await repo.reorderMedia(propertyUuid, [b.uuid, a.uuid], actor);
    const rows = (await repo.listMedia(propertyUuid)) as Array<{
      uuid: string;
      sortOrder: number;
    }>;
    expect(rows.map((x) => x.uuid)).toEqual([b.uuid, a.uuid]);
  });
});
