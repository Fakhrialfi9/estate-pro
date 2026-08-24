import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';

interface PasswordHashingConfig {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

@Injectable()
export class PasswordHasherService {
  constructor(private readonly configService: ConfigService) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.getConfig().memoryCost,
      timeCost: this.getConfig().timeCost,
      parallelism: this.getConfig().parallelism,
    });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  private getConfig(): PasswordHashingConfig {
    return this.configService.getOrThrow<PasswordHashingConfig>(
      'auth.passwordHashing',
    );
  }
}
