import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const assertSafeObjectGraph = (value: unknown): void => {
  if (value === null || typeof value !== 'object') {
    return;
  }

  const visited = new WeakSet<object>();

  const visit = (current: object): void => {
    if (visited.has(current)) {
      return;
    }
    visited.add(current);

    for (const key of Object.keys(current)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new BadRequestException({
          code: 'INVALID_INPUT',
          message: 'Request contains a forbidden property.',
        });
      }

      const nested = (current as Record<string, unknown>)[key];
      if (nested !== null && typeof nested === 'object') {
        visit(nested);
      }
    }
  };

  visit(value);
};

export class SecureValidationPipe extends ValidationPipe {
  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    assertSafeObjectGraph(value);
    return super.transform(value, metadata);
  }
}
