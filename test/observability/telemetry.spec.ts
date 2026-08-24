import { afterAll, describe, expect, it } from 'vitest';

import { getApplicationMetadata } from '../../src/config/app.config.js';
import {
  shutdownTelemetry,
  telemetryEnabled,
  telemetrySdk,
} from '../../src/infrastructure/observability/telemetry.js';

afterAll(async () => {
  await shutdownTelemetry();
});

describe('OpenTelemetry bootstrap', () => {
  it('derives a stable service resource identity from application configuration', () => {
    const metadata = getApplicationMetadata();

    expect(metadata.name).toBeTypeOf('string');
    expect(metadata.version).toBeTypeOf('string');
    expect(metadata.environment).toBeTypeOf('string');
  });

  it('creates an SDK when telemetry is enabled by default', () => {
    expect(telemetryEnabled).toBe(true);
    expect(telemetrySdk).toBeDefined();
  });
});
