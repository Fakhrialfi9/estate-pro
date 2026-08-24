import { registerAs } from '@nestjs/config';

import { getApplicationMetadata } from './app.config.js';

export default registerAs('observability', () => {
  const metadata = getApplicationMetadata();

  return {
    serviceName: process.env.OTEL_SERVICE_NAME ?? metadata.name,
    serviceVersion: metadata.version,
    environment: metadata.environment,
    tracing: {
      enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
      exporter: process.env.OTEL_TRACES_EXPORTER ?? 'otlp',
      sampler: process.env.OTEL_TRACES_SAMPLER ?? 'parentbased_traceidratio',
      samplerArg: Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 0.1),
    },
    metrics: {
      enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
      exporter: process.env.OTEL_METRICS_EXPORTER ?? 'otlp',
      exportIntervalMs: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 60000),
    },
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  };
});
