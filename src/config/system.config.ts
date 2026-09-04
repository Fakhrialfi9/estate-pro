import { registerAs } from '@nestjs/config';

export default registerAs('system', () => ({
  webhookEncryptionKey: process.env.SYSTEM_WEBHOOK_ENCRYPTION_KEY,
  allowLocalWebhookHttp: process.env.SYSTEM_WEBHOOK_ALLOW_LOCAL_HTTP ?? 'false',
  export: {
    maxRows: Number(process.env.SYSTEM_EXPORT_MAX_ROWS ?? 10000),
    maxConcurrent: Number(process.env.SYSTEM_EXPORT_MAX_CONCURRENT ?? 2),
    maxArtifactBytes: Number(
      process.env.SYSTEM_EXPORT_MAX_ARTIFACT_BYTES ?? 25 * 1024 * 1024,
    ),
    retentionHours: Number(process.env.SYSTEM_EXPORT_RETENTION_HOURS ?? 24),
  },
  webhook: {
    timeoutMs: Number(process.env.SYSTEM_WEBHOOK_TIMEOUT_MS ?? 5000),
    maxAttempts: Number(process.env.SYSTEM_WEBHOOK_MAX_ATTEMPTS ?? 5),
    maxPayloadBytes: Number(
      process.env.SYSTEM_WEBHOOK_MAX_PAYLOAD_BYTES ?? 1024 * 1024,
    ),
    retentionDays: Number(process.env.SYSTEM_WEBHOOK_RETENTION_DAYS ?? 30),
  },
}));
