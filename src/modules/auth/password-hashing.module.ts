import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasswordHasherService } from './application/services/password-hasher.service.js';

@Module({
  imports: [ConfigModule],
  providers: [PasswordHasherService],
  exports: [PasswordHasherService],
})
export class PasswordHashingModule {}
