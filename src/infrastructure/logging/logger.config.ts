export const DEFAULT_LOG_LEVEL = 'info';

export const getConfiguredLogLevel = (): string => {
  if (process.env.LOG_ENABLED === 'false') {
    return 'silent';
  }

  return process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;
};
