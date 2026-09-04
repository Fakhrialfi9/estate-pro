export interface SystemOperationalState {
  maintenanceMode: boolean;
  readOnlyMode: boolean;
  updatedAt: string | null;
}

export interface SystemOperationalDiagnostics {
  status: 'ok' | 'degraded';
  maintenanceMode: boolean;
  readOnlyMode: boolean;
  components: Record<string, 'up' | 'down' | 'unknown'>;
}
