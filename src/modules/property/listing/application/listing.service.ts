import type {
  SecurityAuditChange,
  SecurityAuditRepository,
} from '../../../../common/audit/security-audit.port.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LISTING_REPOSITORY } from '../domain/listing.repository.js';
import type {
  CreateListingInput,
  ListingActor,
  ListingRepository,
  PropertySearchQuery,
  UpdateListingInput,
} from '../domain/listing.repository.js';
import {
  assertPaymentInvariants,
  assertPricingInvariants,
  type ListingStatus,
} from '../domain/listing.types.js';
import {
  ListingConflictError,
  ListingNotFoundError,
  ListingStateError,
  ListingValidationError,
} from '../infrastructure/listing.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from '../../../../common/audit/security-audit.port.js';

const auditChanges = (
  value: unknown,
): readonly SecurityAuditChange[] | undefined => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const result: SecurityAuditChange[] = [];
  for (const [field, raw] of Object.entries(value)) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    )
      result.push({ field, oldValue: null, newValue: raw });
  }
  return result.length ? result : undefined;
};

@Injectable()
export class ListingService {
  constructor(
    @Inject(LISTING_REPOSITORY) private readonly repository: ListingRepository,
    @Inject(SECURITY_AUDIT_REPOSITORY)
    private readonly audit: SecurityAuditRepository,
  ) {}

  create(input: CreateListingInput, actor: ListingActor): Promise<unknown> {
    this.validateMutation(input.price, input.payments);
    return this.run(async () => {
      const result = await this.repository.create(input, actor);
      await this.record(
        'property.listing.create',
        'property_listing',
        input.propertyUuid,
        actor,
      );
      return result;
    });
  }
  get(uuid: string): Promise<unknown> {
    return this.run(() => this.repository.findOne(uuid));
  }
  update(
    uuid: string,
    version: number,
    input: UpdateListingInput,
    actor: ListingActor,
  ): Promise<unknown> {
    this.validateMutation(input.price, input.payments);
    return this.run(async () => {
      const result = await this.repository.update(uuid, version, input, actor);
      await this.record(
        'property.listing.update',
        'property_listing',
        uuid,
        actor,
      );
      return result;
    });
  }
  transition(
    uuid: string,
    version: number,
    status: ListingStatus,
    actor: ListingActor,
    reason?: string,
  ): Promise<unknown> {
    return this.run(async () => {
      const result = await this.repository.transition(
        uuid,
        version,
        status,
        actor,
        reason,
      );
      await this.record(
        `property.listing.${status.toLowerCase()}`,
        'property_listing',
        uuid,
        actor,
        reason,
      );
      return result;
    });
  }
  duplicate(uuid: string, actor: ListingActor): Promise<unknown> {
    return this.run(async () => {
      const result = await this.repository.duplicate(uuid, actor);
      await this.record(
        'property.listing.duplicate',
        'property_listing',
        uuid,
        actor,
      );
      return result;
    });
  }
  assignAgent(
    propertyUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(async () => {
      const result = await this.repository.assignAgent(
        propertyUuid,
        agentUserUuid,
        agentDisplayName,
        primary,
        actor,
      );
      await this.record(
        'property.agent.assign',
        'property',
        propertyUuid,
        actor,
        { agentUserUuid, primary },
      );
      return result;
    });
  }
  changeAgent(
    propertyUuid: string,
    assignmentUuid: string,
    agentUserUuid: string,
    agentDisplayName: string,
    primary: boolean,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(async () => {
      const result = await this.repository.changeAgent(
        propertyUuid,
        assignmentUuid,
        agentUserUuid,
        agentDisplayName,
        primary,
        actor,
      );
      await this.record(
        'property.agent.change',
        'property_agent_assignment',
        assignmentUuid,
        actor,
        { agentUserUuid, primary },
      );
      return result;
    });
  }
  assignOwner(
    propertyUuid: string,
    ownerType: string,
    ownerDisplayName: string,
    actor: ListingActor,
  ): Promise<unknown> {
    return this.run(async () => {
      const result = await this.repository.assignOwner(
        propertyUuid,
        ownerType,
        ownerDisplayName,
        actor,
      );
      await this.record(
        'property.owner.assign',
        'property_owner',
        propertyUuid,
        actor,
        { ownerType },
      );
      return result;
    });
  }
  detail(propertyUuid: string, viewerUserUuid?: string): Promise<unknown> {
    return this.run(() =>
      this.repository.getPropertyDetail(propertyUuid, viewerUserUuid),
    );
  }
  search(
    query: PropertySearchQuery,
  ): Promise<{
    items: readonly unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.repository.search(query);
  }

  private validateMutation(
    price?: CreateListingInput['price'],
    payments?: CreateListingInput['payments'],
  ): void {
    if (price) assertPricingInvariants(price);
    if (payments) payments.forEach(assertPaymentInvariants);
  }
  private async record(
    action: string,
    entityType: string,
    entityUuid: string,
    actor: ListingActor,
    reason?: unknown,
  ): Promise<void> {
    await this.audit.record({
      action,
      actorUuid: actor.actorUuid,
      subjectUuid: actor.actorUuid,
      actorType: actor.actorUuid ? 'AUTHENTICATED' : 'SYSTEM',
      entityType,
      entityUuid,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      result: 'SUCCESS',
      reason: typeof reason === 'string' ? reason.slice(0, 100) : undefined,
      changes: auditChanges(reason),
    });
  }
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof ListingNotFoundError)
        throw new NotFoundException(error.message);
      if (
        error instanceof ListingConflictError ||
        error instanceof ListingStateError
      )
        throw new ConflictException(error.message);
      if (error instanceof ListingValidationError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
