export interface AuthenticationSessionPort {
  isActive(userUuid: string, sessionId: string, now: Date): Promise<boolean>;
}

export const AUTHENTICATION_SESSION_PORT = Symbol(
  'AUTHENTICATION_SESSION_PORT',
);
