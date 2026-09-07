import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertSafeOutboundUrl, UnsafeOutboundUrlError } from '../../../../common/security/outbound-url-policy.js';
import type { SystemWebhookNetworkPort } from '../../domain/webhook/webhook.ports.js';

@Injectable()
export class WebhookNetworkService implements SystemWebhookNetworkPort {
  constructor(private readonly config: ConfigService) {}

  async validateTarget(rawUrl: string): Promise<URL> {
    try {
      const url = await assertSafeOutboundUrl(rawUrl, {
        allowHttp: this.config.get<string>('system.allowLocalWebhookHttp') === 'true',
        allowLocalhostHttp:
          this.config.get<string>('system.allowLocalWebhookHttp') === 'true',
      });
      return new URL(url);
    } catch (error: unknown) {
      if (error instanceof UnsafeOutboundUrlError) {
        throw new UnprocessableEntityException(error.message.replace(/^Outbound/, 'Webhook'));
      }
      throw error;
    }
  }

  async send(input: {
    endpoint: string;
    payload: string;
    headers: Readonly<Record<string, string>>;
    timeoutMs: number;
  }): Promise<{ status: number }> {
    const endpoint = await this.validateTarget(input.endpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: input.headers,
        body: input.payload,
        signal: controller.signal,
      });
      return { status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}
