import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SystemWebhookSecretPort } from '../../domain/webhook/webhook.ports.js';

@Injectable()
export class WebhookSecretService implements SystemWebhookSecretPort {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configured = config.get<string>('system.webhookEncryptionKey');
    if (!configured && config.get<string>('app.nodeEnv') === 'production') {
      throw new Error('SYSTEM_WEBHOOK_ENCRYPTION_KEY is required in production');
    }
    this.key = createHash('sha256')
      .update(configured ?? 'estate-pro-development-webhook-key', 'utf8')
      .digest();
  }

  generate(): { secret: string; ciphertext: string } {
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    return { secret, ciphertext: this.encrypt(secret) };
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivPart, tagPart, dataPart] = ciphertext.split('.');
    if (!ivPart || !tagPart || !dataPart) {
      throw new Error('Invalid webhook secret ciphertext');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
