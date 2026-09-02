import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PasswordHashingModule } from './password-hashing.module.js';
import { LoginService } from './application/services/login.service.js';
import { LogoutService } from './application/services/logout.service.js';
import { SessionService } from './application/services/session.service.js';
import { JwtTokenService } from './application/services/jwt-token.service.js';
import { RefreshTokenService } from './application/services/refresh-token.service.js';
import { RefreshTokenCryptoService } from './application/services/refresh-token-crypto.service.js';
import { RefreshTokenObservabilityService } from './application/services/refresh-token-observability.service.js';
import { TotpService } from './application/services/totp.service.js';
import { TwoFactorCryptoService } from './application/services/two-factor-crypto.service.js';
import { TwoFactorService } from './application/services/two-factor.service.js';
import { AuthController } from './presentation/auth.controller.js';
import { TwoFactorController } from './presentation/two-factor.controller.js';
import {
  AdminSessionController,
  SessionController,
} from './presentation/session.controller.js';
import { JwtAuthGuard } from './security/jwt-auth.guard.js';
import { SessionAdminGuard } from './security/session-admin.guard.js';
import { AuthenticatedAccessGuard } from '../../common/security/authenticated-access.guard.js';
import { AUTHENTICATION_SECURITY_REPOSITORY } from './domain/repositories/authentication-security.repository.js';
import { PrismaAuthenticationSecurityRepository } from './infrastructure/persistence/prisma-authentication-security.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from './domain/repositories/authentication-session.repository.js';
import { PrismaAuthenticationSessionRepository } from './infrastructure/persistence/prisma-authentication-session.repository.js';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.js';
import { REFRESH_TOKEN_FAMILY_REPOSITORY } from './domain/repositories/refresh-token-family.repository.js';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository.js';
import { ACCESS_TOKEN_VERIFIER } from '../../common/security/access-token-verifier.port.js';
import { AUTHENTICATION_SESSION_PORT } from '../../common/security/authentication-session.port.js';
import { SESSION_SECURITY_PORT } from '../../common/security/session-security.port.js';
import { REFRESH_TOKEN_SECURITY_PORT } from '../../common/security/refresh-token-security.port.js';
import { TWO_FACTOR_REPOSITORY } from './domain/repositories/two-factor.repository.js';
import { TWO_FACTOR_RECOVERY_CODE_REPOSITORY } from './domain/repositories/two-factor-recovery-code.repository.js';
import { TWO_FACTOR_ENROLLMENT_REPOSITORY } from './domain/repositories/two-factor-enrollment.repository.js';
import { TWO_FACTOR_CHALLENGE_REPOSITORY } from './domain/repositories/two-factor-challenge.repository.js';
import { PrismaTwoFactorRepository } from './infrastructure/persistence/prisma-two-factor.repository.js';
import { PrismaTwoFactorRecoveryCodeRepository } from './infrastructure/persistence/prisma-two-factor-recovery-code.repository.js';
import { PrismaTwoFactorEnrollmentRepository } from './infrastructure/persistence/prisma-two-factor-enrollment.repository.js';
import { PrismaTwoFactorChallengeRepository } from './infrastructure/persistence/prisma-two-factor-challenge.repository.js';

type RequiredExpiresIn = Exclude<SignOptions['expiresIn'], undefined>;

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule,
    AuditModule,
    PasswordHashingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.jwt.secret'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'auth.jwt.expiresIn',
          ) as RequiredExpiresIn,
          issuer: config.getOrThrow<string>('auth.jwt.issuer'),
          audience: config.getOrThrow<string>('auth.jwt.audience'),
          algorithm: config.getOrThrow<'HS256' | 'HS384' | 'HS512'>(
            'auth.jwt.algorithm',
          ),
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    TwoFactorController,
    SessionController,
    AdminSessionController,
  ],
  providers: [
    LoginService,
    LogoutService,
    SessionService,
    JwtTokenService,
    RefreshTokenService,
    RefreshTokenCryptoService,
    RefreshTokenObservabilityService,
    TotpService,
    TwoFactorCryptoService,
    TwoFactorService,
    JwtAuthGuard,
    AuthenticatedAccessGuard,
    SessionAdminGuard,
    {
      provide: AUTHENTICATION_SECURITY_REPOSITORY,
      useClass: PrismaAuthenticationSecurityRepository,
    },
    {
      provide: AUTHENTICATION_SESSION_REPOSITORY,
      useClass: PrismaAuthenticationSessionRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: REFRESH_TOKEN_FAMILY_REPOSITORY,
      useExisting: REFRESH_TOKEN_REPOSITORY,
    },
    {
      provide: REFRESH_TOKEN_SECURITY_PORT,
      useExisting: REFRESH_TOKEN_REPOSITORY,
    },
    { provide: TWO_FACTOR_REPOSITORY, useClass: PrismaTwoFactorRepository },
    {
      provide: TWO_FACTOR_RECOVERY_CODE_REPOSITORY,
      useClass: PrismaTwoFactorRecoveryCodeRepository,
    },
    {
      provide: TWO_FACTOR_ENROLLMENT_REPOSITORY,
      useClass: PrismaTwoFactorEnrollmentRepository,
    },
    {
      provide: TWO_FACTOR_CHALLENGE_REPOSITORY,
      useClass: PrismaTwoFactorChallengeRepository,
    },
    { provide: SESSION_SECURITY_PORT, useExisting: SessionService },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: JwtTokenService },
    {
      provide: AUTHENTICATION_SESSION_PORT,
      useExisting: AUTHENTICATION_SESSION_REPOSITORY,
    },
  ],
  exports: [
    JwtTokenService,
    JwtAuthGuard,
    AuthenticatedAccessGuard,
    SessionService,
    RefreshTokenService,
    REFRESH_TOKEN_SECURITY_PORT,
    TwoFactorService,
    AUTHENTICATION_SESSION_REPOSITORY,
    SESSION_SECURITY_PORT,
    ACCESS_TOKEN_VERIFIER,
    AUTHENTICATION_SESSION_PORT,
  ],
})
export class AuthModule {}

export { JwtAuthGuard } from './security/jwt-auth.guard.js';
export type { AccessTokenVerifier } from '../../common/security/access-token-verifier.port.js';
