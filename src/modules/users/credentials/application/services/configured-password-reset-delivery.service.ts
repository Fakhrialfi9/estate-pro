import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertSafeOutboundUrl } from '../../../../../common/security/outbound-url-policy.js';
import type {
  PasswordResetDelivery,
  PasswordResetDeliveryPayload,
} from './password-reset.service.js';

@Injectable()
export class ConfiguredPasswordResetDeliveryService
  implements PasswordResetDelivery
{
  constructor(private readonly config: ConfigService) {}

  async deliver(payload: PasswordResetDeliveryPayload): Promise<void> {
    const url = this.config.get<string | undefined>(
      'auth.passwordReset.deliveryUrl',
    );
    if (!url) return;

    const safeUrl = await assertSafeOutboundUrl(url);
    const response = await fetch(safeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userUuid: payload.userUuid,
        token: payload.token,
        expiresAt: payload.expiresAt.toISOString(),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(
        `Password reset delivery failed with status ${response.status}`,
      );
    }
  }
}
