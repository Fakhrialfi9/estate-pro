import { describe, expect, it } from 'vitest';
import { UserEntity } from '../../src/modules/users/domain/entities/user.entity.js';
import { serializeUser } from '../../src/modules/users/application/serializers/user.serializer.js';

const user = UserEntity.create({
  uuid: '550e8400-e29b-41d4-a716-446655440000', username: 'john', email: 'john@example.com', phone: '+62123',
  status: 'active', isActive: true, isVerified: true, createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'), deletedAt: null,
});

describe('serializeUser', () => {
  it('returns only public user fields', () => {
    const output = serializeUser(user) as Record<string, unknown>;
    expect(output).toEqual({
      uuid: '550e8400-e29b-41d4-a716-446655440000', username: 'john', email: 'john@example.com', phone: '+62123',
      status: 'active', isActive: true, isVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect('password' in output).toBe(false);
    expect('passwordHash' in output).toBe(false);
    expect('secret' in output).toBe(false);
    expect('sessionToken' in output).toBe(false);
    expect('twoFactorSecret' in output).toBe(false);
  });
});
