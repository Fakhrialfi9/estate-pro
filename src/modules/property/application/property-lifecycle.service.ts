import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AUDIT_ACTIONS } from '../../../common/audit/audit-events.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../common/audit/security-audit.port.js';
import type { SecurityAuditRepository } from '../../../common/audit/security-audit.port.js';
import { MasterConcurrencyError, MasterNotFoundError } from '../domain/errors.js';
import type {
  ActorContext,
  PropertyStatus,
} from '../domain/property-master.types.js';
import { assertTransition } from '../domain/property-master.types.js';
import { PROPERTY_LIFECYCLE_REPOSITORY } from '../domain/repositories/property-lifecycle.repository.js';
import type { PropertyLifecycleRepository } from '../domain/repositories/property-lifecycle.repository.js';

@Injectable()
export class PropertyLifecycleService {
  constructor(
    @Inject(PROPERTY_LIFECYCLE_REPOSITORY)
    private readonly repository: PropertyLifecycleRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  async verify(uuid: string, version: number, actor: ActorContext) {
    try {
      const property = this.asRecord(
        await this.repository.verify(uuid, version, actor),
      );
      await this.record(AUDIT_ACTIONS.PROPERTY_VERIFIED, uuid, actor, {
        status: property.status,
        verifiedAt: property.verifiedAt,
      });
      return property;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  async publish(uuid: string, version: number, actor: ActorContext) {
    try {
      const property = this.asRecord(
        await this.repository.publish(uuid, version, actor),
      );
      const status = property.status as PropertyStatus;
      if (status !== 'ACTIVE') {
        assertTransition('IN_REVIEW', status);
        throw new BadRequestException(
          'Property publication did not reach ACTIVE state',
        );
      }
      await this.record(AUDIT_ACTIONS.PROPERTY_PUBLISHED, uuid, actor, {
        status,
        publishedAt: property.publishedAt,
      });
      return property;
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid property lifecycle result');
    }
    return value as Record<string, unknown>;
  }

  private async record(
    action: string,
    entityUuid: string,
    actor: ActorContext,
    changes: Record<string, unknown>,
  ) {
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      subjectUuid: actor.actorUuid,
      actorType: actor.actorUuid ? 'AUTHENTICATED' : 'SYSTEM',
      entityType: 'property',
      entityUuid,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      result: 'SUCCESS',
      changes: Object.entries(changes).flatMap(([field, newValue]) =>
        newValue === undefined || typeof newValue === 'object'
          ? []
          : [
              {
                field,
                oldValue: null,
                newValue: newValue as string | number | boolean | null,
              },
            ],
      ),
    });
  }

  private mapError(error: unknown): Error {
    if (
      error instanceof NotFoundException ||
      error instanceof ConflictException ||
      error instanceof BadRequestException
    )
      return error;
    if (error instanceof MasterNotFoundError)
      return new NotFoundException(error.message);
    if (error instanceof MasterConcurrencyError)
      return new ConflictException(error.message);
    return error instanceof Error
      ? error
      : new Error('Property lifecycle operation failed');
  }
}
