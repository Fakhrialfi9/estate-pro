import type {
  SystemOperationalDiagnostics,
  SystemOperationalState,
} from './system-operations.contracts.js';

export const SYSTEM_OPERATIONS_PORT = Symbol('SYSTEM_OPERATIONS_PORT');
export const SYSTEM_STORAGE_HEALTH_PORT = Symbol('SYSTEM_STORAGE_HEALTH_PORT');
export const SYSTEM_JOB_HEALTH_PORT = Symbol('SYSTEM_JOB_HEALTH_PORT');
export const SYSTEM_DATABASE_HEALTH_PORT = Symbol(
  'SYSTEM_DATABASE_HEALTH_PORT',
);

export interface SystemOperationsPort {
  state(): Promise<SystemOperationalState>;
  setMaintenance(
    actorUuid: string,
    enabled: boolean,
  ): Promise<SystemOperationalState>;
  setReadOnly(
    actorUuid: string,
    enabled: boolean,
  ): Promise<SystemOperationalState>;
  diagnostics(): Promise<SystemOperationalDiagnostics>;
}

export interface SystemStorageHealthPort {
  check(): Promise<'up' | 'down' | 'unknown'>;
}

export interface SystemJobHealthPort {
  check(): Promise<'up' | 'down' | 'unknown'>;
}

export interface SystemDatabaseHealthPort {
  check(): Promise<'up' | 'down' | 'unknown'>;
}
