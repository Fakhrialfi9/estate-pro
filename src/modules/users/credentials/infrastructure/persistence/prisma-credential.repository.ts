import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service.js';
import { CredentialEntity } from '../../domain/entities/credential.entity.js';
import type { CredentialRepository } from '../../domain/repositories/credential.repository.js';

type CredentialRecord = {
  id: bigint;
  userId: bigint;
  passwordHash: string;
  passwordChangedAt: Date | null;
  passwordExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { uuid: string };
};

type ResetTokenRecord = {
  id: bigint;
  userId: bigint;
  tokenDigest: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { uuid: string };
};

type Delegate<T> = {
  create(args: unknown): Promise<T>;
  findFirst(args: unknown): Promise<T | null>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

type PrismaClientShape = {
  authenticationUserCredential: Delegate<CredentialRecord>;
  authenticationPasswordResetToken: Delegate<ResetTokenRecord>;
  authenticationUser: Delegate<{ id: bigint; uuid: string }>;
  authenticationUserSession: Delegate<unknown>;
  $transaction<T>(callback: (tx: PrismaClientShape) => Promise<T>): Promise<T>;
};

@Injectable()
export class PrismaCredentialRepository implements CredentialRepository {
  private readonly client: PrismaClientShape;

  constructor(prisma: PrismaService) {
    this.client = prisma as unknown as PrismaClientShape;
  }

  async create(
    userUuid: string,
    passwordHash: string,
  ): Promise<CredentialEntity> {
    try {
      const record = await this.client.authenticationUserCredential.create({
        data: {
          user: { connect: { uuid: userUuid } },
          passwordHash,
          passwordChangedAt: new Date(),
        },
        include: { user: { select: { uuid: true } } },
      });
      return this.toDomain(record);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = new Error('Credential already exists');
        duplicate.name = 'CredentialAlreadyExistsError';
        throw duplicate;
      }
      throw error;
    }
  }

  async findByUserUuid(userUuid: string): Promise<CredentialEntity | null> {
    const record = await this.client.authenticationUserCredential.findFirst({
      where: { user: { uuid: userUuid } },
      include: { user: { select: { uuid: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async updatePassword(
    userUuid: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<CredentialEntity> {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.authenticationUserCredential.findFirst({
        where: { user: { uuid: userUuid } },
        include: { user: { select: { uuid: true } } },
      });
      if (!existing) throw new Error('Credential not found');

      const updated = await tx.authenticationUserCredential.updateMany({
        where: { userId: existing.userId },
        data: {
          passwordHash,
          passwordChangedAt: changedAt,
          passwordExpiresAt: null,
        },
      });
      if (updated.count !== 1) throw new Error('Credential not found');

      await tx.authenticationUserSession.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: changedAt },
      });

      const record = await tx.authenticationUserCredential.findFirst({
        where: { userId: existing.userId },
        include: { user: { select: { uuid: true } } },
      });
      if (!record) throw new Error('Credential not found');
      return this.toDomain(record);
    });
  }

  async createResetToken(
    userUuid: string,
    tokenDigest: string,
    expiresAt: Date,
  ): Promise<void> {
    const user = await this.client.authenticationUser.findFirst({
      where: { uuid: userUuid },
      select: { id: true },
    });
    if (!user) return;

    await this.client.authenticationPasswordResetToken.create({
      data: { userId: user.id, tokenDigest, expiresAt },
    });
  }

  async resetPasswordAtomically(
    tokenDigest: string,
    passwordHash: string,
    now: Date,
  ): Promise<string | null> {
    return this.client.$transaction(async (tx) => {
      const token = await tx.authenticationPasswordResetToken.findFirst({
        where: { tokenDigest, usedAt: null, expiresAt: { gt: now } },
        include: { user: { select: { uuid: true } } },
      });
      if (!token) return null;

      const consumed = await tx.authenticationPasswordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return null;

      const credentialUpdated =
        await tx.authenticationUserCredential.updateMany({
          where: { userId: token.userId },
          data: {
            passwordHash,
            passwordChangedAt: now,
            passwordExpiresAt: null,
          },
        });
      if (credentialUpdated.count !== 1) {
        throw new Error('Credential not found');
      }

      await tx.authenticationUserSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      return token.user.uuid;
    });
  }

  private toDomain(record: CredentialRecord): CredentialEntity {
    return CredentialEntity.create({
      userUuid: record.user.uuid,
      passwordHash: record.passwordHash,
      passwordChangedAt: record.passwordChangedAt,
      passwordExpiresAt: record.passwordExpiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
