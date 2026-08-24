import { afterEach, describe, expect, it } from 'vitest';

import { SENSITIVE_LOG_PATHS } from '../../src/common/constants/security.constants.js';
import {
  DEFAULT_LOG_LEVEL,
  getConfiguredLogLevel,
} from '../../src/infrastructure/logging/logger.config.js';

describe('logging configuration', () => {
  const originalLevel = process.env.LOG_LEVEL;
  const originalEnabled = process.env.LOG_ENABLED;

  afterEach(() => {
    if (originalLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLevel;
    }

    if (originalEnabled === undefined) {
      delete process.env.LOG_ENABLED;
    } else {
      process.env.LOG_ENABLED = originalEnabled;
    }
  });

  it('uses the configured log level and supports disabling logs', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_ENABLED;
    expect(getConfiguredLogLevel()).toBe(DEFAULT_LOG_LEVEL);

    process.env.LOG_LEVEL = 'debug';
    expect(getConfiguredLogLevel()).toBe('debug');

    process.env.LOG_ENABLED = 'false';
    expect(getConfiguredLogLevel()).toBe('silent');
  });

  it('redacts credential-bearing request fields', () => {
    expect(SENSITIVE_LOG_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.accessToken',
        'req.body.refreshToken',
        'req.body.apiKey',
        'req.body.secret',
      ]),
    );
  });
});
