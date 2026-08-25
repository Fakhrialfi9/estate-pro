import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { UsersModule } from '../users/users.module.js';
import { PasswordHashingModule } from './password-hashing.module.js';
import { LoginService } from './application/services/login.service.js';
import { LogoutService } from './application/services/logout.service.js';
import { SessionService } from './application/services/session.service.js';
import { JwtTokenService } from './application/services/jwt-token.service.js';
import { AuthController } from './presentation/auth.controller.js';
import {
  AdminSessionController,
  SessionController,
} from './presentation/session.controller.js';
import { JwtAuthGuard } from './security/jwt-auth.guard.js';
import { SessionAdminGuard } from './security/session-admin.guard.js';
import { AUTHENTICATION_SECURITY_REPOSITORY } from './domain/repositories/authentication-security.repository.js';
import { PrismaAuthenticationSecurityRepository } from './infrastructure/persistence/prisma-authentication-security.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from './domain/repositories/authentication-session.repository.js';
import { PrismaAuthenticationSessionRepository } from './infrastructure/persistence/prisma-authentication-session.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from './domain/repositories/security-audit.repository.js';
import { PrismaSecurityAuditRepository } from '../../infrastructure/audit/prisma-security-audit.repository.js';
import { ACCESS_TOKEN_VERIFIER } from '../../common/security/access-token-verifier.port.js';
import { AUTHENTICATION_SESSION_PORT } from '../../common/security/authentication-session.port.js';
import { SESSION_SECURITY_PORT } from '../../common/security/session-security.port.js';

type RequiredExpiresIn = Exclude<SignOptions['expiresIn'], undefined>;

@Global()
@Module({
  imports: [
    ConfigModule,
    UsersModule,
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
  controllers: [AuthController, SessionController, AdminSessionController],
  providers: [
    LoginService,
    LogoutService,
    SessionService,
    JwtTokenService,
    JwtAuthGuard,
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
      provide: SECURITY_AUDIT_REPOSITORY,
      useClass: PrismaSecurityAuditRepository,
    },
    { provide: SESSION_SECURITY_PORT, useExisting: SessionService },
    {
      provide: ACCESS_TOKEN_VERIFIER,
      useExisting: JwtTokenService,
    },
    {
      provide: AUTHENTICATION_SESSION_PORT,
      useExisting: PrismaAuthenticationSessionRepository,
    },
  ],
  exports: [
    JwtService,
    JwtTokenService,
    JwtAuthGuard,
    SessionService,
    AUTHENTICATION_SESSION_REPOSITORY,
    SESSION_SECURITY_PORT,
    SECURITY_AUDIT_REPOSITORY,
    ACCESS_TOKEN_VERIFIER,
    AUTHENTICATION_SESSION_PORT,
  ],
})
export class AuthModule {}

export { JwtAuthGuard } from './security/jwt-auth.guard.js';
export type { AccessTokenVerifier } from '../../common/security/access-token-verifier.port.js';
