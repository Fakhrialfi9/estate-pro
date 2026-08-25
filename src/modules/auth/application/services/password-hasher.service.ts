import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

interface PasswordHashingConfig {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength?: number;
}

@Injectable()
export class PasswordHasherService {
  constructor(private readonly configService: ConfigService) {}

  async hash(password: string): Promise<string> {
    const config = this.getConfig();
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: config.memoryCost,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
      hashLength: config.hashLength,
    });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  needsRehash(passwordHash: string): boolean {
    const config = this.getConfig();
    return argon2.needsRehash(passwordHash, {
      type: argon2.argon2id,
      memoryCost: config.memoryCost,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
      hashLength: config.hashLength,
    });
  }

  private getConfig(): Required<PasswordHashingConfig> {
    const config = this.configService.getOrThrow<PasswordHashingConfig>(
      'auth.passwordHashing',
    );
    return { ...config, hashLength: config.hashLength ?? 32 };
  }
}
