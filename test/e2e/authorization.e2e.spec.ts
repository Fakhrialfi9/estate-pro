import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/modules/auth/application/services/password-hasher.service.js';

const PASSWORD = 'Strong-Test-Password-123!';
const ROLE_MANAGE = 'roles:manage';
const ROLE_READ = 'roles:read';
const PERMISSION_MANAGE = 'permissions:manage';
const PERMISSION_READ = 'permissions:read';

type LoginResult = { accessToken: string };
type RoleSummary = { uuid: string };
type RoleListResponse = { items: RoleSummary[] };
type RoleAssignmentResponse = {
  user: { uuid: string };
  role: { uuid: string };
};
type SuperTestApp = Parameters<typeof request>[0];

let app: NestExpressApplication;
let prisma: PrismaService;
let hasher: PasswordHasherService;
let adminUuid = '';
let readerUuid = '';
let targetUuid = '';
let roleUuid = '';
let roleId = 0n;
let rolePermissionId = 0n;

const httpRequest = () => {
  const server = app.getHttpServer() as unknown as SuperTestApp;
  return request(server);
};
const bodyOf = <T>(response: request.Response): T => response.body;

async function createUser(
  email: string,
): Promise<{ uuid: string; id: bigint }> {
  const user = await prisma.authenticationUser.create({
    data: {
      uuid: randomUUID(),
      email,
      status: 'active',
      isActive: true,
      isVerified: true,
    },
  });
  await prisma.authenticationUserCredential.create({
    data: { userId: user.id, passwordHash: await hasher.hash(PASSWORD) },
  });
  await prisma.authenticationUserSecurity.create({ data: { userId: user.id } });
  return { uuid: user.uuid, id: user.id };
}

async function login(uuid: string): Promise<string> {
  const user = await prisma.authenticationUser.findUniqueOrThrow({
    where: { uuid },
  });
  const response = await httpRequest()
    .post('/api/v1/auth/login')
    .send({ identifier: user.email, password: PASSWORD })
    .expect(201);
  return bodyOf<LoginResult>(response).accessToken;
}

async function cleanup(): Promise<void> {
  await prisma.auditLogChange.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authorizationUserRole.deleteMany();
  await prisma.authorizationRolePermission.deleteMany();
  await prisma.authorizationRole.deleteMany();
  await prisma.authorizationPermission.deleteMany();
  await prisma.authenticationUserTwoFactorChallenge.deleteMany();
  await prisma.authenticationUserTwoFactorRecoveryCode.deleteMany();
  await prisma.authenticationUserTwoFactor.deleteMany();
  await prisma.authenticationRefreshToken.deleteMany();
  await prisma.authenticationRefreshTokenFamily.deleteMany();
  await prisma.authenticationUserSession.deleteMany();
  await prisma.authenticationUserCredential.deleteMany();
  await prisma.authenticationUserSecurity.deleteMany();
  await prisma.authenticationUser.deleteMany();
}

describe('Authorization and RBAC E2E', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasherService);
  });

  beforeEach(async () => {
    await cleanup();
    const admin = await createUser(`rbac-admin-${randomUUID()}@example.com`);
    const reader = await createUser(`rbac-reader-${randomUUID()}@example.com`);
    const target = await createUser(`rbac-target-${randomUUID()}@example.com`);
    adminUuid = admin.uuid;
    readerUuid = reader.uuid;
    targetUuid = target.uuid;

    const permissionManage = await prisma.authorizationPermission.create({
      data: {
        uuid: randomUUID(),
        name: 'Manage roles',
        code: ROLE_MANAGE,
        module: 'authorization',
        domain: 'roles',
        action: 'manage',
      },
    });
    const permissionRead = await prisma.authorizationPermission.create({
      data: {
        uuid: randomUUID(),
        name: 'Read roles',
        code: ROLE_READ,
        module: 'authorization',
        domain: 'roles',
        action: 'read',
      },
    });
    const permissionPermissionManage =
      await prisma.authorizationPermission.create({
        data: {
          uuid: randomUUID(),
          name: 'Manage permissions',
          code: PERMISSION_MANAGE,
          module: 'authorization',
          domain: 'permissions',
          action: 'manage',
        },
      });
    const permissionPermissionRead =
      await prisma.authorizationPermission.create({
        data: {
          uuid: randomUUID(),
          name: 'Read permissions',
          code: PERMISSION_READ,
          module: 'authorization',
          domain: 'permissions',
          action: 'read',
        },
      });

    const role = await prisma.authorizationRole.create({
      data: {
        uuid: randomUUID(),
        name: 'RBAC Administrator',
        code: `rbac-admin-${randomUUID()}`,
        description: 'E2E test role',
        isActive: true,
      },
    });
    roleUuid = role.uuid;
    roleId = role.id;

    await prisma.authorizationRolePermission.createMany({
      data: [
        { roleId: role.id, permissionId: permissionManage.id },
        { roleId: role.id, permissionId: permissionRead.id },
        { roleId: role.id, permissionId: permissionPermissionManage.id },
        { roleId: role.id, permissionId: permissionPermissionRead.id },
      ],
    });
    rolePermissionId = permissionManage.id;
    await prisma.authorizationUserRole.create({
      data: { userId: admin.id, roleId: role.id, assignedBy: admin.id },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('blocks unauthenticated and unprivileged actors, then allows a DB-backed role assignment and removal', async () => {
    await httpRequest().get('/api/v1/roles').expect(401);
    const readerToken = await login(readerUuid);
    await httpRequest()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(403);

    const adminToken = await login(adminUuid);
    const list = await httpRequest()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const listBody = bodyOf<RoleListResponse>(list);
    expect(listBody.items.some((item) => item.uuid === roleUuid)).toBe(true);

    const assignment = await httpRequest()
      .post(`/api/v1/users/${targetUuid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleUuid })
      .expect(201);
    const assignmentBody = bodyOf<RoleAssignmentResponse>(assignment);
    expect(assignmentBody.user.uuid).toBe(targetUuid);
    expect(assignmentBody.role.uuid).toBe(roleUuid);

    const targetRoles = await httpRequest()
      .get(`/api/v1/users/${targetUuid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      JSON.stringify(bodyOf<Record<string, unknown>>(targetRoles)),
    ).toContain(roleUuid);

    await httpRequest()
      .delete(`/api/v1/users/${targetUuid}/roles/${roleUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rolesAfterRemoval = await httpRequest()
      .get(`/api/v1/users/${targetUuid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      JSON.stringify(bodyOf<Record<string, unknown>>(rolesAfterRemoval)),
    ).not.toContain(roleUuid);
  });

  it('covers role CRUD and permission CRUD through the real authorization boundary', async () => {
    const adminToken = await login(adminUuid);
    const role = await httpRequest()
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Temporary Role',
        code: `temporary-${randomUUID()}`,
        description: 'e2e',
      })
      .expect(201);
    const createdRoleUuid = bodyOf<{ uuid: string }>(role).uuid;
    expect(createdRoleUuid).toMatch(/^[0-9a-f-]{36}$/i);
    await httpRequest()
      .get(`/api/v1/roles/${createdRoleUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await httpRequest()
      .put(`/api/v1/roles/${createdRoleUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Temporary Role' })
      .expect(200);
    await httpRequest()
      .delete(`/api/v1/roles/${createdRoleUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const createdPermission = await httpRequest()
      .post('/api/v1/permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Read test resource',
        module: 'testing',
        domain: 'resource',
        action: 'read',
      })
      .expect(201);
    const permissionUuid = bodyOf<{ uuid: string }>(createdPermission).uuid;
    expect(permissionUuid).toMatch(/^[0-9a-f-]{36}$/i);
    await httpRequest()
      .get(`/api/v1/permissions/${permissionUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await httpRequest()
      .put(`/api/v1/permissions/${permissionUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Read updated test resource' })
      .expect(200);

    await httpRequest()
      .post(`/api/v1/roles/${roleUuid}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionUuid })
      .expect(201);
    const rolePermissions = await httpRequest()
      .get(`/api/v1/roles/${roleUuid}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      JSON.stringify(bodyOf<Record<string, unknown>>(rolePermissions)),
    ).toContain(permissionUuid);

    await httpRequest()
      .delete(`/api/v1/roles/${roleUuid}/permissions/${permissionUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await httpRequest()
      .delete(`/api/v1/permissions/${permissionUuid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('revokes a role permission in the database and blocks the corresponding mutation capability', async () => {
    const adminToken = await login(adminUuid);
    await httpRequest()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await prisma.authorizationRolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId: rolePermissionId },
      },
    });
    await httpRequest()
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Should be denied', code: `denied-${randomUUID()}` })
      .expect(403);
    await httpRequest()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
