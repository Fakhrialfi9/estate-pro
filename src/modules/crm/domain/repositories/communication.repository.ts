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
  findByUuid(uuid: string): Promise<CommunicationRecord | null>;
  transitionCommunication(
    uuid: string,
    status: string,
    input?: { providerMessageId?: string; providerError?: string },
  ): Promise<CommunicationRecord>;
}

export const COMMUNICATION_REPOSITORY = Symbol('COMMUNICATION_REPOSITORY');
