import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { getApplicationMetadata } from '../../config/app.config.js';

const metadata = getApplicationMetadata();
const tracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';
const metricsEnabled = process.env.OTEL_METRICS_ENABLED !== 'false';

const samplingRatio = Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 0.1);

if (!Number.isFinite(samplingRatio) || samplingRatio < 0 || samplingRatio > 1) {
  throw new Error('OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1.');
}

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

  await telemetrySdk.shutdown();
  telemetryStarted = false;
};
