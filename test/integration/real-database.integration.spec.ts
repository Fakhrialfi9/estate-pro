import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { UserManagementService } from '../../src/modules/users/application/services/user-management.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';
import { CredentialService } from '../../src/modules/users/credentials/application/services/credential.service.js';
import { randomUUID } from 'node:crypto';

const PASSWORD = 'Strong-Test-Password-123!';
let moduleRef: TestingModule;
let prisma: PrismaService;
let users: UserManagementService;
let credentials: CredentialService;
let hasher: PasswordHasherService;

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('Real database integration', () => {
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    users = moduleRef.get(UserManagementService);
    credentials = moduleRef.get(CredentialService);
    hasher = moduleRef.get(PasswordHasherService);
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('persists through application -> repository -> Prisma -> MariaDB and leaves auditable state', async () => {
    const created = await users.create(
      { email: `integration-${randomUUID()}@example.com`, status: 'active' },
      { requestId: 'integration-user-create' },
    );

    const persisted = await prisma.authenticationUser.findUnique({ where: { uuid: created.uuid } });
    expect(persisted?.email).toBe(created.email);
    expect(persisted?.status).toBe('active');
    expect(await prisma.auditLog.count({ where: { action: 'USER_CREATED', userId: persisted?.id } })).toBe(1);

    await credentials.create({ userUuid: created.uuid, password: PASSWORD, confirmation: PASSWORD });
    const credential = await prisma.authenticationUserCredential.findUnique({ where: { userId: persisted!.id } });
    expect(credential?.passwordHash).toEqual(expect.any(String));
    expect(credential?.passwordHash).not.toBe(PASSWORD);
    expect(await hasher.verify(credential!.passwordHash, PASSWORD)).toBe(true);
  });

  it('executes a real Prisma transaction and rolls back all writes on failure', async () => {
    const uuid = randomUUID();
    const email = `rollback-${uuid}@example.com`;
    await expect(
      prisma.$transaction(async (tx) => {
        const user = await tx.authenticationUser.create({
          data: { uuid, email, status: 'active', isActive: true },
        });
        await tx.authenticationUserSecurity.create({ data: { userId: user.id } });
        throw new Error('intentional integration rollback');
      }),
    ).rejects.toThrow('intentional integration rollback');

    expect(await prisma.authenticationUser.findUnique({ where: { uuid } })).toBeNull();
  });

  it('keeps database isolation deterministic across test records', async () => {
    const first = await users.create({ email: `isolation-a-${randomUUID()}@example.com` });
    const second = await users.create({ email: `isolation-b-${randomUUID()}@example.com` });
    expect(first.uuid).not.toBe(second.uuid);
    expect(
      await prisma.authenticationUser.count({ where: { uuid: { in: [first.uuid, second.uuid] } } }),
    ).toBe(2);
  });
});
