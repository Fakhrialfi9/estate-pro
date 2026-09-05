import argon2 from 'argon2';

import type { SeedTransaction } from '../database.ts';
import { ARGON2_CONFIG } from '../config.ts';
import { SEED_REFERENCE_DATE } from '../shared/ids.ts';
import { ADMIN_USER, SEED_USERS, type UserSeed } from './data.ts';

export type PreparedUserSeed = UserSeed & { passwordHash: string };

export async function prepareUserSeed(seed: UserSeed): Promise<PreparedUserSeed> {
  return {
    ...seed,
    passwordHash: await argon2.hash(seed.password, {
      type: argon2.argon2id,
      ...ARGON2_CONFIG,
    }),
  };
}

async function upsertSeedUser(
  client: SeedTransaction,
  seed: PreparedUserSeed,
): Promise<bigint> {
  const [userByEmail, userByUsername] = await Promise.all([
    client.authenticationUser.findUnique({
      where: { email: seed.email },
      select: { id: true, uuid: true },
    }),
    client.authenticationUser.findUnique({
      where: { username: seed.username },
      select: { id: true, uuid: true },
    }),
  ]);

  if (userByEmail && userByUsername && userByEmail.id !== userByUsername.id) {
    throw new Error(
      `Seed user identity conflict: email ${seed.email} and username ${seed.username} belong to different users.`,
    );
  }

  const existingUserId = userByEmail?.id ?? userByUsername?.id;
  const user = existingUserId
    ? await client.authenticationUser.update({
        where: { id: existingUserId },
        data: {
          uuid: seed.uuid,
          username: seed.username,
          email: seed.email,
          phone: seed.phone,
          status: seed.status,
          isActive: seed.status === 'active',
          isVerified: true,
          deletedAt: null,
        },
      })
    : await client.authenticationUser.create({
        data: {
          uuid: seed.uuid,
          username: seed.username,
          email: seed.email,
          phone: seed.phone,
          status: seed.status,
          isActive: seed.status === 'active',
          isVerified: true,
        },
      });

  await client.authenticationUserCredential.upsert({
    where: { userId: user.id },
    update: {
      passwordHash: seed.passwordHash,
      passwordChangedAt: SEED_REFERENCE_DATE,
    },
    create: {
      userId: user.id,
      passwordHash: seed.passwordHash,
      passwordChangedAt: SEED_REFERENCE_DATE,
    },
  });

  await client.authenticationUserSecurity.upsert({
    where: { userId: user.id },
    update: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      userId: user.id,
      failedLoginAttempts: 0,
    },
  });

  return user.id;
}

export async function seedAdminUser(
  client: SeedTransaction,
  seed: PreparedUserSeed,
): Promise<bigint> {
  return upsertSeedUser(client, seed);
}

export async function seedDevelopmentUsers(
  client: SeedTransaction,
  seeds: readonly PreparedUserSeed[],
): Promise<readonly bigint[]> {
  const userIds: bigint[] = [];

  for (const user of seeds) {
    userIds.push(await upsertSeedUser(client, user));
  }

  return userIds;
}

export async function assignAdminRole(
  client: SeedTransaction,
  userId: bigint,
  roleId: bigint,
): Promise<void> {
  await client.authorizationUserRole.upsert({
    where: {
      userId_roleId: { userId, roleId },
    },
    update: {
      isActive: true,
      revokedAt: null,
    },
    create: {
      userId,
      roleId,
      isActive: true,
      assignedBy: userId,
      assignedAt: SEED_REFERENCE_DATE,
    },
  });
}

export { ADMIN_USER, SEED_USERS };
