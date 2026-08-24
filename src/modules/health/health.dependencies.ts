export const DATABASE_HEALTH_CHECK = Symbol('DATABASE_HEALTH_CHECK');

export interface HealthDependency {
  check(): Promise<void>;
}
