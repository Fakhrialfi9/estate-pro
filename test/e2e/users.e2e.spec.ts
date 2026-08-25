import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let jwt: JwtService;
const ACTOR_UUID = '550e8400-e29b-41d4-a716-446655440001';

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
  INDEX idx_auth_users_status (status),
  INDEX idx_auth_users_is_active (is_active),
  INDEX idx_auth_users_deleted_at (deleted_at),
  INDEX idx_auth_users_status_deleted_at (status, deleted_at),
  INDEX idx_auth_users_active_deleted_at (is_active, deleted_at)
) ENGINE=InnoDB;`;

const actorToken = (permissions: string[] = ['users:manage']) => jwt.sign({ sub: ACTOR_UUID, permissions });

describe('Users API', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await prisma.$executeRawUnsafe(CREATE_TABLE);
  });

  beforeEach(async () => {
    await prisma.authenticationUser.deleteMany();
    await prisma.authenticationUser.create({ data: { uuid: ACTOR_UUID, email: 'actor@example.com', status: 'active', isActive: true } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous access', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('creates, reads, searches, updates, and soft-deletes a user without leaking credentials', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ username: 'john', email: 'john@example.com', phone: '+62123456789' })
      .expect(201);

    const uuid = create.body.uuid as string;
    expect(create.body.password).toBeUndefined();
    expect(create.body.passwordHash).toBeUndefined();
    expect(create.body.secret).toBeUndefined();
    expect(create.body.sessionToken).toBeUndefined();
    expect(create.body.twoFactorSecret).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(200)
      .expect((response) => expect(response.body.uuid).toBe(uuid));

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${actorToken()}`)
      .query({ page: 1, limit: 10, sortBy: 'createdAt', sortDirection: 'desc', search: 'john' })
      .expect(200)
      .expect((response) => {
        expect(response.body.meta.total).toBe(1);
        expect(response.body.items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'john.updated@example.com', isActive: false })
      .expect(200)
      .expect((response) => {
        expect(response.body.email).toBe('john.updated@example.com');
        expect(response.body.isActive).toBe(false);
      });

    await request(app.getHttpServer()).get(`/api/v1/users/${uuid}`).set('Authorization', `Bearer ${actorToken()}`).expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(204);

    const stored = await prisma.authenticationUser.findUnique({ where: { uuid } });
    expect(stored?.deletedAt).toBeTruthy();
    expect(stored?.isActive).toBe(false);
    expect(stored?.status).toBe('inactive');

    await request(app.getHttpServer()).get(`/api/v1/users/${uuid}`).set('Authorization', `Bearer ${actorToken()}`).expect(404);
  });

  it('rejects duplicate identity', async () => {
    const auth = `Bearer ${actorToken()}`;
    await request(app.getHttpServer()).post('/api/v1/users').set('Authorization', auth).send({ email: 'duplicate@example.com' }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/users').set('Authorization', auth).send({ email: 'duplicate@example.com' }).expect(409);
  });

  it('does not allow an authenticated user to read another user without management permission', async () => {
    const create = await request(app.getHttpServer()).post('/api/v1/users').set('Authorization', `Bearer ${actorToken()}`).send({ email: 'other@example.com' }).expect(201);
    const readOnlyToken = jwt.sign({ sub: ACTOR_UUID, permissions: ['users:read'] });
    await request(app.getHttpServer()).get(`/api/v1/users/${create.body.uuid}`).set('Authorization', `Bearer ${readOnlyToken}`).expect(403);
  });
});
