import { registerAs } from '@nestjs/config';

export default registerAs('observability', () => ({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'estate-pro-api',
  environment: process.env.NODE_ENV ?? 'development',
  tracing: {
    enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
    samplerArg: Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? 0.1),
  },
  metrics: {
    enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
    exportIntervalMs: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 60000),
  },
}));
