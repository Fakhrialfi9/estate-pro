import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import type {
  CanonicalIntegrationRequest,
  CanonicalIntegrationResponse,
} from '../../domain/integration/integration-operation.contracts.js';
import {
  SYSTEM_INTEGRATION_SECRET_RESOLVER,
  type IntegrationSecretResolverPort,
} from '../../domain/integration/integration-secret-resolver.port.js';

const CAPABILITIES = [
  'PUSH',
  'HEALTH',
  'REQUEST_MAPPING',
  'RESPONSE_MAPPING',
  'RECONNECT',
  'INBOUND',
  'SIGNATURE_VALIDATION',
] as const;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

@Injectable()
export class GenericHttpIntegrationProvider implements IntegrationProviderPort {
  readonly key = 'http';
  readonly version = '1';
  readonly capabilities = CAPABILITIES;

  constructor(
    @Inject(SYSTEM_INTEGRATION_SECRET_RESOLVER)
    private readonly secrets: IntegrationSecretResolverPort,
  ) {}

  async testConnection(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }) {
    const result = await this.health(input);
    return {
      ok: result.ok,
      latencyMs: result.latencyMs,
      code: result.code,
      message: result.ok ? undefined : 'Provider health request failed',
    };
  }

  async reconnect(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }) {
    try {
      const endpoint =
        stringValue(input.metadata.reconnectUrl) ??
        stringValue(input.metadata.endpoint);
      if (!endpoint) {
        return {
          ok: false,
          code: 'RECONNECT_ENDPOINT_NOT_CONFIGURED',
          message: 'Integration reconnect endpoint is not configured',
        };
      }
      const url = await assertPublicHttpsUrl(endpoint);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        numberValue(input.metadata.timeoutMs, DEFAULT_TIMEOUT_MS),
      );
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            ...(await this.authorizationHeaders(input.metadata, input.secretRef)),
          },
          body: JSON.stringify({ operation: 'reconnect' }),
          redirect: 'error',
          signal: controller.signal,
        });
        return {
          ok: response.ok,
          code: response.ok ? undefined : `HTTP_${response.status}`,
          message: response.ok ? undefined : 'Provider reconnect request failed',
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (error: unknown) {
      return {
        ok: false,
        code: this.errorCode(error),
        message: safeMessage(error),
      };
    }
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async health(input?: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }): Promise<{
    ok: boolean;
    latencyMs: number;
    code: string;
  }> {
    const metadata = input?.metadata ?? {};
    const endpoint =
      stringValue(metadata.healthUrl) ?? stringValue(metadata.endpoint);
    if (!endpoint)
      return {
        ok: false,
        latencyMs: 0,
        code: 'HEALTH_ENDPOINT_NOT_CONFIGURED',
      };
    const started = performance.now();
    try {
      const response = await this.request(
        metadata,
        input?.secretRef,
        'health',
        Math.min(
          DEFAULT_HEALTH_TIMEOUT_MS,
          numberValue(metadata.timeoutMs, DEFAULT_HEALTH_TIMEOUT_MS),
        ),
      );
      return {
        ok: response.ok,
        latencyMs: Math.round(performance.now() - started),
        code: response.ok ? 'UP' : `HTTP_${response.status}`,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        code: this.errorCode(error),
      };
    }
  }

  mapRequest(request: CanonicalIntegrationRequest) {
    return {
      operationKey: request.operationKey,
      direction: request.direction,
      resourceType: request.resourceType,
      resourceUuid: request.resourceUuid ?? null,
      payload: deepCloneRecord(request.payload),
      idempotencyKey: request.idempotencyKey,
      occurredAt: request.occurredAt.toISOString(),
    };
  }

  mapResponse(response: unknown): CanonicalIntegrationResponse {
    if (!isRecord(response) || typeof response.operationKey !== 'string')
      throw new Error('Provider response cannot be mapped to canonical response');
    const data = response.data;
    if (data !== undefined && !isRecord(data))
      throw new Error('Provider response data is invalid');
    const ok = response.ok !== false;
    if (ok && response.errorCode !== undefined && response.errorCode !== null)
      throw new Error('Successful provider response cannot contain an error');
    return {
      ok,
      operationKey: response.operationKey,
      ...(stringValue(response.resourceType)
        ? { resourceType: stringValue(response.resourceType)! }
        : {}),
      ...(stringValue(response.resourceUuid)
        ? { resourceUuid: stringValue(response.resourceUuid)! }
        : {}),
      data: isRecord(data) ? deepCloneRecord(data) : {},
      errorCode: stringValue(response.errorCode),
      errorMessage: ok ? null : this.safeProviderError(response.errorMessage),
      providerRequestId: stringValue(response.providerRequestId),
      receivedAt: new Date(),
    };
  }

  async push(
    request: CanonicalIntegrationRequest,
  ): Promise<CanonicalIntegrationResponse> {
    const metadata = request.payload;
    const endpoint =
      stringValue(metadata.pushUrl) ?? stringValue(metadata.endpoint);
    if (!endpoint) throw new Error('Integration push endpoint is not configured');

    const mapped = this.mapRequest(request);
    const response = await this.post(
      endpoint,
      mapped,
      request.idempotencyKey,
      numberValue(metadata.timeoutMs, DEFAULT_TIMEOUT_MS),
      stringValue(metadata.secretRef),
      metadata,
    );
    const body = await readJson(response);
    return this.mapResponse({
      ok: response.ok,
      operationKey: request.operationKey,
      resourceType: request.resourceType,
      resourceUuid: request.resourceUuid,
      data: isRecord(body) ? body : {},
      providerRequestId: response.headers.get('x-request-id'),
      errorCode: response.ok ? null : `HTTP_${response.status}`,
      errorMessage: response.ok ? null : 'Provider rejected push request',
    });
  }

  async verifySignature(input: {
    timestamp: string;
    body: string;
    signature: string;
    keyVersion?: string;
    secretRef?: string | null;
  }): Promise<boolean> {
    if (!input.secretRef) return false;
    try {
      const reference = keyVersion
        ? versionedReference(input.secretRef, keyVersion)
        : input.secretRef;
      const secret = await this.secrets.resolve(reference);
      const digest = createHmac('sha256', secret)
        .update(`${input.timestamp}.${input.body}`, 'utf8')
        .digest();
      const supplied = input.signature.trim().replace(/^sha256=/i, '');
      if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
      const expected = Buffer.from(supplied, 'hex');
      return expected.length === digest.length && timingSafeEqual(expected, digest);
    } catch {
      return false;
    }
  }

  private async request(
    metadata: Record<string, unknown>,
    secretRef: string | null | undefined,
    mode: 'health',
    timeoutMs: number,
  ) {
    const endpoint =
      stringValue(metadata.healthUrl) ?? stringValue(metadata.endpoint);
    if (!endpoint) throw new Error('Integration health endpoint is not configured');
    const url = await assertPublicHttpsUrl(endpoint);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(await this.authorizationHeaders(metadata, secretRef)),
          'x-integration-mode': mode,
        },
        redirect: 'error',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async post(
    endpoint: string,
    mappedRequest: Record<string, unknown>,
    idempotencyKey: string,
    timeoutMs: number,
    secretRef: string | null,
    metadata: Record<string, unknown>,
  ) {
    const url = await assertPublicHttpsUrl(endpoint);
    return fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        ...(await this.authorizationHeaders(metadata, secretRef)),
      },
      body: JSON.stringify(mappedRequest),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  private async authorizationHeaders(
    metadata: Record<string, unknown>,
    secretRef?: string | null,
  ): Promise<Record<string, string>> {
    if (!secretRef) return {};
    const secret = await this.secrets.resolve(secretRef);
    const scheme = stringValue(metadata.authScheme)?.toLowerCase() ?? 'bearer';
    if (scheme === 'apikey') {
      const header = stringValue(metadata.apiKeyHeader) ?? 'x-api-key';
      if (!/^[A-Za-z0-9-]{1,64}$/.test(header))
        throw new Error('Integration API key header is invalid');
      return { [header]: secret };
    }
    if (scheme !== 'bearer')
      throw new Error('Unsupported integration authentication scheme');
    return { authorization: `Bearer ${secret}` };
  }

  private errorCode(error: unknown) {
    if (error instanceof Error && /aborted|timeout/i.test(error.message))
      return 'PROVIDER_TIMEOUT';
    return 'PROVIDER_UNAVAILABLE';
  }

  private safeProviderError(value: unknown) {
    if (typeof value !== 'string') return 'Provider request failed';
    return value
      .replace(
        /(token|secret|password|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
        '$1=[REDACTED]',
      )
      .slice(0, 500);
  }
}

function versionedReference(baseReference: string, keyVersion: string): string {
  if (!/^env:\/\/[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(baseReference))
    return baseReference;
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyVersion))
    throw new Error('Invalid integration signature key version');
  return `${baseReference}_${keyVersion.toUpperCase()}`;
}

export async function assertPublicHttpsUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Integration provider URL is invalid');
  }
  if (url.protocol !== 'https:')
    throw new Error('Integration provider URL must use HTTPS');
  if (url.username || url.password)
    throw new Error('Integration provider URL cannot contain credentials');
  if (isPrivateHost(url.hostname))
    throw new Error('Integration provider URL targets a private network');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateHost(entry.address)))
    throw new Error('Integration provider URL resolves to a private network');
  return url.toString();
}

function isPrivateHost(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a = Number.NaN, b = Number.NaN] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }
  return (
    version === 6 && (address === '::1' || /^(fc|fd|fe80:)/i.test(address))
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES)
    throw new Error('Provider response exceeds limit');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { bodyHash: createHash('sha256').update(text).digest('hex') };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepCloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(60_000, Math.max(250, Math.trunc(value)))
    : fallback;
}

function safeMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
        .replace(
          /(token|secret|password|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,
          '$1=[REDACTED]',
        )
        .slice(0, 240)
    : 'Provider request failed';
}
