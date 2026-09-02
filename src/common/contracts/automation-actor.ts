export interface AutomationActor {
  readonly actorUuid: string;
  readonly permissions: readonly string[];
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
