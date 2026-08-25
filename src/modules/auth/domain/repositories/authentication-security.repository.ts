export interface AuthenticationSecurityState {
  userUuid: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  updatedAt: Date;
}

export interface AuthenticationLockoutPolicy {
  threshold: number;
  windowMs: number;
  durationMs: number;
}

export interface SuccessfulLoginContext {
  ipAddress?: string | undefined;
}

export interface AuthenticationSecurityRepository {
  getState(userUuid: string): Promise<AuthenticationSecurityState>;
  recordFailedLogin(
    userUuid: string,
    now: Date,
    policy: AuthenticationLockoutPolicy,
  ): Promise<AuthenticationSecurityState>;
  recordSuccessfulLogin(
    userUuid: string,
    now: Date,
    context: SuccessfulLoginContext,
  ): Promise<void>;
}

export const AUTHENTICATION_SECURITY_REPOSITORY = Symbol(
  'AUTHENTICATION_SECURITY_REPOSITORY',
);
