import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { IntegrationProviderPort } from '../../domain/integration/integration.contracts.js';
import type {
  CanonicalIntegrationRequest,
  CanonicalIntegrationResponse,
} from '../../domain/integration/integration-operation.contracts.js';

const CAPABILITIES = [
  'PUSH',
  'HEALTH',
  'REQUEST_MAPPING',
  'RESPONSE_MAPPING',
] as const;
const DEFAULT_TIMEOUT_MS = 10_000;

export class GenericHttpIntegrationProvider implements IntegrationProviderPort {
  readonly key = 'http';
  readonly version = '1';
  readonly capabilities = CAPABILITIES;

  async testConnection(input: {
    metadata: Record<string, unknown>;
    secretRef?: string | null;
  }) {
    const started = performance.now();
    try {
      const response = await this.request(
        input.metadata,
        input.secretRef,
        'health',
      );
      return {
        ok: response.ok,
        latencyMs: Math.round(performance.now() - started),
        code: response.ok ? undefined : `HTTP_${response.status}`,
        message: response.ok ? undefined : 'Provider health request failed',
      };
    } catch (error: unknown) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        code: 'PROVIDER_UNAVAILABLE',
        message: safeMessage(error),
      };
    }
  }

  async disconnect() {
    return undefined;
  }

  async health() {
    const started = performance.now();
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - started),
      code: 'STATIC_PROVIDER_REGISTRY_HEALTHY',
    };
  }

  mapRequest(request: CanonicalIntegrationRequest) {
    return request.payload;
  }

  mapResponse(response: unknown): CanonicalIntegrationResponse {
    if (isRecord(response) && typeof response.operationKey === 'string') {
      return {
        ok: response.ok !== false,
        operationKey: response.operationKey,
        resourceType: stringValue(response.resourceType),
        resourceUuid: stringValue(response.resourceUuid),
        data: isRecord(response.data) ? response.data : {},
        errorCode: stringValue(response.errorCode),
        errorMessage: stringValue(response.errorMessage),
        providerRequestId: stringValue(response.providerRequestId),
        receivedAt: new Date(),
      };
    }
    return {
      ok: true,
      operationKey: 'http',
      data: isRecord(response) ? response : {},
      errorCode: null,
      errorMessage: null,
      providerRequestId: null,
      receivedAt: new Date(),
    };
  }

  async push(
    request: CanonicalIntegrationRequest,
  ): Promise<CanonicalIntegrationResponse> {
    const metadata = request.payload;
    const endpoint =
      stringValue(metadata.pushUrl) ?? stringValue(metadata.endpoint);
    if (!endpoint) {
      throw new Error('Integration push endpoint is not configured');
    }
    const response = await this.post(endpoint, request, request.idempotencyKey);
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

  private async request(
    metadata: Record<string, unknown>,
    secretRef: string | null | undefined,
    mode: 'health',
  ) {
    const endpoint =
      stringValue(metadata.healthUrl) ?? stringValue(metadata.endpoint);
    if (!endpoint) {
      throw new Error('Integration health endpoint is not configured');
    }
    const url = await assertPublicHttpsUrl(endpoint);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      numberValue(metadata.timeoutMs, DEFAULT_TIMEOUT_MS),
    );
    try {
      return await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(secretRef ? { 'x-secret-ref': secretRef } : {}),
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
    request: CanonicalIntegrationRequest,
    idempotencyKey: string,
  ) {
    const url = await assertPublicHttpsUrl(endpoint);
    return fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        operationKey: request.operationKey,
        direction: request.direction,
        resourceType: request.resourceType,
        resourceUuid: request.resourceUuid ?? null,
        payload: request.payload,
        occurredAt: request.occurredAt.toISOString(),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  }
}

export async function assertPublicHttpsUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Integration provider URL is invalid');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Integration provider URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Integration provider URL cannot contain credentials');
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error('Integration provider URL targets a private network');
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.some((entry) => isPrivateHost(entry.address))) {
    throw new Error('Integration provider URL resolves to a private network');
  }
  return url.toString();
}

function isPrivateHost(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }
  return version === 6 && (address === '::1' || /^(fc|fd|fe80:)/i.test(address));
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
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
    ? error.message.slice(0, 240)
    : 'Provider request failed';
}
