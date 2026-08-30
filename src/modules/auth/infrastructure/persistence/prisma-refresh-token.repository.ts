import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type { Prisma } from '../../../../../prisma/generated/prisma/client.js';
import type { RefreshTokenRevokeReason } from '../../domain/entities/refresh-token.entity.js';
import type { RefreshRotationResult, RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.js';
import type { RefreshTokenFamilyRepository, CreateRefreshFamilyInput } from '../../domain/repositories/refresh-token-family.repository.js';
import type { RefreshTokenSecurityPort } from '../../../../common/security/refresh-token-security.port.js';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository, RefreshTokenFamilyRepository, RefreshTokenSecurityPort {
  constructor(private readonly prisma: PrismaService) {}
  async createWithInitialToken(input: CreateRefreshFamilyInput): Promise<{ familyId: string; tokenId: string }> {
    const sessionId = BigInt(input.sessionId);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.authenticationUserSession.findFirst({ where: { id: sessionId, user: { uuid: input.userUuid }, revokedAt: null, expiresAt: { gt: input.issuedAt } }, select: { id: true } });
      if (!session) throw new Error('Authentication session is not active');
      const family = await tx.authenticationRefreshTokenFamily.create({
        data: {
          user: { connect: { uuid: input.userUuid } },
          session: { connect: { id: sessionId } },
          createdAt: input.issuedAt,
          tokens: { create: { tokenHash: input.tokenHash, issuedAt: input.issuedAt, expiresAt: input.expiresAt, createdAt: input.issuedAt } },
        },
        select: { id: true, tokens: { select: { id: true }, take: 1 } },
      });
      const token = family.tokens[0];
      if (!token) throw new Error('Initial refresh token was not created');
      return { familyId: family.id, tokenId: token.id.toString() };
    });
  }

  async rotate(tokenHash: string, createReplacement: (input: { familyId: string; sessionId: string }) => { token: string; tokenHash: string; expiresAt: Date }, now: Date): Promise<RefreshRotationResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.authenticationRefreshToken.findUnique({ where: { tokenHash }, include: { family: { include: { session: true, user: true } } } });
      if (!current) return { kind: 'INVALID' };
      if (current.consumedAt !== null || current.revokedAt !== null) {
        if (current.family.revokedAt === null) {
          await this.revokeFamilyAndSession(tx, current.familyId, current.family.sessionId, now);
          return { kind: 'REUSE_DETECTED', familyId: current.familyId, userUuid: current.family.user.uuid, sessionId: current.family.sessionId.toString() };
        }
        return { kind: 'REVOKED', snapshot: this.snapshot(current) };
      }
      if (current.expiresAt.getTime() <= now.getTime()) return { kind: 'EXPIRED', snapshot: this.snapshot(current) };
      if (current.family.revokedAt !== null || current.family.session.revokedAt !== null || current.family.session.expiresAt.getTime() <= now.getTime() || current.family.user.deletedAt !== null || !current.family.user.isActive || current.family.user.status !== 'active') return { kind: 'REVOKED', snapshot: this.snapshot(current) };
      const consumed = await tx.authenticationRefreshToken.updateMany({ where: { id: current.id, familyId: current.familyId, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now, revokedAt: now, revokeReason: 'ROTATED' } });
      if (consumed.count !== 1) {
        const afterRace = await tx.authenticationRefreshToken.findUnique({ where: { id: current.id } });
        if (afterRace?.consumedAt !== null || afterRace?.revokedAt !== null) {
          await this.revokeFamilyAndSession(tx, current.familyId, current.family.sessionId, now);
          return { kind: 'REUSE_DETECTED', familyId: current.familyId, userUuid: current.family.user.uuid, sessionId: current.family.sessionId.toString() };
        }
        return { kind: 'INVALID' };
      }
      const replacement = createReplacement({ familyId: current.familyId, sessionId: current.family.sessionId.toString() });
      await tx.authenticationRefreshToken.create({ data: { family: { connect: { id: current.familyId } }, tokenHash: replacement.tokenHash, issuedAt: now, expiresAt: replacement.expiresAt, createdAt: now } });
      return { kind: 'ROTATED', value: { oldTokenId: current.id.toString(), familyId: current.familyId, userUuid: current.family.user.uuid, sessionId: current.family.sessionId.toString(), newToken: replacement.token, newTokenExpiresAt: replacement.expiresAt } };
    });
  }

  async revokeFamily(familyId: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.authenticationRefreshTokenFamily.updateMany({ where: { id: familyId, revokedAt: null }, data: { revokedAt: now, revokeReason: reason, updatedAt: now } });
      await tx.authenticationRefreshToken.updateMany({ where: { familyId, consumedAt: null, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
      return family.count;
    });
  }
  async revokeAllForUser(userUuid: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const families = await tx.authenticationRefreshTokenFamily.updateMany({ where: { user: { uuid: userUuid }, revokedAt: null }, data: { revokedAt: now, revokeReason: reason, updatedAt: now } });
      await tx.authenticationRefreshToken.updateMany({ where: { family: { user: { uuid: userUuid } }, consumedAt: null, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
      return families.count;
    });
  }
  async revokeForSession(userUuid: string, sessionId: string, reason: RefreshTokenRevokeReason, now: Date): Promise<number> {
    const id = BigInt(sessionId);
    return this.prisma.$transaction(async (tx) => {
      const families = await tx.authenticationRefreshTokenFamily.updateMany({ where: { sessionId: id, user: { uuid: userUuid }, revokedAt: null }, data: { revokedAt: now, revokeReason: reason, updatedAt: now } });
      await tx.authenticationRefreshToken.updateMany({ where: { family: { sessionId: id, user: { uuid: userUuid } }, consumedAt: null, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
      return families.count;
    });
  }
  private async revokeFamilyAndSession(tx: Prisma.TransactionClient, familyId: string, sessionId: bigint, now: Date): Promise<void> {
    await tx.authenticationRefreshTokenFamily.updateMany({ where: { id: familyId, revokedAt: null }, data: { revokedAt: now, revokeReason: 'REUSE_DETECTED', updatedAt: now } });
    await tx.authenticationRefreshToken.updateMany({ where: { familyId, consumedAt: null, revokedAt: null }, data: { revokedAt: now, revokeReason: 'REUSE_DETECTED' } });
    await tx.authenticationUserSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now } });
  }
  private snapshot(row: { id: bigint; familyId: string; tokenHash: string; issuedAt: Date; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null; revokeReason: string | null; family: { user: { uuid: string }; sessionId: bigint } }) {
    return { id: row.id.toString(), familyId: row.familyId, userUuid: row.family.user.uuid, sessionId: row.family.sessionId.toString(), tokenHash: row.tokenHash, issuedAt: row.issuedAt, expiresAt: row.expiresAt, consumedAt: row.consumedAt, revokedAt: row.revokedAt, revokeReason: row.revokeReason as RefreshTokenRevokeReason | null };
  }
}
