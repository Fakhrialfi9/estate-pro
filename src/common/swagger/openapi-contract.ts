type Schema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  operationId?: string;
  responses?: Record<string, ResponseObject>;
  parameters?: ResponseObject[];
  requestBody?: ResponseObject;
  security?: ResponseObject[];
};
type Document = {
  openapi?: string;
  info?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, Schema>;
    responses?: Record<string, ResponseObject>;
  };
  paths?: Record<string, Record<string, unknown>>;
};

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
const METHODS: Method[] = ['get', 'post', 'patch', 'delete', 'put'];

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const schema = (type: string, extra: Schema = {}): Schema => ({ type, ...extra });
const objectSchema = (properties: Record<string, Schema>, required: string[] = []): Schema => ({
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
});
const arrayOf = (items: Schema): Schema => ({ type: 'array', items });
const apiResponse = (description: string, body?: Schema): ResponseObject => ({
  description,
  ...(body ? { content: { 'application/json': { schema: body } } } : {}),
});
const wrapped = (data: Schema): Schema => objectSchema({ data }, ['data']);

const errorResponse = objectSchema({
  statusCode: schema('integer', { example: 400 }),
  code: schema('string', { example: 'BAD_REQUEST' }),
  message: {
    oneOf: [schema('string'), arrayOf(schema('string'))],
    description: 'Public error message or validation messages.',
  },
  path: schema('string', { example: '/api/v1/users' }),
  timestamp: schema('string', { format: 'date-time' }),
}, ['statusCode', 'code', 'message', 'path', 'timestamp']);

const paginationMeta = objectSchema({
  page: schema('integer', { minimum: 1, example: 1 }),
  limit: schema('integer', { minimum: 1, maximum: 100, example: 20 }),
  total: schema('integer', { minimum: 0, example: 42 }),
  totalPages: schema('integer', { minimum: 0, example: 3 }),
}, ['page', 'limit', 'total', 'totalPages']);

const userResponse = objectSchema({
  uuid: schema('string', { format: 'uuid' }),
  username: schema('string', { nullable: true }),
  email: schema('string', { nullable: true, format: 'email' }),
  phone: schema('string', { nullable: true }),
  status: schema('string'),
  isActive: schema('boolean'),
  isVerified: schema('boolean'),
  createdAt: schema('string', { format: 'date-time' }),
  updatedAt: schema('string', { format: 'date-time' }),
}, ['uuid', 'username', 'email', 'phone', 'status', 'isActive', 'isVerified', 'createdAt', 'updatedAt']);

const authTokenResponse = objectSchema({
  accessToken: schema('string', { description: 'Short-lived access token. Sensitive.', example: 'access-token-placeholder' }),
  tokenType: schema('string', { enum: ['Bearer'] }),
  expiresIn: schema('integer', { minimum: 1 }),
  refreshToken: schema('string', { description: 'Opaque rotating refresh token. Sensitive.', example: 'refresh-token-placeholder' }),
  refreshTokenExpiresIn: schema('integer', { minimum: 1 }),
}, ['accessToken', 'tokenType', 'expiresIn', 'refreshToken', 'refreshTokenExpiresIn']);

const mfaChallengeResponse = objectSchema({
  mfaRequired: schema('boolean', { enum: [true] }),
  challengeToken: schema('string', { description: 'Short-lived MFA challenge token. Sensitive.', example: 'mfa-challenge-placeholder' }),
  expiresIn: schema('integer', { minimum: 1 }),
}, ['mfaRequired', 'challengeToken', 'expiresIn']);

const sessionResponse = objectSchema({
  id: schema('string', { pattern: '^\\d+$' }),
  status: schema('string', { enum: ['active', 'expired', 'revoked'] }),
  ipAddress: schema('string', { nullable: true }),
  userAgent: schema('string', { nullable: true }),
  createdAt: schema('string', { format: 'date-time' }),
  lastActivityAt: schema('string', { nullable: true, format: 'date-time' }),
  expiresAt: schema('string', { format: 'date-time' }),
  revokedAt: schema('string', { nullable: true, format: 'date-time' }),
}, ['id', 'status', 'ipAddress', 'userAgent', 'createdAt', 'lastActivityAt', 'expiresAt', 'revokedAt']);

const catalogResponse = objectSchema({
  uuid: schema('string', { format: 'uuid' }),
  code: schema('string'),
  name: schema('string'),
  slug: schema('string'),
  description: schema('string', { nullable: true }),
  icon: schema('string', { nullable: true }),
  isActive: schema('boolean'),
  sortOrder: schema('integer'),
  createdAt: schema('string', { format: 'date-time' }),
  updatedAt: schema('string', { format: 'date-time' }),
}, ['uuid', 'code', 'name', 'slug', 'description', 'icon', 'isActive', 'sortOrder', 'createdAt', 'updatedAt']);

const locationResponse = objectSchema({
  uuid: schema('string', { format: 'uuid' }),
  code: schema('string'),
  name: schema('string'),
  slug: schema('string'),
  isActive: schema('boolean'),
  sortOrder: schema('integer'),
  createdAt: schema('string', { format: 'date-time' }),
  updatedAt: schema('string', { format: 'date-time' }),
}, ['uuid', 'code', 'name', 'slug', 'isActive', 'sortOrder', 'createdAt', 'updatedAt']);

const propertyResponse = objectSchema({
  uuid: schema('string', { format: 'uuid' }),
  businessCode: schema('string', { maxLength: 40 }),
  referenceNumber: schema('string', { maxLength: 80 }),
  title: schema('string', { minLength: 3, maxLength: 200 }),
  slug: schema('string', { maxLength: 220 }),
  shortDescription: schema('string', { nullable: true }),
  description: schema('string', { nullable: true }),
  status: schema('string', { enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'] }),
  availabilityStatus: schema('string', { enum: ['AVAILABLE', 'UNAVAILABLE'] }),
  availableFrom: schema('string', { nullable: true, format: 'date-time' }),
  availableTo: schema('string', { nullable: true, format: 'date-time' }),
  version: schema('integer', { minimum: 1 }),
  publishedAt: schema('string', { nullable: true, format: 'date-time' }),
  verifiedAt: schema('string', { nullable: true, format: 'date-time' }),
  createdAt: schema('string', { format: 'date-time' }),
  updatedAt: schema('string', { format: 'date-time' }),
}, ['uuid', 'businessCode', 'referenceNumber', 'title', 'slug', 'shortDescription', 'description', 'status', 'availabilityStatus', 'availableFrom', 'availableTo', 'version', 'publishedAt', 'verifiedAt', 'createdAt', 'updatedAt']);

const nestedResponse = objectSchema({
  data: schema('object', {
    additionalProperties: true,
    description: 'Serialized public property detail/extra resource. Exact fields are owned by the corresponding runtime serializer.',
  }),
}, ['data']);

const successResponse = objectSchema({ success: schema('boolean', { example: true }) }, ['success']);
const logoutAllResponse = objectSchema({
  success: schema('boolean', { example: true }),
  revokedCount: schema('integer', { minimum: 0 }),
}, ['success', 'revokedCount']);
const twoFactorStatus = objectSchema({ enabled: schema('boolean') }, ['enabled']);
const enrollmentResponse = objectSchema({
  method: schema('string', { enum: ['totp'] }),
  provisioningUri: schema('string', { description: 'TOTP provisioning URI. Sensitive provisioning material.' }),
  verificationRequired: schema('boolean', { enum: [true] }),
}, ['method', 'provisioningUri', 'verificationRequired']);
const recoveryResponse = objectSchema({ recoveryCodes: arrayOf(schema('string', { description: 'Single-use recovery code. Sensitive.' })) }, ['recoveryCodes']);
const enabledRecoveryResponse = objectSchema({ enabled: schema('boolean', { enum: [true] }), recoveryCodes: arrayOf(schema('string', { description: 'Single-use recovery code. Sensitive.' })) }, ['enabled', 'recoveryCodes']);

const addSchema = (document: Document, name: string, value: Schema): void => {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas[name] = value;
};

const setResponse = (operation: Operation, status: number, body: Schema | undefined, description: string): void => {
  operation.responses ??= {};
  operation.responses[String(status)] = apiResponse(description, body);
};

const setNoContent = (operation: Operation, description: string): void => {
  operation.responses ??= {};
  operation.responses['204'] = apiResponse(description);
};

const setErrors = (operation: Operation, statuses: number[]): void => {
  operation.responses ??= {};
  const names: Record<number, string> = {
    400: 'BadRequest',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'NotFound',
    409: 'Conflict',
    429: 'TooManyRequests',
    500: 'InternalServerError',
    503: 'ServiceUnavailable',
  };
  for (const status of statuses) {
    const name = names[status];
    if (name) operation.responses[String(status)] = { $ref: `#/components/responses/${name}` };
  }
};

const addPathParam = (operation: Operation, name: string, value: Schema, description: string): void => {
  operation.parameters ??= [];
  if (!operation.parameters.some((item) => item.name === name && item.in === 'path')) {
    operation.parameters.push({ name, in: 'path', required: true, description, schema: value });
  }
};

const addQueryParam = (operation: Operation, name: string, value: Schema, description: string): void => {
  operation.parameters ??= [];
  if (!operation.parameters.some((item) => item.name === name && item.in === 'query')) {
    operation.parameters.push({ name, in: 'query', required: false, description, schema: value });
  }
};

const addListQuery = (operation: Operation): void => {
  addQueryParam(operation, 'page', schema('integer', { minimum: 1, maximum: 100 }), 'Page number.');
  addQueryParam(operation, 'limit', schema('integer', { minimum: 1, maximum: 100 }), 'Maximum number of records.');
  addQueryParam(operation, 'search', schema('string', { maxLength: 100 }), 'Search term.');
};

const addOperationIds = (document: Document): void => {
  const used = new Set<string>();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const candidate = item[method];
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;
      let id = typeof operation.operationId === 'string' && operation.operationId ? operation.operationId : `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      let index = 2;
      while (used.has(id)) id = `${id}_${index++}`;
      operation.operationId = id;
      used.add(id);
    }
  }
};

const addReusableResponses = (document: Document): void => {
  document.components ??= {};
  document.components.responses ??= {};
  for (const [status, description] of Object.entries({
    BadRequest: 'Request validation or business input is invalid.',
    Unauthorized: 'Authentication is required or failed.',
    Forbidden: 'Authenticated principal is not authorized.',
    NotFound: 'Requested resource was not found.',
    Conflict: 'Request conflicts with current resource state.',
    TooManyRequests: 'Rate limit exceeded.',
    InternalServerError: 'Unexpected server error.',
    ServiceUnavailable: 'Required infrastructure service is unavailable.',
  })) {
    document.components.responses[status] = apiResponse(description, ref('ApiErrorResponse'));
  }
};

export const applyOpenApiContract = (document: Document, configService?: { get<T>(key: string): T | undefined }): Document => {
  addSchema(document, 'ApiErrorResponse', errorResponse);
  addSchema(document, 'ValidationErrorResponse', errorResponse);
  addSchema(document, 'PaginationMeta', paginationMeta);
  addSchema(document, 'UserResponse', userResponse);
  addSchema(document, 'UserListResponse', objectSchema({ items: arrayOf(ref('UserResponse')), meta: ref('PaginationMeta') }, ['items', 'meta']));
  addSchema(document, 'AuthTokenResponse', authTokenResponse);
  addSchema(document, 'MfaChallengeResponse', mfaChallengeResponse);
  addSchema(document, 'SessionResponse', sessionResponse);
  addSchema(document, 'SessionListResponse', objectSchema({ data: arrayOf(ref('SessionResponse')) }, ['data']));
  addSchema(document, 'LogoutAllResponse', logoutAllResponse);
  addSchema(document, 'TwoFactorStatusResponse', twoFactorStatus);
  addSchema(document, 'TwoFactorEnrollmentResponse', enrollmentResponse);
  addSchema(document, 'TwoFactorEnabledRecoveryResponse', enabledRecoveryResponse);
  addSchema(document, 'RecoveryCodesResponse', recoveryResponse);
  addSchema(document, 'PropertyCatalogResponse', catalogResponse);
  addSchema(document, 'PropertyLocationResponse', locationResponse);
  addSchema(document, 'PropertyTypeResponse', catalogResponse);
  addSchema(document, 'PropertyTypeListResponse', objectSchema({ items: arrayOf(ref('PropertyTypeResponse')), meta: ref('PaginationMeta') }, ['items', 'meta']));
  addSchema(document, 'PropertyResponse', propertyResponse);
  addSchema(document, 'PropertyWrappedResponse', wrapped(ref('PropertyResponse')));
  addSchema(document, 'PropertyListResponse', objectSchema({ data: arrayOf(ref('PropertyResponse')), meta: ref('PaginationMeta') }, ['data', 'meta']));
  addSchema(document, 'PropertyNestedResponse', nestedResponse);
  addSchema(document, 'SuccessResponse', successResponse);
  addReusableResponses(document);

  if (document.info) {
    const appName = configService?.get<string>('app.name');
    const appVersion = configService?.get<string>('app.version');
    if (appName) document.info.title = `${appName} API`;
    if (appVersion) document.info.version = appVersion;
    document.info.description = 'Estate Pro public HTTP API. The generated OpenAPI contract follows runtime validation, serialization, authentication, authorization, and public error behavior.';
  }

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    const normalized = path.startsWith('/api/v1/') ? path.slice('/api/v1'.length) : path;
    for (const method of METHODS) {
      const candidate = item[method];
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;
      const publicEndpoint = normalized === '/auth/login' || normalized === '/auth/refresh' || normalized === '/auth/2fa/verify' || normalized === '/health/live' || normalized === '/health/ready';
      operation.security = publicEndpoint ? [] : [{ bearer: [] }];

      if (normalized === '/auth/login' && method === 'post') {
        setResponse(operation, 201, { oneOf: [ref('AuthTokenResponse'), ref('MfaChallengeResponse')] }, 'Authentication succeeded or an MFA challenge was issued.');
        setErrors(operation, [400, 401, 429, 500]);
        continue;
      }
      if (normalized === '/auth/refresh' && method === 'post') {
        operation.responses ??= {};
        operation.responses['200'] = {
          ...apiResponse('Tokens rotated successfully.', ref('AuthTokenResponse')),
          headers: { 'Cache-Control': { schema: schema('string', { example: 'no-store' }) } },
        };
        setErrors(operation, [400, 401, 429, 500]);
        continue;
      }
      if (normalized === '/auth/logout' && method === 'post') { setResponse(operation, 201, ref('SuccessResponse'), 'Current session revoked.'); setErrors(operation, [401, 500]); continue; }
      if (normalized === '/auth/me' && method === 'get') { setResponse(operation, 200, ref('UserResponse'), 'Current user returned.'); setErrors(operation, [401, 404, 500]); continue; }
      if (normalized === '/auth/sessions' && method === 'get') { addQueryParam(operation, 'limit', schema('integer', { minimum: 1, maximum: 100, default: 20 }), 'Maximum number of sessions.'); addQueryParam(operation, 'offset', schema('integer', { minimum: 0, default: 0 }), 'Zero-based offset.'); addQueryParam(operation, 'includeInactive', schema('boolean', { default: false }), 'Whether to include inactive sessions.'); setResponse(operation, 200, ref('SessionListResponse'), 'Own sessions returned.'); setErrors(operation, [401, 429, 500]); continue; }
      if (normalized === '/auth/sessions/logout-all' && method === 'post') { setResponse(operation, 201, ref('LogoutAllResponse'), 'All own sessions revoked.'); setErrors(operation, [401, 429, 500]); continue; }
      if (/^\/auth\/sessions\/\d+$/.test(normalized) && method === 'delete') { addPathParam(operation, 'id', schema('string', { pattern: '^\\d+$' }), 'Public numeric session identifier.'); setResponse(operation, 200, ref('SuccessResponse'), 'Session revoked.'); setErrors(operation, [400, 401, 404, 429, 500]); continue; }
      if (/^\/admin\/session-management\/users\/[^/]+\/sessions\/\d+\/revoke$/.test(normalized) && method === 'post') { addPathParam(operation, 'userUuid', schema('string', { format: 'uuid' }), 'Target user UUID.'); addPathParam(operation, 'id', schema('string', { pattern: '^\\d+$' }), 'Public numeric session identifier.'); setResponse(operation, 201, ref('SuccessResponse'), 'Target session revoked.'); setErrors(operation, [400, 401, 403, 404, 429, 500]); continue; }

      if (normalized === '/auth/2fa' && method === 'get') { setResponse(operation, 200, ref('TwoFactorStatusResponse'), 'Two-factor status returned.'); setErrors(operation, [401, 429, 500]); continue; }
      if (normalized === '/auth/2fa/enrollment' && method === 'post') { setResponse(operation, 201, ref('TwoFactorEnrollmentResponse'), 'Two-factor enrollment started.'); setErrors(operation, [400, 401, 429, 500]); continue; }
      if (normalized === '/auth/2fa/enrollment/verify' && method === 'post') { setResponse(operation, 201, ref('TwoFactorEnabledRecoveryResponse'), 'Two-factor enrollment verified.'); setErrors(operation, [400, 401, 429, 500]); continue; }
      if (normalized === '/auth/2fa/verify' && method === 'post') { operation.security = []; setResponse(operation, 201, ref('AuthTokenResponse'), 'MFA verification succeeded.'); setErrors(operation, [400, 401, 429, 500]); continue; }
      if (normalized === '/auth/2fa/recovery-codes/regenerate' && method === 'post') { setResponse(operation, 201, ref('RecoveryCodesResponse'), 'Recovery codes regenerated.'); setErrors(operation, [400, 401, 429, 500]); continue; }
      if (normalized === '/auth/2fa/disable' && method === 'post') { setResponse(operation, 201, ref('SuccessResponse'), 'Two-factor authentication disabled.'); setErrors(operation, [400, 401, 429, 500]); continue; }

      if (normalized === '/users' && method === 'get') {
        addListQuery(operation);
        addQueryParam(operation, 'filterField', schema('string', { enum: ['username', 'email', 'phone', 'status', 'isActive'] }), 'Filter field. Must be paired with filterValue.');
        addQueryParam(operation, 'filterValue', schema('string', { maxLength: 100 }), 'Filter value. For isActive use true or false.');
        addQueryParam(operation, 'sortBy', schema('string', { enum: ['uuid', 'username', 'email', 'phone', 'status', 'createdAt', 'updatedAt'], default: 'createdAt' }), 'Allowed sort field.');
        addQueryParam(operation, 'sortDirection', schema('string', { enum: ['asc', 'desc'], default: 'desc' }), 'Sort direction.');
        setResponse(operation, 200, ref('UserListResponse'), 'Users returned.');
        setErrors(operation, [400, 401, 403, 500]);
        continue;
      }
      if (normalized === '/users' && method === 'post') { setResponse(operation, 201, ref('UserResponse'), 'User created.'); setErrors(operation, [400, 401, 403, 409, 500]); continue; }
      if (/^\/users\/email\/[^/]+$/.test(normalized) && method === 'get') { addPathParam(operation, 'email', schema('string', { format: 'email' }), 'User email address.'); setResponse(operation, 200, ref('UserResponse'), 'User returned.'); setErrors(operation, [400, 401, 403, 404, 500]); continue; }
      if (/^\/users\/username\/[^/]+$/.test(normalized) && method === 'get') { addPathParam(operation, 'username', schema('string', { maxLength: 100 }), 'Username.'); setResponse(operation, 200, ref('UserResponse'), 'User returned.'); setErrors(operation, [400, 401, 403, 404, 500]); continue; }
      if (/^\/users\/[^/]+$/.test(normalized)) {
        addPathParam(operation, 'uuid', schema('string', { format: 'uuid' }), 'User UUID.');
        if (method === 'get') { setResponse(operation, 200, ref('UserResponse'), 'User returned.'); setErrors(operation, [400, 401, 403, 404, 500]); }
        if (method === 'patch') { setResponse(operation, 200, ref('UserResponse'), 'User updated.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        if (method === 'delete') { setNoContent(operation, 'User deleted.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        continue;
      }

      const typePath = normalized === '/property-types' || /^\/property-types\/[^/]+$/.test(normalized);
      if (typePath) {
        const uuidMatch = normalized.match(/^\/property-types\/([^/]+)$/);
        if (uuidMatch) addPathParam(operation, 'uuid', schema('string', { format: 'uuid' }), 'Property type UUID.');
        if (method === 'get' && !uuidMatch) { addQueryParam(operation, 'page', schema('integer', { minimum: 1, default: 1 }), 'Page number.'); addQueryParam(operation, 'limit', schema('integer', { minimum: 1, maximum: 100, default: 20 }), 'Maximum number of records.'); addQueryParam(operation, 'filterField', schema('string', { enum: ['code', 'name', 'slug', 'isActive'] }), 'Filter field.'); addQueryParam(operation, 'filterValue', schema('string', { minLength: 1, maxLength: 100 }), 'Filter value.'); addQueryParam(operation, 'sortBy', schema('string', { enum: ['code', 'name', 'slug', 'isActive', 'sortOrder', 'createdAt', 'updatedAt'], default: 'createdAt' }), 'Allowed sort field.'); addQueryParam(operation, 'sortDirection', schema('string', { enum: ['asc', 'desc'], default: 'desc' }), 'Sort direction.'); addQueryParam(operation, 'search', schema('string', { minLength: 1, maxLength: 100 }), 'Search term.'); setResponse(operation, 200, ref('PropertyTypeListResponse'), 'Property types returned.'); setErrors(operation, [400, 401, 403, 500]); }
        if (method === 'get' && uuidMatch) { setResponse(operation, 200, ref('PropertyTypeResponse'), 'Property type returned.'); setErrors(operation, [400, 401, 403, 404, 500]); }
        if (method === 'post') { setResponse(operation, 201, ref('PropertyTypeResponse'), 'Property type created.'); setErrors(operation, [400, 401, 403, 409, 500]); }
        if (method === 'patch') { setResponse(operation, 200, ref('PropertyTypeResponse'), 'Property type updated.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        if (method === 'delete') { setNoContent(operation, 'Property type deleted.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        continue;
      }

      const catalogMatch = normalized.match(/^\/property\/(categories|subcategories|facilities)(?:\/([^/]+))?$/);
      if (catalogMatch) {
        const uuid = catalogMatch[2];
        if (uuid) addPathParam(operation, 'uuid', schema('string', { format: 'uuid' }), 'Catalog resource UUID.');
        if (method === 'get' && !uuid) { addListQuery(operation); addQueryParam(operation, 'isActive', schema('boolean'), 'Filter by active state.'); if (catalogMatch[1] === 'categories') addQueryParam(operation, 'typeUuid', schema('string', { format: 'uuid' }), 'Property type UUID filter.'); setResponse(operation, 200, objectSchema({ data: arrayOf(ref('PropertyCatalogResponse')), meta: ref('PaginationMeta') }, ['data', 'meta']), `${catalogMatch[1]} returned.`); setErrors(operation, [400, 401, 403, 500]); }
        if (method === 'get' && uuid) { setResponse(operation, 200, wrapped(ref('PropertyCatalogResponse')), `${catalogMatch[1]} returned.`); setErrors(operation, [400, 401, 403, 404, 500]); }
        if (method === 'post') { setResponse(operation, 201, wrapped(ref('PropertyCatalogResponse')), `${catalogMatch[1]} created.`); setErrors(operation, [400, 401, 403, 409, 500]); }
        if (method === 'patch') { setResponse(operation, 200, wrapped(ref('PropertyCatalogResponse')), `${catalogMatch[1]} updated.`); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        if (method === 'delete') { setNoContent(operation, `${catalogMatch[1]} deleted.`); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        continue;
      }

      const locationMatch = normalized.match(/^\/property\/locations\/([^/]+)(?:\/([^/]+)(?:\/children)?)?$/);
      if (locationMatch) {
        addPathParam(operation, 'level', schema('string', { enum: ['country', 'province', 'city', 'district', 'subdistrict'] }), 'Location hierarchy level.');
        const uuid = locationMatch[2];
        if (uuid) addPathParam(operation, 'uuid', schema('string', { format: 'uuid' }), 'Location UUID.');
        if (method === 'get' && !uuid) { addListQuery(operation); addQueryParam(operation, 'isActive', schema('boolean'), 'Filter by active state.'); addQueryParam(operation, 'parentUuid', schema('string', { format: 'uuid' }), 'Parent location UUID.'); setResponse(operation, 200, objectSchema({ data: arrayOf(ref('PropertyLocationResponse')), meta: ref('PaginationMeta') }, ['data', 'meta']), 'Locations returned.'); setErrors(operation, [400, 401, 403, 404, 500]); }
        if (method === 'get' && uuid && normalized.endsWith('/children')) { setResponse(operation, 200, wrapped(arrayOf(ref('PropertyLocationResponse'))), 'Child locations returned.'); setErrors(operation, [400, 401, 403, 404, 500]); }
        else if (method === 'get' && uuid) { setResponse(operation, 200, wrapped(ref('PropertyLocationResponse')), 'Location returned.'); setErrors(operation, [400, 401, 403, 404, 500]); }
        if (method === 'post') { setResponse(operation, 201, wrapped(ref('PropertyLocationResponse')), 'Location created.'); setErrors(operation, [400, 401, 403, 409, 500]); }
        if (method === 'patch') { setResponse(operation, 200, wrapped(ref('PropertyLocationResponse')), 'Location updated.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        if (method === 'delete') { setNoContent(operation, 'Location deleted.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); }
        continue;
      }

      if (normalized === '/property/properties' && method === 'get') { addListQuery(operation); addQueryParam(operation, 'sortBy', schema('string', { maxLength: 50 }), 'Property sort field accepted by runtime.'); addQueryParam(operation, 'sortDirection', schema('string', { enum: ['asc', 'desc'] }), 'Sort direction.'); addQueryParam(operation, 'isActive', schema('boolean'), 'Filter by active state.'); for (const name of ['parentUuid', 'typeUuid', 'categoryUuid', 'subcategoryUuid']) addQueryParam(operation, name, schema('string', { format: 'uuid' }), 'UUID filter.'); addQueryParam(operation, 'status', schema('string', { enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'] }), 'Property status.'); addQueryParam(operation, 'category', schema('string', { enum: ['OUTDOOR', 'SECURITY', 'TECHNOLOGY', 'PARKING', 'CLIMATE', 'UTILITY', 'ACCESSIBILITY', 'RECREATION', 'OTHER'] }), 'Facility category.'); setResponse(operation, 200, ref('PropertyListResponse'), 'Properties returned.'); setErrors(operation, [400, 401, 403, 500]); continue; }
      if (normalized === '/property/properties' && method === 'post') { setResponse(operation, 201, ref('PropertyWrappedResponse'), 'Property created.'); setErrors(operation, [400, 401, 403, 409, 500]); continue; }

      const propertyMatch = normalized.match(/^\/property\/properties\/([^/]+)(.*)$/);
      if (propertyMatch) {
        addPathParam(operation, 'uuid', schema('string', { format: 'uuid' }), 'Property UUID.');
        const suffix = propertyMatch[2];
        if (suffix === '' && method === 'get') { setResponse(operation, 200, ref('PropertyWrappedResponse'), 'Property returned.'); setErrors(operation, [400, 401, 403, 404, 500]); continue; }
        if (suffix === '' && method === 'patch') { setResponse(operation, 200, ref('PropertyWrappedResponse'), 'Property updated.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); continue; }
        if (suffix === '' && method === 'delete') { setNoContent(operation, 'Property deleted.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); continue; }
        if (/^\/(restore|duplicate)$/.test(suffix) && method === 'post') { setResponse(operation, 201, ref('PropertyWrappedResponse'), 'Property operation completed.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); continue; }
        if (/^\/(verify|publish)$/.test(suffix) && method === 'post') { setResponse(operation, 201, ref('PropertyResponse'), 'Property lifecycle operation completed.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); continue; }
        if (suffix !== '') { setResponse(operation, method === 'post' ? 201 : 200, ref('PropertyNestedResponse'), 'Serialized property subresource.'); setErrors(operation, [400, 401, 403, 404, 409, 500]); continue; }
      }

      if (/^\/health\/live$/.test(normalized) && method === 'get') { operation.security = []; setResponse(operation, 200, schema('object'), 'Liveness check succeeded.'); continue; }
      if (/^\/health\/ready$/.test(normalized) && method === 'get') { operation.security = []; setResponse(operation, 200, schema('object'), 'Readiness check succeeded.'); setErrors(operation, [503]); continue; }
    }
  }
  addOperationIds(document);
  return document;
};
