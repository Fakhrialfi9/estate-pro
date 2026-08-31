export interface CommunicationRecord {
  readonly uuid: string;
  readonly channel: string;
  readonly direction: string;
  readonly status: string;
  readonly contactUuid: string | null;
  readonly leadUuid: string | null;
  readonly activityUuid: string | null;
  readonly templateUuid: string | null;
  readonly providerName: string | null;
  readonly providerMessageId: string | null;
  readonly providerError: string | null;
  readonly destination: string;
  readonly subject: string | null;
  readonly body: string;
}
export interface CommunicationRepository {
  create(
    record: Omit<
      CommunicationRecord,
      'uuid' | 'providerMessageId' | 'providerError' | 'status'
    >,
  ): Promise<CommunicationRecord>;
  findByUuid(uuid: string): Promise<CommunicationRecord | null>;
  list(query: {
    page: number;
    limit: number;
    leadUuid?: string;
    contactUuid?: string;
    channel?: string;
    status?: string;
  }): Promise<{
    items: readonly CommunicationRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateProviderStatus(
    uuid: string,
    status: string,
    metadata?: { providerMessageId?: string; providerError?: string },
  ): Promise<CommunicationRecord>;
}
export const COMMUNICATION_REPOSITORY = Symbol('COMMUNICATION_REPOSITORY');
