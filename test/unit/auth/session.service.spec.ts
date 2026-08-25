import { describe, expect, it, vi } from 'vitest';
import { SessionEntity } from '../../../src/modules/auth/domain/entities/session.entity.js';
import type {
  AuthenticationSessionCreation,
  AuthenticationSessionRepository,
  SessionListQuery,
} from '../../../src/modules/auth/domain/repositories/authentication-session.repository.js';
import { SessionService } from '../../../src/modules/auth/application/services/session.service.js';
import type { SecurityAuditRepository } from '../../../src/modules/auth/domain/repositories/security-audit.repository.js';
import type { SessionSnapshot } from '../../../src/modules/auth/domain/entities/session.entity.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const BASE = new Date('2026-08-25T06:00:00.000Z');

function snapshot(
  id: string,
  userUuid: string,
  secretHash: string,
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot {
  return {
    id,
    userUuid,
    sessionIdHash: secretHash,
    ipAddress: '203.0.113.10',
    userAgent: 'test-browser',
    createdAt: BASE,
    lastActivityAt: BASE,
    revokedAt: null,
    expiresAt: new Date(BASE.getTime() + 15 * 60_000),
    ...overrides,
  };
}

class FakeSessionRepository implements AuthenticationSessionRepository {
  rows: SessionSnapshot[] = [];
  auditCount = 0;

  async create(userUuid: string, session: AuthenticationSessionCreation) {
    const row = snapshot(
      String(this.rows.length + 1),
      userUuid,
      SessionService.digestSecret(session.sessionId),
      { ipAddress: session.ipAddress ?? null, userAgent: session.userAgent ?? null, expiresAt: session.expiresAt },
    );
    this.rows.push(row);
    return row;
  }

  async findBySecret(userUuid: string, sessionId: string) {
    return this.rows.find(
      (row) => row.userUuid === userUuid && row.sessionIdHash === SessionService.digestSecret(sessionId),
    ) ?? null;
  }

  async findById(userUuid: string, id: string) {
    return this.rows.find((row) => row.userUuid === userUuid && row.id === id) ?? null;
  }

  async list(userUuid: string, query: SessionListQuery) {
    return this.rows
      .filter((row) => row.userUuid === userUuid && (query.includeInactive || (row.revokedAt === null && row.expiresAt > BASE)))
      .slice(query.offset, query.offset + query.limit);
  }

  async revokeBySecret(userUuid: string, sessionId: string, now: Date) {
    const row = await this.findBySecret(userUuid, sessionId);
    if (!row || row.revokedAt !== null || row.expiresAt <= now) return false;
    row.revokedAt = now;
    return true;
  }

  async revokeById(userUuid: string, id: string, now: Date) {
    const row = await this.findById(userUuid, id);
    if (!row || row.revokedAt !== null || row.expiresAt <= now) return false;
    row.revokedAt = now;
    return true;
  }

  async revokeAll(userUuid: string, now: Date) {
    let count = 0;
    for (const row of this.rows) {
      if (row.userUuid === userUuid && row.revokedAt === null && row.expiresAt > now) {
        row.revokedAt = now;
        count += 1;
      }
    }
    return count;
  }

  async isActive(userUuid: string, sessionId: string, now: Date) {
    const row = await this.findBySecret(userUuid, sessionId);
    return row !== null && row.revokedAt === null && row.expiresAt > now;
  }
}

function makeService(repo: FakeSessionRepository) {
  const audit: SecurityAuditRepository = {
    record: vi.fn(async () => undefined),
  };
  return { service: new SessionService(repo, audit), audit };
}

describe('Session lifecycle', () => {
  it('creates an unpredictable secret and stores only its digest', async () => {
    const repo = new FakeSessionRepository();
    const { service } = makeService(repo);
    const secret = SessionService.generateSecret();
    expect(secret).toHaveLength(43);
    expect(SessionService.digestSecret(secret)).toMatch(/^[a-f0-9]{64}$/);

    const entity = await service.create(USER_A, {
      sessionId: secret,
      expiresAt: new Date(BASE.getTime() + 15 * 60_000),
    });
    expect(entity.userUuid).toBe(USER_A);
    expect(repo.rows[0]?.sessionIdHash).toBe(SessionService.digestSecret(secret));
    expect(repo.rows[0]?.sessionIdHash).not.toBe(secret);
  });

  it('treats expiration as invalid without using sleep', () => {
    const created = SessionEntity.create(
      snapshot('1', USER_A, 'a'.repeat(64), {
        expiresAt: new Date(BASE.getTime() + 60_000),
      }),
    );
    expect(created.isActiveAt(new Date(BASE.getTime() + 59_999))).toBe(true);
    expect(created.isActiveAt(new Date(BASE.getTime() + 60_000))).toBe(false);
    expect(created.statusAt(new Date(BASE.getTime() + 60_000))).toBe('expired');
  });

  it('rejects revoked sessions and cannot revive them', async () => {
    const repo = new FakeSessionRepository();
    const { service } = makeService(repo);
    const secret = SessionService.generateSecret();
    await service.create(USER_A, {
      sessionId: secret,
      expiresAt: new Date(BASE.getTime() + 15 * 60_000),
    });

    await service.logoutCurrent(USER_A, secret);
    expect(repo.rows[0]?.revokedAt).not.toBeNull();
    expect(await service.isActive(USER_A, secret, BASE)).toBe(false);
    expect(await repo.revokeBySecret(USER_A, secret, BASE)).toBe(false);
  });

  it('enforces ownership for selected revoke and leaves another user untouched', async () => {
    const repo = new FakeSessionRepository();
    const { service } = makeService(repo);
    const secretA = SessionService.generateSecret();
    const secretB = SessionService.generateSecret();
    await service.create(USER_A, { sessionId: secretA, expiresAt: new Date(BASE.getTime() + 15 * 60_000) });
    await service.create(USER_B, { sessionId: secretB, expiresAt: new Date(BASE.getTime() + 15 * 60_000) });

    await service.revokeOwnSession(USER_A, '2');
    expect(repo.rows[1]?.revokedAt).toBeNull();
    expect(await service.isActive(USER_B, secretB, BASE)).toBe(true);
  });

  it('logout-all revokes only the current user and is idempotent', async () => {
    const repo = new FakeSessionRepository();
    const { service } = makeService(repo);
    const secrets = [SessionService.generateSecret(), SessionService.generateSecret(), SessionService.generateSecret()];
    await service.create(USER_A, { sessionId: secrets[0], expiresAt: new Date(BASE.getTime() + 15 * 60_000) });
    await service.create(USER_A, { sessionId: secrets[1], expiresAt: new Date(BASE.getTime() + 15 * 60_000) });
    await service.create(USER_B, { sessionId: secrets[2], expiresAt: new Date(BASE.getTime() + 15 * 60_000) });

    expect(await service.logoutAll(USER_A)).toBe(2);
    expect(await service.logoutAll(USER_A)).toBe(0);
    expect(await service.isActive(USER_B, secrets[2], BASE)).toBe(true);
  });

  it('lists only safe fields and never returns the bearer secret', async () => {
    const repo = new FakeSessionRepository();
    const { service } = makeService(repo);
    const secret = SessionService.generateSecret();
    await service.create(USER_A, { sessionId: secret, expiresAt: new Date(BASE.getTime() + 15 * 60_000) });

    const result = await service.listOwn(USER_A, {}, BASE);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('sessionId');
    expect(result[0]).not.toHaveProperty('sessionIdHash');
    expect(result[0]).not.toHaveProperty('accessToken');
    expect(result[0]).not.toHaveProperty('refreshToken');
    expect(result[0]?.status).toBe('active');
  });
});
