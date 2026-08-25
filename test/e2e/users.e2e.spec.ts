import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
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

const httpRequest = () => request(app.getHttpServer() as unknown as Server);
const bodyOf = <T>(response: SuperTestResponse): T => response.body as T;
const actorToken = (permissions: string[] = ['users:manage']) =>
  jwt.sign({ sub: ACTOR_UUID, permissions });

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
  });

  beforeEach(async () => {
    await prisma.authenticationUser.deleteMany();
    await prisma.authenticationUser.create({
      data: {
        uuid: ACTOR_UUID,
        email: 'actor@example.com',
        status: 'active',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous access', async () => {
    await httpRequest().get('/api/v1/users').expect(401);
  });

  it('rejects malformed and credential-bearing create payloads', async () => {
    await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ email: 'not-an-email' })
      .expect(400);

    await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({
        email: 'valid@example.com',
        password: 'should-never-be-accepted',
      })
      .expect(400);
  });

  it('creates, reads, searches, updates, and soft-deletes a user without leaking credentials', async () => {
    const create = await httpRequest()
      .post('/api/v1/users')
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

    await httpRequest()
      .get(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(200);

    const list = await httpRequest()
      .get('/api/v1/users?page=1&limit=20&search=john')
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(200);
    const payload = bodyOf<UserListResponse>(list);
    expect(payload.items.some((item) => item.uuid === uuid)).toBe(true);

    await httpRequest()
      .patch(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .send({ firstName: 'John' })
      .expect(200);

    await httpRequest()
      .delete(`/api/v1/users/${uuid}`)
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(204);
  });

  it('rejects duplicate identity', async () => {
    await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', actorToken())
      .send({ email: 'duplicate@example.com' })
      .expect(201);

    await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', actorToken())
      .send({ email: 'duplicate@example.com' })
      .expect(409);
  });

  it('does not allow an authenticated user to read another user without management permission', async () => {
    const create = await httpRequest()
      .post('/api/v1/users')
      .set('Authorization', actorToken())
      .send({ email: 'other@example.com' })
      .expect(201);
    const created = bodyOf<UserResponse>(create);
    const readOnlyToken = jwt.sign({ sub: ACTOR_UUID, permissions: [] });

    await httpRequest()
      .get(`/api/v1/users/${created.uuid}`)
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .expect(403);
  });

  it('rejects inactive actors before user management access', async () => {
    await prisma.authenticationUser.update({
      where: { uuid: ACTOR_UUID },
      data: { isActive: false },
    });

    await httpRequest()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${actorToken()}`)
      .expect(401);
  });
});
