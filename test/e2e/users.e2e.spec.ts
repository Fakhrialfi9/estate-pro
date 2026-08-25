import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response as SuperTestResponse } from 'supertest';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/bootstrap.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

type UserResponse = {
  uuid: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};
type UserListResponse = {
  items: UserResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
let app: INestApplication;
let prisma: PrismaService;
let jwt: JwtService;
let actorUuid: string;
let clientIp = '10.0.0.1';
let clientIpCounter = 1;

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS authentication_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  username VARCHAR(100) NULL UNIQUE,
  email VARCHAR(191) NULL UNIQUE,
  phone VARCHAR(30) NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  INDEX idx_auth_users_status (status), INDEX idx_auth_users_is_active (is_active), INDEX idx_auth_users_deleted_at (deleted_at), INDEX idx_auth_users_status_deleted_at (status, deleted_at), INDEX idx_auth_users_active_deleted_at (is_active, deleted_at)
) ENGINE=InnoDB;`;
const CREATE_SESSION_TABLE = `CREATE TABLE IF NOT EXISTS authentication_user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, session_id VARCHAR(64) NOT NULL UNIQUE, ip_address VARCHAR(45) NULL, user_agent TEXT NULL, last_activity_at DATETIME(3) NULL, revoked_at DATETIME(3) NULL, expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_auth_user_sessions_user FOREIGN KEY (user_id) REFERENCES authentication_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_auth_user_sessions_user_id (user_id), INDEX idx_auth_user_sessions_revoked_at (revoked_at), INDEX idx_auth_user_sessions_expires_at (expires_at)
) ENGINE=InnoDB;`;
const CREATE_AUDIT_LOG_TABLE = `CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, uuid CHAR(36) NOT NULL UNIQUE, actor_user_id BIGINT UNSIGNED NULL, user_id BIGINT UNSIGNED NULL, action VARCHAR(100) NOT NULL, actor_type VARCHAR(24) NOT NULL DEFAULT 'SYSTEM', entity_type VARCHAR(100) NULL, entity_id BIGINT UNSIGNED NULL, resource_id VARCHAR(100) NULL, result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS', reason VARCHAR(100) NULL, ip_address VARCHAR(45) NULL, user_agent TEXT NULL, request_id VARCHAR(100) NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_logs_actor_user FOREIGN KEY (actor_user_id) REFERENCES authentication_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES authentication_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_audit_logs_actor_user_id (actor_user_id), INDEX idx_audit_logs_user_id (user_id), INDEX idx_audit_logs_action (action), INDEX idx_audit_logs_entity_type (entity_type), INDEX idx_audit_logs_entity_id (entity_id), INDEX idx_audit_logs_resource_id (resource_id), INDEX idx_audit_logs_result (result), INDEX idx_audit_logs_request_id (request_id), INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB;`;
const CREATE_AUDIT_CHANGE_TABLE = `CREATE TABLE IF NOT EXISTS audit_log_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, audit_log_id BIGINT UNSIGNED NOT NULL, field VARCHAR(100) NOT NULL, old_value JSON NULL, new_value JSON NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_log_changes_audit_log FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON UPDATE CASCADE ON DELETE CASCADE, INDEX idx_audit_log_changes_audit_log_id (audit_log_id)
) ENGINE=InnoDB;`;
const USER_MANAGEMENT_PERMISSIONS = [
  'users.create',
  'users.read',
  'users.update',
  'users.delete',
] as const;
type SuperTestApp = Parameters<typeof request>[0];
const httpRequest = () => request(app.getHttpServer() as SuperTestApp);
const bodyOf = <T>(response: SuperTestResponse): T => response.body as T;
const actorToken = (permissions: string[] = [...USER_MANAGEMENT_PERMISSIONS]) =>
  jwt.sign({ sub: actorUuid, sid: randomUUID(), permissions });
const stringifyForAssertion = (value: unknown): string =>
  JSON.stringify(value, (_key: string, nestedValue: unknown): unknown =>
    typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue,
  );

describe('Users API', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app as Parameters<typeof configureApplication>[0]);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await prisma.$executeRawUnsafe(CREATE_TABLE);
    await prisma.$executeRawUnsafe(CREATE_SESSION_TABLE);
    await prisma.$executeRawUnsafe(CREATE_AUDIT_LOG_TABLE);
    await prisma.$executeRawUnsafe(CREATE_AUDIT_CHANGE_TABLE);
  });
  beforeEach(async () => {
    clientIp = `10.0.0.${clientIpCounter}`;
    clientIpCounter += 1;
    await prisma.auditLogChange.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.authenticationUserSession.deleteMany();
    await prisma.authenticationUser.deleteMany();
    actorUuid = randomUUID();
    await prisma.authenticationUser.create({
      data: {
        uuid: actorUuid,
        email: `actor-${actorUuid}@example.com`,
        status: 'active',
        isActive: true,
      },
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous access', async () => {
    await httpRequest()
      .get('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .expect(401);
  });
  it('rejects malformed and credential-bearing create payloads', async () => {
    await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'not-an-email' })
      .expect(400);
    await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({
        email: 'valid@example.com',
        password: 'should-never-be-accepted',
      })
      .expect(400);
  });
  it('creates, reads, searches, updates, and soft-deletes a user without leaking credentials or audit secrets', async () => {
    const create = await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('X-Request-ID', 'req-user-create')
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({
        username: 'john',
        email: 'john@example.com',
        phone: '+62123456789',
      })
      .expect(201);
    const created = bodyOf<UserResponse & Record<string, unknown>>(create);
    const uuid = created.uuid;
    expect(created.password).toBeUndefined();
    expect(created.passwordHash).toBeUndefined();
    const createdAudit = await prisma.auditLog.findFirst({
      where: { action: 'USER_CREATED', resourceId: uuid },
      orderBy: { createdAt: 'desc' },
      include: { changes: true },
    });
    expect(createdAudit?.actorType).toBe('AUTHENTICATED');
    expect(createdAudit?.requestId).toBe('req-user-create');
    expect(createdAudit?.result).toBe('SUCCESS');
    const serializedAudit = stringifyForAssertion(createdAudit);
    expect(serializedAudit).not.toContain('password');
    expect(serializedAudit).not.toContain('token');
    await httpRequest()
      .get(`/api/v1/users/${uuid}`)
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(200);
    const list = await httpRequest()
      .get('/api/v1/users?page=1&limit=20&search=john')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(200);
    expect(
      bodyOf<UserListResponse>(list).items.some((item) => item.uuid === uuid),
    ).toBe(true);
    await httpRequest()
      .patch(`/api/v1/users/${uuid}`)
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ username: 'john-updated' })
      .expect(200);
    const updateAudit = await prisma.auditLog.findFirst({
      where: { action: 'USER_UPDATED', resourceId: uuid },
      orderBy: { createdAt: 'desc' },
      include: { changes: true },
    });
    expect(
      updateAudit?.changes.some((change) => change.field === 'username'),
    ).toBe(true);
    await httpRequest()
      .delete(`/api/v1/users/${uuid}`)
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(204);
    expect(
      await prisma.auditLog.count({
        where: { action: 'USER_DELETED', resourceId: uuid },
      }),
    ).toBe(1);
  });
  it('rejects duplicate identity', async () => {
    await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'duplicate@example.com' })
      .expect(201);
    await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'duplicate@example.com' })
      .expect(409);
  });
  it('does not allow an authenticated user to read another user without management permission', async () => {
    const create = await httpRequest()
      .post('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'other@example.com' })
      .expect(201);
    const created = bodyOf<UserResponse>(create);
    const readOnlyToken = jwt.sign({
      sub: actorUuid,
      sid: randomUUID(),
      permissions: [],
    });
    await httpRequest()
      .get(`/api/v1/users/${created.uuid}`)
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(403);
  });
  it('rejects inactive actors before user management access', async () => {
    await prisma.authenticationUser.update({
      where: { uuid: actorUuid },
      data: { isActive: false },
    });
    await httpRequest()
      .get('/api/v1/users')
      .set('X-Forwarded-For', clientIp)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(401);
  });
});
