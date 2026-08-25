const MAX_STRING_LENGTH = 512;
const SENSITIVE_FIELD_PATTERN =
  /(password|passphrase|token|jwt|secret|otp|totp|recovery|credential|authorization|cookie|sessionsecret|encryption|privatekey|apikey|database)/i;

const ALLOWED_FIELDS: Record<string, ReadonlySet<string>> = {
  AuthenticationUser: new Set([
    'username',
    'email',
    'phone',
    'status',
    'isActive',
  ]),
  user: new Set(['username', 'email', 'phone', 'status', 'isActive']),
  AuthorizationRole: new Set(['name', 'description', 'isActive']),
  role: new Set(['name', 'description', 'isActive']),
  AuthorizationPermission: new Set(['name']),
  permission: new Set(['name']),
  AuthorizationRolePermission: new Set(['permission']),
  role_permission: new Set(['permission']),
  user_role: new Set(['targetUserUuid', 'roleUuid']),
  AuthenticationSession: new Set(['reason']),
  session: new Set(['reason']),
  two_factor: new Set(['enabled', 'reason']),
  authentication: new Set(['reason']),
};

export const normalizeAuditResourceType = (value?: string): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  const aliases: Record<string, string> = {
    Authentication: 'authentication',
    AuthenticationUser: 'user',
    AuthenticationUserProfile: 'profile',
    AuthenticationUserCredential: 'credential',
    AuthenticationUserSession: 'session',
    AuthenticationUserTwoFactor: 'two_factor',
    AuthenticationUserTwoFactorRecoveryCode: 'recovery_code',
    AuthorizationRole: 'role',
    AuthorizationPermission: 'permission',
    AuthorizationRolePermission: 'role_permission',
    AuthorizationUserRole: 'user_role',
    AuditLog: 'audit_log',
  };
  return (
    aliases[normalized] ??
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 100)
  );
};

const sanitizeScalar = (value: unknown): string | boolean | number | null => {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  return null;
};

export const sanitizeAuditChanges = (
  resourceType: string,
  changes: readonly {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[] = [],
) => {
  const allowlist = ALLOWED_FIELDS[resourceType] ?? new Set<string>();
  return changes.flatMap((change) => {
    if (
      !change.field ||
      SENSITIVE_FIELD_PATTERN.test(change.field) ||
      (allowlist.size > 0 && !allowlist.has(change.field))
    ) {
      return [];
    }
    return [
      {
        field: change.field.slice(0, 100),
        oldValue: sanitizeScalar(change.oldValue),
        newValue: sanitizeScalar(change.newValue),
      },
    ];
  });
};

export const sanitizeAuditReason = (reason?: string): string | null => {
  if (!reason || SENSITIVE_FIELD_PATTERN.test(reason)) return null;
  return reason.trim().slice(0, 100) || null;
};

export const sanitizeAuditUserAgent = (
  userAgent: string | undefined,
  maxLength = 1024,
): string | null => {
  if (!userAgent) return null;
  return userAgent.slice(0, Math.max(1, maxLength));
};

export const sanitizeAuditRequestId = (requestId?: string): string | null => {
  if (!requestId) return null;
  const normalized = requestId.trim();
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(normalized)) return null;
  return normalized;
};
