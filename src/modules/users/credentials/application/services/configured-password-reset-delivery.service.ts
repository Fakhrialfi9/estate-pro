import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PasswordResetDelivery, PasswordResetDeliveryPayload } from './password-reset.service.js';

@Injectable()
export class ConfiguredPasswordResetDeliveryService implements PasswordResetDelivery {
  constructor(private readonly config: ConfigService) {}

  async deliver(payload: PasswordResetDeliveryPayload): Promise<void> {
    const url = this.config.get<string | undefined>('auth.passwordReset.deliveryUrl');
    if (!url) return;

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userUuid: payload.userUuid,
        token: payload.token,
        expiresAt: payload.expiresAt.toISOString(),
      }),
      signal: AbortSignal.timeout(5_000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Password reset delivery failed with status ${response.status}`);
    });
  }
}
