export interface SystemCorrelationContext {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly eventId?: string;
  readonly jobId?: string;
  readonly providerId?: string;
}

export const sanitizeSystemCorrelationContext = (
  context: SystemCorrelationContext,
): SystemCorrelationContext => ({
  ...(context.requestId ? { requestId: context.requestId.slice(0, 120) } : {}),
  ...(context.correlationId
    ? { correlationId: context.correlationId.slice(0, 120) }
    : {}),
  ...(context.eventId ? { eventId: context.eventId.slice(0, 120) } : {}),
  ...(context.jobId ? { jobId: context.jobId.slice(0, 120) } : {}),
  ...(context.providerId ? { providerId: context.providerId.slice(0, 120) } : {}),
});
