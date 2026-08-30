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

  equalsDigest(leftDigest: string, rightDigest: string): boolean {
    const left = Buffer.from(leftDigest, 'hex');
    const right = Buffer.from(rightDigest, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}

export const REFRESH_TOKEN_BYTE_LENGTH = TOKEN_BYTES;
export const REFRESH_TOKEN_STRING_LENGTH = 43;
