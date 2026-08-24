import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    issuer: process.env.JWT_ISSUER ?? 'estate-pro-api',
    audience: process.env.JWT_AUDIENCE ?? 'estate-pro-client',
    algorithm: process.env.JWT_ALGORITHM ?? 'HS256',
  },
  twoFactor: {
    encryptionKey: process.env.TWO_FACTOR_ENCRYPTION_KEY,
  },
}));
