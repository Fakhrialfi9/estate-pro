import { randomBytes, randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PrismaSystemWebhookRepository } from '../../src/modules/system/infrastructure/persistence/prisma-system-webhook.repository.js';

const endpoint = 'https://example.test/webhook';

describe('System webhook repository integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: PrismaSystemWebhookRepository;
  let subscriptionId: bigint;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SECURITY_CORS_ORIGINS ??= 'http://localhost:3000';
    process.env.JWT_SECRET ??= 'estate-pro-webhook-integration-secret-32-chars';
    process.env.TWO_FACTOR_ENCRYPTION_KEY ??=
      'estate-pro-two-factor-integration-key-32-chars-minimum';
    process.env.SEED_ADMIN_PASSWORD ??= randomBytes(32).toString('hex');
    process.env.SEED_DEVELOPMENT_USER_PASSWORD ??=
      randomBytes(32).toString('hex');

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(PrismaSystemWebhookRepository);
    await moduleRef.init();

    const subscription = await prisma.systemWebhookSubscription.create({
      data: {
        uuid: randomUUID(),
        endpoint,
        status: 'ACTIVE',
        events: ['system.activity.created'],
        filters: [],
        secretCiphertext: randomBytes(32).toString('hex'),
        secretVersion: 1,
        secretCreatedAt: new Date(),
      },
      select: { id: true },
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    if (subscriptionId !== undefined) {
      await prisma.systemWebhookDelivery.deleteMany({
        where: { subscriptionId },
      });
      await prisma.systemWebhookSubscription.delete({
        where: { id: subscriptionId },
      });
    }
    await moduleRef.close();
  });

  it('persists exactly one delivery for concurrent duplicate event identities', async () => {
    const eventId = `integration-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        repository.createDelivery({
          uuid: randomUUID(),
          subscriptionId,
          eventId,
          deliveryKey: eventId,
          eventName: 'system.activity.created',
          eventVersion: 1,
          payloadHash: `hash-${index}`.padEnd(64, '0').slice(0, 64),
          state: 'PENDING',
          signedAt: new Date(),
        }),
      ),
    );

    const createdCount = results.filter((result) => result.created).length;
    expect(createdCount).toBe(1);
    expect(new Set(results.map((result) => result.record.uuid)).size).toBe(1);

    const persisted = await prisma.systemWebhookDelivery.findMany({
      where: { subscriptionId, eventId },
      select: { uuid: true, eventId: true, deliveryKey: true },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.eventId).toBe(eventId);
    expect(persisted[0]?.deliveryKey).toBe(eventId);
  });
});
