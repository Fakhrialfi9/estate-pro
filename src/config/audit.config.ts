import { registerAs } from '@nestjs/config';

export default registerAs('audit', () => ({
  retentionDays: Number.parseInt(
    process.env.AUDIT_LOG_RETENTION_DAYS ?? '365',
    10,
  ),
  userAgentMaxLength: Number.parseInt(
    process.env.AUDIT_LOG_USER_AGENT_MAX_LENGTH ?? '1024',
    10,
  ),
}));
