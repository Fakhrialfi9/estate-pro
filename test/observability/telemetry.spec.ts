import { describe, expect, it } from 'vitest';

import { getApplicationMetadata } from '../../src/config/app.config.js';
import { telemetryEnabled, telemetrySdk } from '../../src/infrastructure/observability/telemetry.js';

describe('OpenTelemetry bootstrap', () => {
  it('derives a stable service resource identity from application configuration', () => {
    const metadata = getApplicationMetadata();

    expect(metadata.name).toBeTypeOf('string');
    expect(metadata.version).toBeTypeOf('string');
    expect(metadata.environment).toBeTypeOf('string');
  });

  it('creates an SDK only when telemetry is enabled', () => {
    expect(telemetryEnabled).toBe(true);
    expect(telemetrySdk).toBeDefined();
  });
});
