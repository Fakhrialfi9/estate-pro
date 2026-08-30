import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

export const digestRefreshToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

@Injectable()
export class RefreshTokenCryptoService {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }
  digest(token: string): string {
    return digestRefreshToken(token);
  }
  equalsDigest(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export const REFRESH_TOKEN_BYTE_LENGTH = TOKEN_BYTES;
export const REFRESH_TOKEN_STRING_LENGTH = 43;
