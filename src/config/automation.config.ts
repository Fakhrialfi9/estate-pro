import { registerAs } from '@nestjs/config';

export default registerAs('automation', () => ({
  pollIntervalMs: Number(process.env.AUTOMATION_POLL_INTERVAL_MS ?? 1000),
  leaseMs: Number(process.env.AUTOMATION_LEASE_MS ?? 30000),
  actionTimeoutMs: Number(process.env.AUTOMATION_ACTION_TIMEOUT_MS ?? 30000),
  workflowMaxDurationMs: Number(process.env.AUTOMATION_WORKFLOW_MAX_DURATION_MS ?? 300000),
  workflowMaxDepth: Number(process.env.AUTOMATION_WORKFLOW_MAX_DEPTH ?? 20),
  actionMaxAttempts: Number(process.env.AUTOMATION_ACTION_MAX_ATTEMPTS ?? 3),
  actionRateLimit: Number(process.env.AUTOMATION_ACTION_RATE_LIMIT ?? 100),
  actionRateWindowMs: Number(process.env.AUTOMATION_ACTION_RATE_WINDOW_MS ?? 60000),
  schedulerBatchSize: Number(process.env.AUTOMATION_SCHEDULER_BATCH_SIZE ?? 25),
}));
