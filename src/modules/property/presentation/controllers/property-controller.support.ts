import type { Request } from 'express';

export type AuthenticatedRequest = Request & { user?: { sub?: string } };
export const actor = (
  request: AuthenticatedRequest,
  userAgent?: string,
  requestId?: string,
) => ({
  actorUuid: request.user?.sub,
  ipAddress: request.ip,
  userAgent,
  requestId,
});

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'passwordConfirmation',
  'refreshToken',
  'accessToken',
  'token',
  'tokenHash',
  'secret',
  'sessionSecret',
  'sessionIdHash',
  'jwtSecret',
  'apiKey',
  'clientSecret',
  'twoFactorSecret',
  'recoveryCodes',
]);
export const serializePropertyResponse = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializePropertyResponse);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.has(key)) continue;
      result[key] = serializePropertyResponse(nested);
    }
    return result;
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
};
export const response = (value: unknown) => ({
  data: serializePropertyResponse(value),
});
export const listResponse = (result: {
  items: readonly unknown[];
  total: number;
  page: number;
  limit: number;
}) => ({
  data: serializePropertyResponse(result.items),
  meta: {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / result.limit),
  },
});
