export interface CommunicationProvider {
  readonly channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  send(input: {
    destination: string;
    subject?: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
}

export class ProviderNotConfiguredError extends Error {
  readonly retryable = false;

  constructor(channel: string) {
    super(`No ${channel} communication provider is configured`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class CommunicationProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CommunicationProviderError';
  }
}
