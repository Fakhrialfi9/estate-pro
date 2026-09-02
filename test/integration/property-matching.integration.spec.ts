import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../src/infrastructure/database/database.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import {
  configuration,
  configurationValidationSchema,
} from '../../src/config/configuration.js';
import { PrismaPropertyMatchingRepository } from '../../src/modules/property-matching/infrastructure/prisma-property-matching.repository.js';

describe('Property matching repository integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: PrismaPropertyMatchingRepository;
  const subjectUuid = '88888888-8888-4888-8888-888888888888';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          load: configuration,
          validate: (env: Record<string, unknown>) => {
            const result = configurationValidationSchema.validate(env, {
              abortEarly: false,
              allowUnknown: false,
              stripUnknown: { objects: true },
            });
            if (result.error) throw result.error;
            return result.value as Record<string, unknown>;
          },
          validationOptions: { abortEarly: false, allowUnknown: false },
        }),
        DatabaseModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    repository = new PrismaPropertyMatchingRepository(prisma);
    await prisma.propertyPreference.deleteMany({ where: { subjectUuid } });
  });

  afterAll(async () => {
    await prisma.propertyPreference.deleteMany({ where: { subjectUuid } });
    await app.close();
  });

  it('round-trips preference persistence and rejects stale updates', async () => {
    const created = await repository.createPreference('USER', subjectUuid, {
      version: 1,
      transactionTypes: ['SALE'],
      propertyTypeUuids: [],
      propertyCategoryUuids: [],
      hardCriteria: ['transactionType'],
      budget: {
        min: '500000000',
        max: '1000000000',
        currency: 'IDR',
        frequency: 'TOTAL',
      },
    });
    expect(created.version).toBe(1);
    const updated = await repository.updatePreference('USER', subjectUuid, 1, {
      ...created,
      version: 2,
      budget: { ...created.budget!, max: '1200000000' },
    });
    expect(updated.version).toBe(2);
    await expect(
      repository.updatePreference('USER', subjectUuid, 1, updated),
    ).rejects.toThrow('Preference version is stale');
  });
});
