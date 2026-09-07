import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../../../prisma/generated/prisma/client.js';
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import type {
  MatchingRuleRecord,
  MatchingRuleWeights,
} from '../domain/matching-rule.js';
import type { MatchingRuleRepository } from '../domain/repositories/matching-rule.repository.js';

type MatchingRuleRow = Prisma.MatchingRuleGetPayload<true>;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toRecord = (row: MatchingRuleRow): MatchingRuleRecord => ({
  uuid: row.uuid,
  name: row.name,
  version: row.version,
  weights:
    row.weights &&
    typeof row.weights === 'object' &&
    !Array.isArray(row.weights)
      ? (row.weights as MatchingRuleWeights)
      : {},
  hardCriteria: Array.isArray(row.hardCriteria)
    ? row.hardCriteria.filter(
        (value): value is string => typeof value === 'string',
      )
    : [],
  minimumScore: toNumber(row.minimumScore),
  isActive: row.isActive === true,
  createdBy: row.createdBy,
  activatedAt: row.activatedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PrismaMatchingRuleRepository implements MatchingRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(): Promise<MatchingRuleRecord | null> {
    const row = await this.prisma.matchingRule.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async get(uuid: string): Promise<MatchingRuleRecord | null> {
    const row = await this.prisma.matchingRule.findUnique({ where: { uuid } });
    return row ? toRecord(row) : null;
  }

  async list(page: number, limit: number) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.matchingRule.findMany({
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.prisma.matchingRule.count(),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async create(input: {
    name: string;
    version: number;
    weights: MatchingRuleWeights;
    hardCriteria: readonly string[];
    minimumScore: number;
    createdBy: string;
    activate: boolean;
  }): Promise<MatchingRuleRecord> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (input.activate) {
          await tx.matchingRule.updateMany({
            where: { isActive: true },
            data: { isActive: false },
          });
        }
        return tx.matchingRule.create({
          data: {
            name: input.name,
            version: input.version,
            weights: input.weights,
            hardCriteria: [...input.hardCriteria],
            minimumScore: input.minimumScore,
            isActive: input.activate,
            createdBy: input.createdBy,
            activatedAt: input.activate ? new Date() : null,
          },
        });
      });
      return toRecord(row);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Matching rule version already exists');
      }
      throw error;
    }
  }

  async update(
    uuid: string,
    expectedVersion: number,
    input: {
      name?: string;
      weights?: MatchingRuleWeights;
      hardCriteria?: readonly string[];
      minimumScore?: number;
    },
  ): Promise<MatchingRuleRecord> {
    const current = await this.get(uuid);
    if (!current) throw new NotFoundException('Matching rule not found');
    if (current.version !== expectedVersion)
      throw new ConflictException('Matching rule version is stale');

    return this.create({
      name: input.name ?? current.name,
      version: current.version + 1,
      weights: input.weights ?? current.weights,
      hardCriteria: input.hardCriteria ?? current.hardCriteria,
      minimumScore: input.minimumScore ?? current.minimumScore,
      createdBy: current.createdBy,
      activate: current.isActive,
    });
  }

  async activate(uuid: string): Promise<MatchingRuleRecord> {
    const current = await this.get(uuid);
    if (!current) throw new NotFoundException('Matching rule not found');
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.matchingRule.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.matchingRule.update({
        where: { uuid },
        data: { isActive: true, activatedAt: new Date() },
      });
    });
    return toRecord(row);
  }
}
