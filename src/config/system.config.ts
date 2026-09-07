import { registerAs } from '@nestjs/config';

export default registerAs('system', () => ({
  webhookEncryptionKey: process.env.SYSTEM_WEBHOOK_ENCRYPTION_KEY,
  allowLocalWebhookHttp: process.env.SYSTEM_WEBHOOK_ALLOW_LOCAL_HTTP ?? 'false',
  ssrf: {
    allowedHosts: (process.env.SECURITY_SSRF_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    allowLocalhostHttp:
      process.env.SECURITY_SSRF_ALLOW_LOCALHOST_HTTP ?? 'false',
  },
  export: {
    maxRows: Number(process.env.SYSTEM_EXPORT_MAX_ROWS ?? 10000),
    maxConcurrent: Number(process.env.SYSTEM_EXPORT_MAX_CONCURRENT ?? 2),
    maxArtifactBytes: Number(
      process.env.SYSTEM_EXPORT_MAX_ARTIFACT_BYTES ?? 25 * 1024 * 1024,
    ),
    retentionHours: Number(process.env.SYSTEM_EXPORT_RETENTION_HOURS ?? 24),
  },
  retention: {
    intervalMs: Number(process.env.SYSTEM_RETENTION_INTERVAL_MS ?? 3_600_000),
    activityDays: Number(process.env.SYSTEM_ACTIVITY_RETENTION_DAYS ?? 90),
    auditDays: Number(process.env.SYSTEM_AUDIT_RETENTION_DAYS ?? 365),
    batchSize: Number(process.env.SYSTEM_RETENTION_BATCH_SIZE ?? 250),
  },
  webhook: {
    timeoutMs: Number(process.env.SYSTEM_WEBHOOK_TIMEOUT_MS ?? 5000),
    maxAttempts: Number(process.env.SYSTEM_WEBHOOK_MAX_ATTEMPTS ?? 5),
    maxPayloadBytes: Number(
      process.env.SYSTEM_WEBHOOK_MAX_PAYLOAD_BYTES ?? 1024 * 1024,
    ),
    retentionDays: Number(process.env.SYSTEM_WEBHOOK_RETENTION_DAYS ?? 30),
    rateLimit: Number(process.env.SYSTEM_WEBHOOK_RATE_LIMIT ?? 60),
    rateWindowMs: Number(process.env.SYSTEM_WEBHOOK_RATE_WINDOW_MS ?? 60_000),
  },
}));
