import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.js';
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

function createClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the Prisma seed.');
  }

  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    connectionLimit: 5,
  });

  return new PrismaClient({ adapter });
}

async function upsertRole(prisma: PrismaClient) {
  return prisma.authorizationRole.upsert({
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
}

async function upsertPermissions(prisma: PrismaClient) {
  return Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.authorizationPermission.upsert({
        where: { code: permission.code },
        update: {
          name: permission.name,
          module: permission.module,
          domain: permission.domain,
          action: permission.action,
        },
        create: {
          uuid: randomUUID(),
          ...permission,
        },
      }),
    ),
  );
}

async function upsertAdminUser(prisma: PrismaClient, passwordHash: string) {
  const user = await prisma.authenticationUser.upsert({
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

  await prisma.authenticationUserCredential.upsert({
    where: { userId: user.id },
    update: {
      passwordHash,
      passwordChangedAt: new Date(),
      passwordExpiresAt: null,
    },
    create: {
      userId: user.id,
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.authenticationUserSecurity.upsert({
    where: { userId: user.id },
    update: {
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      userId: user.id,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      failedLoginAttempts: 0,
    },
  });

  return user;
}

async function main(): Promise<void> {
  const prisma = createClient();

  try {
    const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: Number(process.env.AUTH_ARGON2_MEMORY_COST ?? 19456),
      timeCost: Number(process.env.AUTH_ARGON2_TIME_COST ?? 2),
      parallelism: Number(process.env.AUTH_ARGON2_PARALLELISM ?? 1),
    });

    const admin = await prisma.$transaction(async (tx) => {
      const role = await upsertRole(tx);
      const permissions = await upsertPermissions(tx);
      const user = await upsertAdminUser(tx, passwordHash);

      await tx.authorizationRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });

      await tx.authorizationUserRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {
          isActive: true,
          revokedAt: null,
          assignedBy: user.id,
          assignedAt: new Date(),
        },
        create: {
          userId: user.id,
          roleId: role.id,
          isActive: true,
          assignedBy: user.id,
        },
      });

      return { user, role, permissions };
    });

    console.log(`Seeded admin user: ${admin.user.email}`);
    console.log(`Admin role: ${admin.role.code}`);
    console.log(`Permissions assigned: ${admin.permissions.length}`);
    console.log('Password: value from SEED_ADMIN_PASSWORD or development default.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
