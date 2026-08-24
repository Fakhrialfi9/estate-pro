import { Module } from '@nestjs/common';

import { PasswordHasherService } from './application/services/password-hasher.service.js';

@Module({
  providers: [PasswordHasherService],
  exports: [PasswordHasherService],
})
export class AuthModule {}
