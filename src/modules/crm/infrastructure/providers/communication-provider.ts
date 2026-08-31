export interface CommunicationProvider {
  readonly channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  send(input: {
    destination: string;
    subject?: string;
    body: string;
  }): Promise<{ providerMessageId: string }>;
}
export class ProviderNotConfiguredError extends Error {
  constructor(channel: string) {
    super(`No ${channel} communication provider is configured`);
    this.name = 'ProviderNotConfiguredError';
  }
}
