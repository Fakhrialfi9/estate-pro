import { randomUUID } from 'node:crypto';

import argon2 from 'argon2';
import type { SeedTransaction } from '../database.ts';
import { ARGON2_CONFIG } from '../config.ts';
import { ADMIN_USER } from './data.ts';

export async function seedAdminUser(
  client: SeedTransaction,
): Promise<bigint> {
  const passwordHash = await argon2.hash(ADMIN_USER.password, {
    type: argon2.argon2id,
    ...ARGON2_CONFIG,
  });

  const user = await client.authenticationUser.upsert({
    where: { email: ADMIN_USER.email },
    update: {
      username: ADMIN_USER.username,
      phone: ADMIN_USER.phone,
      status: ADMIN_USER.status,
      isActive: true,
      isVerified: true,
      deletedAt: null,
    },
    create: {
      uuid: randomUUID(),
      username: ADMIN_USER.username,
      email: ADMIN_USER.email,
      phone: ADMIN_USER.phone,
      status: ADMIN_USER.status,
      isActive: true,
      isVerified: true,
    },
  });

  await client.authenticationUserCredential.upsert({
    where: { userId: user.id },
    update: {
      passwordHash,
      passwordChangedAt: new Date(),
    },
    create: {
      userId: user.id,
      passwordHash,
      passwordChangedAt: new Date(),
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

export async function assignAdminRole(
  client: SeedTransaction,
  userId: bigint,
  roleId: bigint,
): Promise<void> {
  await client.authorizationUserRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
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
      assignedAt: new Date(),
    },
  });
}
