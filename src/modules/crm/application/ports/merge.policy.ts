import { Injectable } from '@nestjs/common';

@Injectable()
export class LeadMergePolicy {
  assertAllowed(
    sourceUuid: string,
    targetUuid: string,
    hasPermission: boolean,
  ): void {
    if (!hasPermission) throw new Error('Lead merge permission is required');
    if (sourceUuid === targetUuid)
      throw new Error('Cannot merge a lead into itself');
  }
  merge<T extends Record<string, unknown>>(source: T, target: T): T {
    const survivor = { ...target };
    for (const [field, value] of Object.entries(source)) {
      if (field === 'uuid' || field === 'id') continue;
      if (
        (survivor[field] === null ||
          survivor[field] === undefined ||
          survivor[field] === '') &&
        value !== null &&
        value !== undefined &&
        value !== ''
      )
        survivor[field] = value;
    }
    return survivor;
  }
}
