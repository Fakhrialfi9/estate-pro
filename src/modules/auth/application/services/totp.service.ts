import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TotpService {
  generateSecret(): string {
    return this.toBase32(randomBytes(SECRET_BYTES));
  }

  currentTimeStep(now = new Date()): bigint {
    return BigInt(Math.floor(now.getTime() / 1000 / PERIOD_SECONDS));
  }

  generateCode(secret: string, timeStep: bigint): string {
    const key = this.fromBase32(secret);
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(timeStep);
    const digest = createHmac('sha1', key).update(counter).digest();
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const binary =
      (((digest[offset] ?? 0) & 0x7f) << 24) |
      ((digest[offset + 1] ?? 0) << 16) |
      ((digest[offset + 2] ?? 0) << 8) |
      (digest[offset + 3] ?? 0);
    return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
  }

  verify(
    secret: string,
    suppliedCode: string,
    now = new Date(),
  ): bigint | null {
    if (!/^\d{6}$/.test(suppliedCode)) return null;
    const step = this.currentTimeStep(now);
    const expected = Buffer.from(this.generateCode(secret, step));
    const supplied = Buffer.from(suppliedCode);
    if (
      expected.length === supplied.length &&
      timingSafeEqual(expected, supplied)
    )
      return step;
    return null;
  }

  provisioningUri(input: {
    secret: string;
    accountName: string;
    issuer: string;
  }): string {
    const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
    const params = new URLSearchParams({
      secret: input.secret,
      issuer: input.issuer,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  private toBase32(input: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of input) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? '';
        bits -= 5;
      }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? '';
    return output;
  }

  private fromBase32(input: string): Buffer {
    const normalized = input.replace(/=+$/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of normalized) {
      const index = BASE32_ALPHABET.indexOf(char);
      if (index < 0) throw new Error('Invalid TOTP secret');
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }
}
