import type { ConfigService } from '@nestjs/config';

type JsonSchema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  responses?: Record<string, ResponseObject>;
  parameters?: ResponseObject[];
  requestBody?: ResponseObject;
  security?: ResponseObject[];
};
type PathItem = Record<string, unknown>;
type OpenApiDocument = {
  openapi?: string;
  info?: Record<string, unknown>;
  tags?: ResponseObject[];
  components?: {
    schemas?: Record<string, JsonSchema>;
    responses?: Record<string, ResponseObject>;
  };
  paths?: Record<string, PathItem>;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
type HttpMethod = (typeof METHODS)[number];

const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });

const property = (type: string, extra: JsonSchema = {}): JsonSchema => ({ type, ...extra });

const response = (
  description: string,
  schema?: JsonSchema,
  headers?: Record<string, JsonSchema>,
): ResponseObject => ({
  description,
  ...(schema ? { content: { 'application/json': { schema } } } : {}),
  ...(headers ? { headers } : {}),
});

const objectSchema = (
  properties: Record<string, JsonSchema>,
  required: string[] = [],
  extra: JsonSchema = {},
): JsonSchema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});

const arraySchema = (items: JsonSchema): JsonSchema => ({
  type: 'array',
  items,
});

const successSchema = objectSchema({
  success: property('boolean', { example: true }),
}, ['success']);

const paginationMeta = objectSchema({
  page: property('integer', { minimum: 1, example: 1 }),
  limit: property('integer', { minimum: 1, maximum: 100, example: 20 }),
  total: property('integer', { minimum: 0, example: 42 }),
  totalPages: property('integer', { minimum: 0, example: 3 }),
}, ['page', 'limit', 'total', 'totalPages']);

const apiError = objectSchema({
  statusCode: property('integer', { example: 400 }),
  code: property('string', { example: 'BAD_REQUEST' }),
  message: property('array', {
    items: property('string'),
    description: 'Error message or validation messages.',
  }),
  path: property('string', { example: '/api/v1/users' }),
  timestamp: property('string', { format: 'date-time', example: '2026-01-01T00:00:00.000Z' }),
}, ['statusCode', 'code', 'message', 'path', 'timestamp']);

const validationError = objectSchema({
  statusCode: property('integer', { example: 400 }),
  code: property('string', { example: 'BAD_REQUEST' }),
  message: property('array', { items: property('string'), example: ['property must be a string'] }),
  path: property('string', { example: '/api/v1/users' }),
  timestamp: property('string', { format: 'date-time', example: '2026-01-01T00:00:00.000Z' }),
}, ['statusCode', 'code', 'message', 'path', 'timestamp']);

const userResponse = objectSchema({
  uuid: property('string', { format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' }),
  username: property('string', { nullable: true, example: 'estate.admin' }),
  email: property('string', { nullable: true, format: 'email', example: 'admin@example.com' }),
  phone: property('string', { nullable: true, example: '+628123456789' }),
  status: property('string', { example: 'active' }),
  isActive: property('boolean', { example: true }),
  isVerified: property('boolean', { example: true }),
  createdAt: property('string', { format: 'date-time' }),
  updatedAt: property('string', { format: 'date-time' }),
}, ['uuid', 'username', 'email', 'phone', 'status', 'isActive', 'isVerified', 'createdAt', 'updatedAt']);

const userListResponse = objectSchema({
  items: arraySchema(ref('UserResponse')),
  meta: ref('PaginationMeta'),
}, ['items', 'meta']);

const authTokenResponse = objectSchema({
  accessToken: property('string', { description: 'Short-lived access token. Sensitive.', example: 'eyJhbGciOi...redacted' }),
  tokenType: property('string', { enum: ['Bearer'], example: 'Bearer' }),
  expiresIn: property('integer', { minimum: 1, example: 900 }),
  refreshToken: property('string', { description: 'Rotating opaque refresh token. Sensitive.', example: 'refresh-token-placeholder' }),
  refreshTokenExpiresIn: property('integer', { minimum: 1, example: 2592000 }),
}, ['accessToken', 'tokenType', 'expiresIn', 'refreshToken', 'refreshTokenExpiresIn']);

const mfaChallengeResponse = objectSchema({
  mfaRequired: property('boolean', { enum: [true], example: true }),
  challengeToken: property('string', { description: 'Short-lived MFA challenge token. Sensitive.', example: 'mfa-challenge-placeholder' }),
  expiresIn: property('integer', { minimum: 1, example: 300 }),
}, ['mfaRequired', 'challengeToken', 'expiresIn']);

const sessionResponse = objectSchema({
  id: property('string', { pattern: '^\\d+$', example: '123' }),
  status: property('string', { enum: ['active', 'expired', 'revoked'], example: 'active' }),
  ipAddress: property('string', { nullable: true, example: '203.0.113.10' }),
  userAgent: property('string', { nullable: true, example: 'Mozilla/5.0' }),
  createdAt: property('string', { format: 'date-time' }),
  lastActivityAt: property('string', { nullable: true, format: 'date-time' }),
  expiresAt: property('string', { format: 'date-time' }),
  revokedAt: property('string', { nullable: true, format: 'date-time' }),
}, ['id', 'status', 'ipAddress', 'userAgent', 'createdAt', 'lastActivityAt', 'expiresAt', 'revokedAt']);

const sessionListResponse = objectSchema({
  data: arraySchema(ref('SessionResponse')),
}, ['data']);

const logoutAllResponse = objectSchema({
  success: property('boolean', { example: true }),
  revokedCount: property('integer', { minimum: 0, example: 2 }),
}, ['success', 'revokedCount']);

const twoFactorStatus = objectSchema({ enabled: property('boolean', { example: true }) }, ['enabled']);
const enrollmentResponse = objectSchema({
  method: property('string', { enum: ['totp'], example: 'totp' }),
  provisioningUri: property('string', { description: 'TOTP provisioning URI. Sensitive provisioning material.', example: 'otpauth://totp/...' }),
  verificationRequired: property('boolean', { enum: [true], example: true }),
}, ['method', 'provisioningUri', 'verificationRequired']);
const enabledRecoveryResponse = objectSchema({
  enabled: property('boolean', { enum: [true], example: true }),
  recoveryCodes: arraySchema(property('string', { description: 'Single-use recovery code. Sensitive.' })),
}, ['enabled', 'recoveryCodes']);
const recoveryCodesResponse = objectSchema({
  recoveryCodes: arraySchema(property('string', { description: 'Single-use recovery code. Sensitive.' })),
}, ['recoveryCodes']);

const propertyTypeResponse = objectSchema({
  uuid: property('string', { format: 'uuid' }),
  code: property('string', { example: 'HOUSE' }),
  name: property('string', { example: 'House' }),
  slug: property('string', { example: 'house' }),
  description: property('string', { nullable: true }),
  icon: property('string', { nullable: true }),
  isActive: property('boolean'),
  sortOrder: property('integer'),
  createdAt: property('string', { format: 'date-time' }),
  updatedAt: property('string', { format: 'date-time' }),
}, ['uuid', 'code', 'name', 'slug', 'description', 'icon', 'isActive', 'sortOrder', 'createdAt', 'updatedAt']);
const propertyTypeListResponse = objectSchema({
  items: arraySchema(ref('PropertyTypeResponse')),
  meta: ref('PaginationMeta'),
}, ['items', 'meta']);

const propertyCatalogResponse = objectSchema({
  uuid: property('string', { format: 'uuid' }),
  code: property('string'),
  name: property('string'),
  slug: property('string'),
  description: property('string', { nullable: true }),
  icon: property('string', { nullable: true }),
  isActive: property('boolean'),
  sortOrder: property('integer'),
  createdAt: property('string', { format: 'date-time' }),
  updatedAt: property('string', { format: 'date-time' }),
}, ['uuid', 'code', 'name', 'slug', 'description', 'icon', 'isActive', 'sortOrder', 'createdAt', 'updatedAt']);
const propertyCatalogListResponse = objectSchema({
  data: arraySchema(ref('PropertyCatalogResponse')),
  meta: ref('PaginationMeta'),
}, ['data', 'meta']);

const propertyResponse = objectSchema({
  uuid: property('string', { format: 'uuid' }),
  businessCode: property('string', { maxLength: 40 }),
  referenceNumber: property('string', { maxLength: 80 }),
  title: property('string', { minLength: 3, maxLength: 200 }),
  slug: property('string', { maxLength: 220 }),
  shortDescription: property('string', { nullable: true }),
  description: property('string', { nullable: true }),
  status: property('string', { enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'] }),
  availabilityStatus: property('string', { enum: ['AVAILABLE', 'UNAVAILABLE'] }),
  availableFrom: property('string', { nullable: true, format: 'date-time' }),
  availableTo: property('string', { nullable: true, format: 'date-time' }),
  version: property('integer', { minimum: 1 }),
  publishedAt: property('string', { nullable: true, format: 'date-time' }),
  verifiedAt: property('string', { nullable: true, format: 'date-time' }),
  createdAt: property('string', { format: 'date-time' }),
  updatedAt: property('string', { format: 'date-time' }),
}, ['uuid', 'businessCode', 'referenceNumber', 'title', 'slug', 'shortDescription', 'description', 'status', 'availabilityStatus', 'availableFrom', 'availableTo', 'version', 'publishedAt', 'verifiedAt', 'createdAt', 'updatedAt']);
const propertyWrappedResponse = objectSchema({ data: ref('PropertyResponse') }, ['data']);
const propertyListResponse = objectSchema({ data: arraySchema(ref('PropertyResponse')), meta: ref('PaginationMeta') }, ['data', 'meta']);
const propertyNestedResponse = objectSchema({
  data: property('object', {
    description: 'Public serialized property subresource. Fields are owned by the corresponding property detail/extras endpoint.',
  }),
}, ['data']);

const addSchemas = (document: OpenApiDocument): void => {
  const schemas = document.components?.schemas ?? (document.components = { schemas: {} }).schemas!;
  Object.assign(schemas, {
    ApiErrorResponse: apiError,
    ValidationErrorResponse: validationError,
    PaginationMeta: paginationMeta,
    SuccessResponse: successSchema,
    UserResponse: userResponse,
    UserListResponse: userListResponse,
    AuthTokenResponse: authTokenResponse,
    MfaChallengeResponse: mfaChallengeResponse,
    SessionResponse: sessionResponse,
    SessionListResponse: sessionListResponse,
    LogoutAllResponse: logoutAllResponse,
    TwoFactorStatusResponse: twoFactorStatus,
    TwoFactorEnrollmentResponse: enrollmentResponse,
    TwoFactorEnabledRecoveryResponse: enabledRecoveryResponse,
    RecoveryCodesResponse: recoveryCodesResponse,
    PropertyTypeResponse: propertyTypeResponse,
    PropertyTypeListResponse: propertyTypeListResponse,
    PropertyCatalogResponse: propertyCatalogResponse,
    PropertyCatalogListResponse: propertyCatalogListResponse,
    PropertyResponse: propertyResponse,
    PropertyWrappedResponse: propertyWrappedResponse,
    PropertyListResponse: propertyListResponse,
    PropertyNestedResponse: propertyNestedResponse,
  });
};

const addResponses = (document: OpenApiDocument): void => {
  const responses = document.components?.responses ?? (document.components = { ...(document.components ?? {}), responses: {} }).responses!;
  const reusable = (status: number, description: string): ResponseObject => response(description, ref('ApiErrorResponse'));
  Object.assign(responses, {
    BadRequest: reusable(400, 'Request validation or business input is invalid.'),
    Unauthorized: reusable(401, 'Authentication is required or failed.'),
    Forbidden: reusable(403, 'Authenticated principal is not authorized.'),
    NotFound: reusable(404, 'Requested resource was not found.'),
    Conflict: reusable(409, 'Request conflicts with current resource state.'),
    TooManyRequests: reusable(429, 'Rate limit exceeded.'),
    InternalServerError: reusable(500, 'Unexpected server error.'),
    ServiceUnavailable: reusable(503, 'Required infrastructure service is unavailable.'),
  });
};

const operationEntries = (document: OpenApiDocument): Array<[string, HttpMethod, Operation]> => {
  const output: Array<[string, HttpMethod, Operation]> = [];
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const candidate = pathItem[method];
      if (candidate && typeof candidate === 'object') output.push([path, method, candidate as Operation]);
    }
  }
  return output;
};

const setSuccess = (operation: Operation, status: number, schema: JsonSchema, description: string): void => {
  const responses = operation.responses ?? (operation.responses = {});
  responses[String(status)] = response(description, schema);
};

const setNoContent = (operation: Operation, description: string): void => {
  const responses = operation.responses ?? (operation.responses = {});
  responses['204'] = response(description);
};

const addErrorRefs = (operation: Operation, statuses: number[]): void => {
  const responses = operation.responses ?? (operation.responses = {});
  for (const status of statuses) {
    const name =
      status === 400 ? 'BadRequest' :
      status === 401 ? 'Unauthorized' :
      status === 403 ? 'Forbidden' :
      status === 404 ? 'NotFound' :
      status === 409 ? 'Conflict' :
      status === 429 ? 'TooManyRequests' :
      status === 500 ? 'InternalServerError' :
      status === 503 ? 'ServiceUnavailable' : undefined;
    if (!name) continue;
    responses[String(status)] = { $ref: `#/components/responses/${name}` };
  }
};

const setSecurity = (operation: Operation, protectedEndpoint: boolean): void => {
  operation.security = protectedEndpoint ? [{ bearer: [] }] : [];
};

const parameter = (
  name: string,
  location: 'path' | 'query',
  schema: JsonSchema,
  description: string,
  required: boolean,
): ResponseObject => ({
  name,
  in: location,
  required,
  description,
  schema,
});

const ensureParameter = (operation: Operation, value: ResponseObject): void => {
  const parameters = operation.parameters ?? (operation.parameters = []);
  const name = typeof value.name === 'string' ? value.name : '';
  const location = typeof value.in === 'string' ? value.in : '';
  if (!parameters.some((item) => item.name === name && item.in === location)) parameters.push(value);
};

const setPathParameter = (operation: Operation, name: string, schema: JsonSchema, description: string): void => {
  ensureParameter(operation, parameter(name, 'path', schema, description, true));
};

const setQueryParameter = (operation: Operation, name: string, schema: JsonSchema, description: string, required = false): void => {
  ensureParameter(operation, parameter(name, 'query', schema, description, required));
};

const hasBody = (operation: Operation): boolean => Boolean(operation.requestBody);

const setOperationId = (operation: Operation, path: string, method: HttpMethod): void => {
  if (typeof operation.operationId !== 'string' || operation.operationId.trim() === '') {
    operation.operationId = `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
  }
};

const addQueryContract = (operation: Operation, queryType: 'users' | 'properties' | 'propertyTypes' | 'catalog'): void => {
  if (queryType === 'users') {
    setQueryParameter(operation, 'page', property('integer', { minimum: 1, maximum: 100, default: 1 }), 'Page number.', false);
    setQueryParameter(operation, 'limit', property('integer', { minimum: 1, maximum: 100, default: 20 }), 'Maximum number of records.', false);
    setQueryParameter(operation, 'filterField', property('string', { enum: ['username', 'email', 'phone', 'status', 'isActive'] }), 'Filter field. Must be paired with filterValue.', false);
    setQueryParameter(operation, 'filterValue', property('string', { maxLength: 100 }), 'Filter value. Required when filterField is present; for isActive use true or false.', false);
    setQueryParameter(operation, 'sortBy', property('string', { enum: ['uuid', 'username', 'email', 'phone', 'status', 'createdAt', 'updatedAt'], default: 'createdAt' }), 'Allowed user sort field.', false);
    setQueryParameter(operation, 'sortDirection', property('string', { enum: ['asc', 'desc'], default: 'desc' }), 'Sort direction.', false);
    setQueryParameter(operation, 'search', property('string', { maxLength: 100 }), 'Searches supported user identity fields.', false);
  }
  if (queryType === 'properties') {
    setQueryParameter(operation, 'page', property('integer', { minimum: 1, maximum: 100 }), 'Page number.', false);
    setQueryParameter(operation, 'limit', property('integer', { minimum: 1, maximum: 100 }), 'Maximum number of records.', false);
    setQueryParameter(operation, 'search', property('string', { maxLength: 100 }), 'Search term.', false);
    setQueryParameter(operation, 'sortBy', property('string', { maxLength: 50 }), 'Property sorting field accepted by runtime.', false);
    setQueryParameter(operation, 'sortDirection', property('string', { enum: ['asc', 'desc'] }), 'Sort direction.', false);
    setQueryParameter(operation, 'isActive', property('boolean'), 'Filter by active state.', false);
    for (const name of ['parentUuid', 'typeUuid', 'categoryUuid', 'subcategoryUuid']) {
      setQueryParameter(operation, name, property('string', { format: 'uuid' }), 'UUID filter.', false);
    }
    setQueryParameter(operation, 'status', property('string', { enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'] }), 'Property lifecycle status.', false);
    setQueryParameter(operation, 'category', property('string', { enum: ['OUTDOOR', 'SECURITY', 'TECHNOLOGY', 'PARKING', 'CLIMATE', 'UTILITY', 'ACCESSIBILITY', 'RECREATION', 'OTHER'] }), 'Facility category filter.', false);
  }
  if (queryType === 'propertyTypes') {
    setQueryParameter(operation, 'page', property('integer', { minimum: 1, default: 1 }), 'Page number.', false);
    setQueryParameter(operation, 'limit', property('integer', { minimum: 1, maximum: 100, default: 20 }), 'Maximum number of records.', false);
    setQueryParameter(operation, 'filterField', property('string', { enum: ['code', 'name', 'slug', 'isActive'] }), 'Filter field. Must be paired with filterValue.', false);
    setQueryParameter(operation, 'filterValue', property('string', { minLength: 1, maxLength: 100 }), 'Filter value. Required when filterField is present.', false);
    setQueryParameter(operation, 'sortBy', property('string', { enum: ['code', 'name', 'slug', 'isActive', 'sortOrder', 'createdAt', 'updatedAt'], default: 'createdAt' }), 'Allowed property type sort field.', false);
    setQueryParameter(operation, 'sortDirection', property('string', { enum: ['asc', 'desc'], default: 'desc' }), 'Sort direction.', false);
    setQueryParameter(operation, 'search', property('string', { minLength: 1, maxLength: 100 }), 'Search term.', false);
  }
  if (queryType === 'catalog') {
    setQueryParameter(operation, 'page', property('integer', { minimum: 1 }), 'Page number.', false);
    setQueryParameter(operation, 'limit', property('integer', { minimum: 1, maximum: 100 }), 'Maximum number of records.', false);
    setQueryParameter(operation, 'search', property('string', { maxLength: 100 }), 'Search term.', false);
    setQueryParameter(operation, 'isActive', property('boolean'), 'Filter by active state.', false);
    setQueryParameter(operation, 'typeUuid', property('string', { format: 'uuid' }), 'Property type UUID filter.', false);
  }
};

const classifyPropertySubresource = (path: string): boolean =>
  /\\/api\\/v1\\/property\\/properties\\/[^/]+\\//.test(path) ||
  /\\/api\\/v1\\/property\\/properties$/.test(path) === false && path.includes('/property/properties/');

export const applyOpenApiContract = (
  document: OpenApiDocument,
  configService?: ConfigService,
): OpenApiDocument => {
  addSchemas(document);
  addResponses(document);

  if (configService && document.info) {
    const configuredVersion = configService.get<string>('app.version');
    if (configuredVersion) document.info.version = configuredVersion;
    const appName = configService.get<string>('app.name');
    if (appName) document.info.title = `${appName} API`;
  }
  if (document.info) {
    document.info.description = 'Estate Pro HTTP API. OpenAPI documents describe the public v1 API contract and reflect runtime validation, serialization, authentication, authorization, and error behavior.';
  }

  for (const [path, method, operation] of operationEntries(document)) {
    setOperationId(operation, path, method);
    const normalized = path.replace(/^\\/api\\/v1\\//, '/');
    const isPublic =
      normalized === '/auth/login' ||
      normalized === '/auth/refresh' ||
      normalized === '/auth/2fa/verify' ||
      normalized === '/health/live' ||
      normalized === '/health/ready';
    setSecurity(operation, !isPublic);

    if (method === 'get' && normalized === '/users') addQueryContract(operation, 'users');
    if (method === 'get' && normalized === '/property-types') addQueryContract(operation, 'propertyTypes');
    if (method === 'get' && /^\\/property\\/(categories|subcategories|facilities)$/.test(normalized)) addQueryContract(operation, 'catalog');
    if (method === 'get' && /^\\/property\\/locations\\//.test(normalized)) {
      setPathParameter(operation, 'level', property('string', { enum: ['country', 'province', 'city', 'district', 'subdistrict'] }), 'Location hierarchy level.');
      if (normalized.split('/').length > 4 && !normalized.endsWith('/children')) {
        setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Location UUID.');
      }
      if (normalized.endsWith('/children')) setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Parent location UUID.');
      addQueryContract(operation, 'catalog');
    }
    if (normalized === '/property/properties' && method === 'get') addQueryContract(operation, 'properties');

    if (normalized.startsWith('/users/')) {
      if (normalized.includes('/email/')) setPathParameter(operation, 'email', property('string', { format: 'email' }), 'User email address.');
      else if (normalized.includes('/username/')) setPathParameter(operation, 'username', property('string', { maxLength: 100 }), 'Username.');
      else setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'User UUID.');
    }

    if (normalized.startsWith('/auth/sessions/')) {
      if (normalized.includes('/users/')) {
        setPathParameter(operation, 'userUuid', property('string', { format: 'uuid' }), 'Target user UUID.');
        setPathParameter(operation, 'id', property('string', { pattern: '^\\d+$' }), 'Public numeric session identifier.');
      } else if (normalized !== '/auth/sessions/logout-all') {
        setPathParameter(operation, 'id', property('string', { pattern: '^\\d+$' }), 'Public numeric session identifier.');
      }
    }

    if (normalized.startsWith('/property')) {
      const hasPropertyUuid = normalized.includes('/properties/');
      if (hasPropertyUuid) setPathParameter(operation, 'propertyUuid', property('string', { format: 'uuid' }), 'Property UUID.');
      if (normalized.includes(':uuid')) setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Resource UUID.');
      if (normalized.includes('/categories/') || normalized.includes('/subcategories/') || normalized.includes('/facilities/')) setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Resource UUID.');
      if (normalized.includes('/certificates/')) setPathParameter(operation, 'certificateUuid', property('string', { format: 'uuid' }), 'Certificate UUID.');
      if (normalized.includes('/media/')) setPathParameter(operation, 'mediaUuid', property('string', { format: 'uuid' }), 'Media UUID.');
      if (normalized.includes('/rooms/')) setPathParameter(operation, 'roomUuid', property('string', { format: 'uuid' }), 'Room UUID.');
      if (/^\\/property\\/properties\\/[^/]+\\/(specifications|location|building|rooms|facilities|utilities|legal|certificates|financial|features|security|environment|seo|media)/.test(normalized)) {
        setSuccess(operation, method === 'post' ? 201 : 200, ref('PropertyNestedResponse'), 'Serialized property subresource.');
      }
    }

    if (normalized === '/auth/login' && method === 'post') {
      setSuccess(operation, 201, { oneOf: [ref('AuthTokenResponse'), ref('MfaChallengeResponse')] }, 'Authentication succeeded or an MFA challenge was issued.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/refresh' && method === 'post') {
      setSuccess(operation, 200, ref('AuthTokenResponse'), 'Tokens rotated successfully.');
      const responses = operation.responses ?? (operation.responses = {});
      responses['200'] = response('Tokens rotated successfully.', ref('AuthTokenResponse'), {
        'Cache-Control': { schema: property('string', { example: 'no-store' }) },
      });
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/logout' && method === 'post') {
      setSuccess(operation, 201, ref('SuccessResponse'), 'Current session revoked.');
      addErrorRefs(operation, [401, 500]);
    } else if (normalized === '/auth/me' && method === 'get') {
      setSuccess(operation, 200, ref('UserResponse'), 'Current user returned.');
      addErrorRefs(operation, [401, 404, 500]);
    } else if (normalized === '/auth/sessions' && method === 'get') {
      setSuccess(operation, 200, ref('SessionListResponse'), 'Own sessions returned.');
      addErrorRefs(operation, [401, 429, 500]);
    } else if (normalized === '/auth/sessions/logout-all' && method === 'post') {
      setSuccess(operation, 201, ref('LogoutAllResponse'), 'All own sessions revoked.');
      addErrorRefs(operation, [401, 429, 500]);
    } else if (/^\\/auth\\/sessions\\/[^/]+$/.test(normalized) && method === 'delete') {
      setSuccess(operation, 200, ref('SuccessResponse'), 'Session revoked.');
      addErrorRefs(operation, [400, 401, 404, 429, 500]);
    } else if (/^\\/admin\\/session-management\\/users\\/[^/]+\\/sessions\\/[^/]+\\/revoke$/.test(normalized) && method === 'post') {
      setSuccess(operation, 201, ref('SuccessResponse'), 'Target session revoked.');
      addErrorRefs(operation, [400, 401, 403, 404, 429, 500]);
    } else if (normalized === '/auth/2fa' && method === 'get') {
      setSuccess(operation, 200, ref('TwoFactorStatusResponse'), 'Two-factor authentication status returned.');
      addErrorRefs(operation, [401, 429, 500]);
    } else if (normalized === '/auth/2fa/enrollment' && method === 'post') {
      setSuccess(operation, 201, ref('TwoFactorEnrollmentResponse'), 'Two-factor enrollment started.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/2fa/enrollment/verify' && method === 'post') {
      setSuccess(operation, 201, ref('TwoFactorEnabledRecoveryResponse'), 'Two-factor enrollment verified.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/2fa/verify' && method === 'post') {
      setSecurity(operation, false);
      setSuccess(operation, 201, ref('AuthTokenResponse'), 'MFA verification succeeded and a session was issued.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/2fa/recovery-codes/regenerate' && method === 'post') {
      setSuccess(operation, 201, ref('RecoveryCodesResponse'), 'Recovery codes regenerated.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/auth/2fa/disable' && method === 'post') {
      setSuccess(operation, 201, ref('SuccessResponse'), 'Two-factor authentication disabled.');
      addErrorRefs(operation, [400, 401, 429, 500]);
    } else if (normalized === '/users' && method === 'post') {
      setSuccess(operation, 201, ref('UserResponse'), 'User created.');
      addErrorRefs(operation, [400, 401, 403, 409, 500]);
    } else if (normalized === '/users' && method === 'get') {
      setSuccess(operation, 200, ref('UserListResponse'), 'Users returned.');
      addErrorRefs(operation, [400, 401, 403, 500]);
    } else if (/^\\/users\\/(email|username)\\//.test(normalized) && method === 'get') {
      setSuccess(operation, 200, ref('UserResponse'), 'User returned.');
      addErrorRefs(operation, [400, 401, 403, 404, 500]);
    } else if (/^\\/users\\/[^/]+$/.test(normalized) && method === 'get') {
      setSuccess(operation, 200, ref('UserResponse'), 'User returned.');
      addErrorRefs(operation, [400, 401, 403, 404, 500]);
    } else if (/^\\/users\\/[^/]+$/.test(normalized) && method === 'patch') {
      setSuccess(operation, 200, ref('UserResponse'), 'User updated.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/users\\/[^/]+$/.test(normalized) && method === 'delete') {
      setNoContent(operation, 'User deactivated.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (normalized === '/property-types' && method === 'post') {
      setSuccess(operation, 201, ref('PropertyTypeResponse'), 'Property type created.');
      addErrorRefs(operation, [400, 401, 403, 409, 500]);
    } else if (normalized === '/property-types' && method === 'get') {
      setSuccess(operation, 200, ref('PropertyTypeListResponse'), 'Property types returned.');
      addErrorRefs(operation, [400, 401, 403, 500]);
    } else if (/^\\/property-types\\/[^/]+$/.test(normalized) && method === 'get') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property type UUID.');
      setSuccess(operation, 200, ref('PropertyTypeResponse'), 'Property type returned.');
      addErrorRefs(operation, [400, 401, 403, 404, 500]);
    } else if (/^\\/property-types\\/[^/]+$/.test(normalized) && method === 'patch') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property type UUID.');
      setSuccess(operation, 200, ref('PropertyTypeResponse'), 'Property type updated.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/property-types\\/[^/]+$/.test(normalized) && method === 'delete') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property type UUID.');
      setNoContent(operation, 'Property type deleted.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (normalized === '/property/properties' && method === 'post') {
      setSuccess(operation, 201, ref('PropertyWrappedResponse'), 'Property created.');
      addErrorRefs(operation, [400, 401, 403, 409, 500]);
    } else if (normalized === '/property/properties' && method === 'get') {
      setSuccess(operation, 200, ref('PropertyListResponse'), 'Properties returned.');
      addErrorRefs(operation, [400, 401, 403, 500]);
    } else if (/^\\/property\\/properties\\/[^/]+$/.test(normalized) && method === 'get') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property UUID.');
      setSuccess(operation, 200, ref('PropertyWrappedResponse'), 'Property returned.');
      addErrorRefs(operation, [400, 401, 403, 404, 500]);
    } else if (/^\\/property\\/properties\\/[^/]+$/.test(normalized) && method === 'patch') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property UUID.');
      setSuccess(operation, 200, ref('PropertyWrappedResponse'), 'Property updated.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/property\\/properties\\/[^/]+$/.test(normalized) && method === 'delete') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property UUID.');
      setNoContent(operation, 'Property deleted.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/property\\/properties\\/[^/]+\\/(restore|duplicate)$/.test(normalized) && method === 'post') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property UUID.');
      setSuccess(operation, 201, ref('PropertyWrappedResponse'), 'Property operation completed.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/property\\/properties\\/[^/]+\\/(verify|publish)$/.test(normalized) && method === 'post') {
      setPathParameter(operation, 'uuid', property('string', { format: 'uuid' }), 'Property UUID.');
      setSuccess(operation, 201, ref('PropertyResponse'), 'Property lifecycle operation completed.');
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    } else if (/^\\/health\\/live$/.test(normalized) && method === 'get') {
      setSecurity(operation, false);
      setSuccess(operation, 200, property('object'), 'Liveness check succeeded.');
    } else if (/^\\/health\\/ready$/.test(normalized) && method === 'get') {
      setSecurity(operation, false);
      setSuccess(operation, 200, property('object'), 'Readiness check succeeded.');
      addErrorRefs(operation, [503]);
    } else if (classifyPropertySubresource(path)) {
      addErrorRefs(operation, [400, 401, 403, 404, 409, 500]);
    }

    if (hasBody(operation) && operation.requestBody) {
      const content = operation.requestBody.content;
      if (content && typeof content === 'object') {
        const json = (content as Record<string, unknown>)['application/json'];
        if (json && typeof json === 'object') {
          const media = json as Record<string, unknown>;
          media.schema = media.schema ?? { type: 'object' };
        }
      }
    }
  }

  return document;
};
