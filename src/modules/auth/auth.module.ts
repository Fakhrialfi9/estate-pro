import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PasswordHasherService } from './application/services/password-hasher.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.jwt.secret'),
        signOptions: {
          issuer: config.getOrThrow<string>('auth.jwt.issuer'),
          audience: config.getOrThrow<string>('auth.jwt.audience'),
          algorithm: config.getOrThrow<'HS256' | 'HS384' | 'HS512'>(
            'auth.jwt.algorithm',
          ),
        },
      }),
    }),
  ],
  providers: [PasswordHasherService],
  exports: [PasswordHasherService, JwtModule],
})
export class AuthModule {}
