import * as ThrottlerPackage from '@nestjs/throttler';

type ThrottlerExports = typeof ThrottlerPackage;

const loadThrottlerPackage = (): ThrottlerExports => {
  const loaded = ThrottlerPackage as unknown as Record<string, unknown>;

  if (
    typeof loaded.ThrottlerModule !== 'function' ||
    typeof loaded.ThrottlerGuard !== 'function' ||
    typeof loaded.SkipThrottle !== 'function'
  ) {
    throw new TypeError('Invalid @nestjs/throttler runtime exports.');
  }

  return ThrottlerPackage;
};

const throttler = loadThrottlerPackage();

export const ThrottlerModule = throttler.ThrottlerModule;
export const ThrottlerGuard = throttler.ThrottlerGuard;
export const SkipThrottle = throttler.SkipThrottle;
