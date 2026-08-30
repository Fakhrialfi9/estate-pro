import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import {
  MasterConcurrencyError,
  MasterNotFoundError,
} from '../../domain/errors.js';
import type { ActorContext } from '../../domain/property-master.types.js';
import type { PropertyLifecycleRepository } from '../../domain/repositories/property-lifecycle.repository.js';

@Injectable()
export class PrismaPropertyLifecycleRepository implements PropertyLifecycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async verify(
    uuid: string,
    version: number,
    actor: ActorContext,
  ): Promise<unknown> {
    const current = await this.prisma.property.findFirst({
      where: { uuid, deletedAt: null },
    });
    if (!current) throw new MasterNotFoundError('Property not found');
    if (current.version !== version)
      throw new MasterConcurrencyError('Property version conflict');
    if (current.status !== 'IN_REVIEW')
      throw new MasterConcurrencyError('Property must be in IN_REVIEW');

    const result = await this.prisma.property.updateMany({
      where: { id: current.id, version, status: 'IN_REVIEW' },
      data: {
        verifiedAt: new Date(),
        verifiedBy: actor.actorUuid ?? null,
        updatedBy: actor.actorUuid ?? current.updatedBy,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new MasterConcurrencyError('Property version conflict');
    return this.prisma.property.findUnique({ where: { id: current.id } });
  }

  async publish(
    uuid: string,
    version: number,
    actor: ActorContext,
  ): Promise<unknown> {
    const current = await this.prisma.property.findFirst({
      where: { uuid, deletedAt: null },
    });
    if (!current) throw new MasterNotFoundError('Property not found');
    if (current.version !== version)
      throw new MasterConcurrencyError('Property version conflict');
    if (current.status !== 'IN_REVIEW')
      throw new MasterConcurrencyError('Property must be in IN_REVIEW');
    if (!current.verifiedAt)
      throw new MasterConcurrencyError(
        'Property must be verified before publishing',
      );

    const result = await this.prisma.property.updateMany({
      where: {
        id: current.id,
        version,
        status: 'IN_REVIEW',
        verifiedAt: { not: null },
      },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date(),
        updatedBy: actor.actorUuid ?? current.updatedBy,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new MasterConcurrencyError('Property version conflict');
    return this.prisma.property.findUnique({ where: { id: current.id } });
  }
}
