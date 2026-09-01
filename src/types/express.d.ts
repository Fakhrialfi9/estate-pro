import type { AccessTokenClaims } from '../common/security/access-token-verifier.port.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AccessTokenClaims;
  }
}
