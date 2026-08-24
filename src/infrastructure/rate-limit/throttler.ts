import { createRequire } from 'node:module';

import type * as ThrottlerPackage from '@nestjs/throttler';

type ThrottlerExports = typeof ThrottlerPackage;

const require = createRequire(import.meta.url);

const loadThrottlerPackage = (): ThrottlerExports => {
  const loaded = require('@nestjs/throttler') as unknown;

  if (typeof loaded !== 'object' || loaded === null) {
    throw new TypeError('Failed to load @nestjs/throttler as a CommonJS module.');
  }

  const exports = loaded as Record<string, unknown>;

  if (
    typeof exports.ThrottlerModule !== 'object' ||
    exports.ThrottlerModule === null ||
    typeof exports.ThrottlerGuard !== 'function' ||
    typeof exports.SkipThrottle !== 'function'
  ) {
    throw new TypeError('Invalid @nestjs/throttler runtime exports.');
  }

  return loaded as ThrottlerExports;
};

const throttler = loadThrottlerPackage();

export const ThrottlerModule = throttler.ThrottlerModule;
export const ThrottlerGuard = throttler.ThrottlerGuard;
export const SkipThrottle = throttler.SkipThrottle;
