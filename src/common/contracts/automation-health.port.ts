export const AUTOMATION_HEALTH_PORT = Symbol('AUTOMATION_HEALTH_PORT');

export interface AutomationHealthPort {
  check(): Promise<'up' | 'down' | 'unknown'>;
}
