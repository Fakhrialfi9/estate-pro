import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class TwoFactorCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(payload: string): string {
    try {
      const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
      if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error('invalid payload');
      const decipher = createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(ivRaw, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new BadRequestException('Unable to process two-factor configuration');
    }
  }

  private getKey(): Buffer {
    const raw = this.config.get<string>('auth.twoFactor.encryptionKey');
    if (!raw || Buffer.byteLength(raw, 'utf8') < 32) throw new Error('TWO_FACTOR_ENCRYPTION_KEY must contain at least 32 bytes');
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    return createHash('sha256').update(raw, 'utf8').digest();
  }
}
