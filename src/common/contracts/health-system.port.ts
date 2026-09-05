export type SystemHealthStatus = 'up' | 'down';

export type SystemHealthPort = Readonly<{
  checkDatabase(): Promise<SystemHealthStatus>;
}>;

export const SYSTEM_HEALTH_PORT = Symbol('SYSTEM_HEALTH_PORT');
