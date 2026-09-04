import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SYSTEM_ACTIVITY_REPOSITORY } from '../../domain/repositories/system-activity.repository.js';
import type { SystemActivityRepository } from '../../domain/repositories/system-activity.repository.js';
import type {
  SystemActivityAppendInput,
  SystemActivityContract,
  SystemActivityListInput,
} from '../../domain/system-public.contracts.js';

const safeMetadata = (
  metadata: Record<string, unknown>,
): Record<string, unknown> => {
  const blocked =
    /password|token|secret|api[-_]?key|credential|private[-_]?key/i;
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.slice(0, 20).map(sanitize);
    if (!value || typeof value !== 'object') return value;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    ).slice(0, 50)) {
      result[key] = blocked.test(key) ? '[REDACTED]' : sanitize(item);
    }
    return result;
  };
  return sanitize(metadata) as Record<string, unknown>;
};

@Injectable()
export class SystemActivityService implements SystemActivityContract {
  constructor(
    @Inject(SYSTEM_ACTIVITY_REPOSITORY)
    private readonly repository: SystemActivityRepository,
  ) {}

  append(input: SystemActivityAppendInput) {
    if (
      !input.eventType.trim() ||
      !input.category.trim() ||
      !input.summary.trim()
    )
      throw new BadRequestException('Activity event is incomplete');
    return this.repository.append({
      actorUuid: input.actorUuid ?? null,
      eventType: input.eventType.trim().slice(0, 80),
      category: input.category.trim().slice(0, 40),
      resourceType: input.resourceType?.trim().slice(0, 80) ?? null,
      resourceUuid: input.resourceUuid ?? null,
      summary: input.summary,
      metadata: safeMetadata(input.metadata ?? {}),
      requestId: input.requestId ?? null,
    });
  }

  list(input: SystemActivityListInput) {
    return this.repository.list(input);
  }
}
