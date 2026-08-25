export interface AccessTokenClaims {
  sub: string;
  sid: string;
  iat: number;
  exp: number;
  permissions?: string[] | undefined;
  iss?: string | undefined;
  aud?: string | string[] | undefined;
}

export interface AccessTokenVerifier {
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
