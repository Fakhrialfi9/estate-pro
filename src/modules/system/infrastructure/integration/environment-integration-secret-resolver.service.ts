import { Injectable } from '@nestjs/common';
import type { IntegrationSecretResolverPort } from '../../domain/integration/integration-secret-resolver.port.js';

@Injectable()
export class EnvironmentIntegrationSecretResolverService
  implements IntegrationSecretResolverPort
{
  resolve(reference: string): Promise<string> {
    const trimmed = reference.trim();
    if (!/^env:\/\/[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(trimmed))
      return Promise.reject(
        new Error('Integration secret reference is not supported'),
      );
    const key = trimmed.slice('env://'.length);
    const value = process.env[key];
    if (!value)
      return Promise.reject(new Error('Integration secret is unavailable'));
    return Promise.resolve(value);
  }
}
