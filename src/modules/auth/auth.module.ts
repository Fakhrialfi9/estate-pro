import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { UsersModule } from '../users/users.module.js';
import { PasswordHashingModule } from './password-hashing.module.js';
import { LoginService } from './application/services/login.service.js';
import { LogoutService } from './application/services/logout.service.js';
import { JwtTokenService } from './application/services/jwt-token.service.js';
import { AuthController } from './presentation/auth.controller.js';
import { JwtAuthGuard } from './security/jwt-auth.guard.js';
import { AUTHENTICATION_SECURITY_REPOSITORY } from './domain/repositories/authentication-security.repository.js';
import { PrismaAuthenticationSecurityRepository } from './infrastructure/persistence/prisma-authentication-security.repository.js';
import { AUTHENTICATION_SESSION_REPOSITORY } from './domain/repositories/authentication-session.repository.js';
import { PrismaAuthenticationSessionRepository } from './infrastructure/persistence/prisma-authentication-session.repository.js';
import { SECURITY_AUDIT_REPOSITORY } from './domain/repositories/security-audit.repository.js';
import { PrismaSecurityAuditRepository } from '../../../infrastructure/audit/prisma-security-audit.repository.js';

@Global()
@Module({
  imports: [ConfigModule, UsersModule, PasswordHashingModule, JwtModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      secret: config.getOrThrow<string>('auth.jwt.secret'),
      signOptions: {
        expiresIn: config.getOrThrow<string>('auth.jwt.expiresIn') as SignOptions['expiresIn'],
        issuer: config.getOrThrow<string>('auth.jwt.issuer'),
        audience: config.getOrThrow<string>('auth.jwt.audience'),
        algorithm: config.getOrThrow<'HS256' | 'HS384' | 'HS512'>('auth.jwt.algorithm'),
      },
    }),
  })],
  controllers: [AuthController],
  providers: [
    LoginService,
    LogoutService,
    JwtTokenService,
    JwtAuthGuard,
    { provide: AUTHENTICATION_SECURITY_REPOSITORY, useClass: PrismaAuthenticationSecurityRepository },
    { provide: AUTHENTICATION_SESSION_REPOSITORY, useClass: PrismaAuthenticationSessionRepository },
    { provide: SECURITY_AUDIT_REPOSITORY, useClass: PrismaSecurityAuditRepository },
  ],
  exports: [JwtTokenService, JwtAuthGuard, AUTHENTICATION_SESSION_REPOSITORY],
})
export class AuthModule {}
