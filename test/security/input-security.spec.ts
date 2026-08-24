import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { SENSITIVE_LOG_PATHS } from '../../src/common/constants/security.constants.js';

class InputDto {
  @IsString()
  @MaxLength(256)
  name!: string;
}

describe('security baseline', () => {
  it('rejects unknown properties through the same ValidationPipe policy used by bootstrap', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: false },
    });

    await expect(
      pipe.transform(
        { name: '<script>alert(1)</script>', unexpected: 'injected' },
        { type: 'body', metatype: InputDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces a bounded string input instead of relying on ad-hoc filtering', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    await expect(
      pipe.transform(
        { name: 'x'.repeat(257) },
        { type: 'body', metatype: InputDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redacts the minimum sensitive logging paths at the logging boundary', () => {
    for (const path of [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'apiKey',
      'authorization',
    ]) {
      expect(SENSITIVE_LOG_PATHS).toContain(path);
    }
  });
});
