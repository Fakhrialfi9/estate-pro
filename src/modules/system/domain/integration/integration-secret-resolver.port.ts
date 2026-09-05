export const SYSTEM_INTEGRATION_SECRET_RESOLVER = Symbol(
  'SYSTEM_INTEGRATION_SECRET_RESOLVER',
);

export interface IntegrationSecretResolverPort {
  resolve(reference: string): Promise<string>;
}
