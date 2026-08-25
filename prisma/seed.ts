import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.ts';
import type { Prisma } from './generated/prisma/client.ts';
import argon2 from 'argon2';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'fakhrialfi9@example.com';
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'fakhrialfi9';
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+6289644922233';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Q2@mK7xZa9Lp';

const ADMIN_ROLE = {
  name: 'Administrator',
  code: 'ADMIN',
  description: 'Full administrative access for development and testing.',
};

type DatabaseClient = Prisma.TransactionClient;

type PermissionSeed = {
  name: string;
  code: string;
  module: string;
  domain: string;
  action: string;
};

const PERMISSIONS: PermissionSeed[] = [
  {
    name: 'View Users',
    code: 'users.read',
    module: 'users',
    domain: 'users',
    action: 'read',
  },
  {
    name: 'Create Users',
    code: 'users.create',
    module: 'users',
    domain: 'users',
    action: 'create',
  },
  {
    name: 'Update Users',
    code: 'users.update',
    module: 'users',
    domain: 'users',
    action: 'update',
  },
  {
    name: 'Delete Users',
    code: 'users.delete',
    module: 'users',
    domain: 'users',
    action: 'delete',
  },
  {
    name: 'View Roles',
    code: 'roles.read',
    module: 'roles',
    domain: 'roles',
    action: 'read',
  },
  {
    name: 'Create Roles',
    code: 'roles.create',
    module: 'roles',
    domain: 'roles',
    action: 'create',
  },
  {
    name: 'Update Roles',
    code: 'roles.update',
    module: 'roles',
    domain: 'roles',
    action: 'update',
  },
  {
    name: 'Delete Roles',
    code: 'roles.delete',
    module: 'roles',
    domain: 'roles',
    action: 'delete',
  },
  {
    name: 'Manage Roles',
    code: 'roles.manage',
    module: 'roles',
    domain: 'roles',
    action: 'manage',
  },
  {
    name: 'View Permissions',
    code: 'permissions.read',
    module: 'permissions',
    domain: 'permissions',
    action: 'read',
  },
  {
    name: 'Create Permissions',
    code: 'permissions.create',
    module: 'permissions',
    domain: 'permissions',
    action: 'create',
  },
  {
    name: 'Update Permissions',
    code: 'permissions.update',
    module: 'permissions',
    domain: 'permissions',
    action: 'update',
  },
  {
    name: 'Delete Permissions',
    code: 'permissions.delete',
    module: 'permissions',
    domain: 'permissions',
    action: 'delete',
  },
  {
    name: 'Manage Permissions',
    code: 'permissions.manage',
    module: 'permissions',
    domain: 'permissions',
    action: 'manage',
  },
  {
    name: 'Manage Protected Roles',
    code: 'roles.manage.protected',
    module: 'roles',
    domain: 'manage',
    action: 'protected',
  },
  {
    name: 'Manage Protected Permissions',
    code: 'permissions.manage.protected',
    module: 'permissions',
    domain: 'manage',
    action: 'protected',
  },
];

function createAdapter(): PrismaMariaDb {
  return new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'dev',
    password: process.env.DATABASE_PASSWORD ?? 'dev123',
    database: process.env.DATABASE_NAME ?? 'estate_pro',
    connectionLimit: Number(process.env.DATABASE_POOL_CONNECTION_LIMIT ?? 10),
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  });
}

async function upsertPermissions(
  client: DatabaseClient,
): Promise<Map<string, bigint>> {
  const permissionIds = new Map<string, bigint>();

  for (const permission of PERMISSIONS) {
    const record = await client.authorizationPermission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
      create: {
        uuid: randomUUID(),
        name: permission.name,
        code: permission.code,
        module: permission.module,
        domain: permission.domain,
        action: permission.action,
      },
    });

    permissionIds.set(permission.code, record.id);
  }

  return permissionIds;
}

async function upsertAdminRole(client: DatabaseClient): Promise<bigint> {
  const role = await client.authorizationRole.upsert({
    where: { code: ADMIN_ROLE.code },
    update: {
      name: ADMIN_ROLE.name,
      description: ADMIN_ROLE.description,
      isActive: true,
    },
    create: {
      uuid: randomUUID(),
      name: ADMIN_ROLE.name,
      code: ADMIN_ROLE.code,
      description: ADMIN_ROLE.description,
      isActive: true,
    },
  });

  return role.id;
}

async function ensureRolePermissions(
  client: DatabaseClient,
  roleId: bigint,
  permissionIds: Map<string, bigint>,
): Promise<void> {
  for (const permission of PERMISSIONS) {
    const permissionId = permissionIds.get(permission.code);
    if (permissionId === undefined) {
      throw new Error(`Missing seeded permission: ${permission.code}`);
    }

    await client.authorizationRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId,
      },
    });
  }
}

async function upsertAdminUser(
  client: DatabaseClient,
  passwordHash: string,
): Promise<bigint> {
  const user = await client.authenticationUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      username: ADMIN_USERNAME,
      phone: ADMIN_PHONE,
      status: 'active',
      isActive: true,
      isVerified: true,
      deletedAt: null,
    },
    create: {
      uuid: randomUUID(),
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      status: 'active',
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

async function ensureUserRole(
  client: DatabaseClient,
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

async function seed(): Promise<void> {
  const adapter = createAdapter();
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.AUTH_ARGON2_MEMORY_COST ?? 19456),
      timeCost: Number(process.env.AUTH_ARGON2_TIME_COST ?? 2),
      parallelism: Number(process.env.AUTH_ARGON2_PARALLELISM ?? 1),
    });

    await prisma.$transaction(async (tx) => {
      const permissionIds = await upsertPermissions(tx);
      const roleId = await upsertAdminRole(tx);
      await ensureRolePermissions(tx, roleId, permissionIds);
      const userId = await upsertAdminUser(tx, passwordHash);
      await ensureUserRole(tx, userId, roleId);
    });

    console.log(`Seeded admin account: ${ADMIN_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

await seed();
