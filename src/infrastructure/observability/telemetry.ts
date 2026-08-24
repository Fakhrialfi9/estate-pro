import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getApplicationMetadata } from '../../config/app.config.js';

const metadata = getApplicationMetadata();
const tracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';
const metricsEnabled = process.env.OTEL_METRICS_ENABLED !== 'false';

const configuredSamplingRatio = Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 0.1);
const samplingRatio =
  Number.isFinite(configuredSamplingRatio) && configuredSamplingRatio >= 0 && configuredSamplingRatio <= 1
    ? configuredSamplingRatio
    : 0.1;

// The NodeSDK reads OTEL_TRACES_SAMPLER/OTEL_TRACES_SAMPLER_ARG and
// OTEL_METRICS_EXPORTER from the environment. Normalize an invalid ratio before
// SDK initialization so telemetry itself can never make process startup fail.
process.env.OTEL_TRACES_SAMPLER_ARG = String(samplingRatio);

export const telemetryEnabled = tracingEnabled || metricsEnabled;

export const telemetrySdk = telemetryEnabled
  ? new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? metadata.name,
        [ATTR_SERVICE_VERSION]: metadata.version,
        'deployment.environment': metadata.environment,
      }),
      instrumentations: tracingEnabled ? [getNodeAutoInstrumentations()] : [],
    })
  : undefined;

let telemetryStarted = false;

export const startTelemetry = (): void => {
  if (!telemetrySdk || telemetryStarted) {
    return;
  }

  try {
    telemetrySdk.start();
    telemetryStarted = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown telemetry startup error.';
    process.stderr.write(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        service: metadata.name,
        environment: metadata.environment,
        message: 'OpenTelemetry startup failed; application will continue without telemetry.',
        error: {
          type: error instanceof Error ? error.name : 'UnknownError',
          message,
        },
      }) + '\n',
    );
  }
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (!telemetrySdk || !telemetryStarted) {
    return;
  }

  try {
    await telemetrySdk.shutdown();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown telemetry shutdown error.';
    process.stderr.write(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        service: metadata.name,
        environment: metadata.environment,
        message: 'OpenTelemetry shutdown failed; application shutdown will continue.',
        error: {
          type: error instanceof Error ? error.name : 'UnknownError',
          message,
        },
      }) + '\n',
    );
  } finally {
    telemetryStarted = false;
  }
};

// This module is imported before NestJS application modules so instrumentation can patch
// Node dependencies before application bootstrap begins.
startTelemetry();
