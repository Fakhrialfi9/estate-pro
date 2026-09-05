import { createHash } from 'node:crypto';

/**
 * Produces a deterministic UUID-shaped identifier from a seed namespace/key.
 * This keeps cross-domain fixture references stable without storing secrets or
 * relying on database-generated numeric IDs.
 */
export function seedUuid(namespace: string, key: string): string {
  const hex = createHash('sha256')
    .update(`${namespace}:${key}`)
    .digest('hex');
  const versioned = `5${hex.slice(13)}`;
  const variant = `${((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${versioned.slice(0, 4)}-${variant.slice(0, 4)}-${hex.slice(20, 32)}`;
}

export const SEED_REFERENCE_DATE = new Date('2026-01-01T00:00:00.000Z');
