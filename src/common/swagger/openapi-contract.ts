import type { OpenAPIObject } from '@nestjs/swagger';
import { installPropertyContracts } from './property-contract.js';

type Schema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  operationId?: string;
  responses?: Record<string, ResponseObject>;
  parameters?: ResponseObject[];
  requestBody?: ResponseObject;
  security?: ResponseObject[];
};
type MutableDocument = {
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

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const schema = (type: string, extra: Schema = {}): Schema => ({
  type,
  ...extra,
});
const objectSchema = (
  properties: Record<string, Schema>,
  required: string[] = [],
): Schema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});
const arrayOf = (items: Schema): Schema => ({ type: 'array', items });
const apiResponse = (description: string, body?: Schema): ResponseObject => ({
  description,
  ...(body ? { content: { 'application/json': { schema: body } } } : {}),
});
const wrapped = (data: Schema): Schema => objectSchema({ data }, ['data']);

const errorResponse = objectSchema(
  {
    statusCode: schema('integer', { example: 400 }),
    code: schema('string', { example: 'BAD_REQUEST' }),
    message: { oneOf: [schema('string'), arrayOf(schema('string'))] },
    path: schema('string', { example: '/api/v1/users' }),
    timestamp: schema('string', { format: 'date-time' }),
  },
  ['statusCode', 'code', 'message', 'path', 'timestamp'],
);
const paginationMeta = objectSchema(
  {
    page: schema('integer', { minimum: 1, example: 1 }),
    limit: schema('integer', { minimum: 1, maximum: 100, example: 20 }),
    total: schema('integer', { minimum: 0, example: 42 }),
    totalPages: schema('integer', { minimum: 0, example: 3 }),
  },
  ['page', 'limit', 'total', 'totalPages'],
);
const userResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    username: schema('string', { nullable: true }),
    email: schema('string', { nullable: true, format: 'email' }),
    phone: schema('string', { nullable: true }),
    status: schema('string'),
    isActive: schema('boolean'),
    isVerified: schema('boolean'),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'username',
    'email',
    'phone',
    'status',
    'isActive',
    'isVerified',
    'createdAt',
    'updatedAt',
  ],
);
const roleResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    name: schema('string'),
    code: schema('string'),
    description: schema('string', { nullable: true }),
    isActive: schema('boolean'),
    isSystem: schema('boolean'),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'name',
    'code',
    'description',
    'isActive',
    'isSystem',
    'createdAt',
    'updatedAt',
  ],
);
const permissionResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    name: schema('string'),
    code: schema('string'),
    resource: schema('string'),
    module: schema('string'),
    domain: schema('string'),
    action: schema('string'),
    isSystem: schema('boolean'),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'name',
    'code',
    'resource',
    'module',
    'domain',
    'action',
    'isSystem',
    'createdAt',
    'updatedAt',
  ],
);
const authTokenResponse = objectSchema(
  {
    accessToken: schema('string', {
      readOnly: true,
      description: 'Short-lived access token. Synthetic example only.',
    }),
    tokenType: schema('string', { enum: ['Bearer'] }),
    expiresIn: schema('integer', { minimum: 1 }),
    refreshToken: schema('string', {
      readOnly: true,
      description: 'Opaque rotating refresh token. Synthetic example only.',
    }),
    refreshTokenExpiresIn: schema('integer', { minimum: 1 }),
  },
  [
    'accessToken',
    'tokenType',
    'expiresIn',
    'refreshToken',
    'refreshTokenExpiresIn',
  ],
);
const mfaChallengeResponse = objectSchema(
  {
    mfaRequired: schema('boolean', { enum: [true] }),
    challengeToken: schema('string', {
      readOnly: true,
      description: 'Short-lived MFA challenge token.',
    }),
    expiresIn: schema('integer', { minimum: 1 }),
  },
  ['mfaRequired', 'challengeToken', 'expiresIn'],
);
const sessionResponse = objectSchema(
  {
    id: schema('string', { pattern: '^\\d+$' }),
    status: schema('string', { enum: ['active', 'expired', 'revoked'] }),
    ipAddress: schema('string', { nullable: true }),
    userAgent: schema('string', { nullable: true }),
    createdAt: schema('string', { format: 'date-time' }),
    lastActivityAt: schema('string', { nullable: true, format: 'date-time' }),
    expiresAt: schema('string', { format: 'date-time' }),
    revokedAt: schema('string', { nullable: true, format: 'date-time' }),
  },
  [
    'id',
    'status',
    'ipAddress',
    'userAgent',
    'createdAt',
    'lastActivityAt',
    'expiresAt',
    'revokedAt',
  ],
);
const catalogResponse = objectSchema(
  {
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
  },
  [
    'uuid',
    'code',
    'name',
    'slug',
    'description',
    'icon',
    'isActive',
    'sortOrder',
    'createdAt',
    'updatedAt',
  ],
);
const locationResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    code: schema('string'),
    name: schema('string'),
    slug: schema('string'),
    isActive: schema('boolean'),
    sortOrder: schema('integer'),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'code',
    'name',
    'slug',
    'isActive',
    'sortOrder',
    'createdAt',
    'updatedAt',
  ],
);
const propertyResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    businessCode: schema('string', { maxLength: 40 }),
    referenceNumber: schema('string', { maxLength: 80 }),
    title: schema('string', { minLength: 3, maxLength: 200 }),
    slug: schema('string', { maxLength: 220 }),
    shortDescription: schema('string', { nullable: true }),
    description: schema('string', { nullable: true }),
    status: schema('string', {
      enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED', 'SOLD', 'RENTED'],
    }),
    availabilityStatus: schema('string', {
      enum: ['AVAILABLE', 'UNAVAILABLE'],
    }),
    availableFrom: schema('string', { nullable: true, format: 'date-time' }),
    availableTo: schema('string', { nullable: true, format: 'date-time' }),
    version: schema('integer', { minimum: 1 }),
    publishedAt: schema('string', { nullable: true, format: 'date-time' }),
    verifiedAt: schema('string', { nullable: true, format: 'date-time' }),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'businessCode',
    'referenceNumber',
    'title',
    'slug',
    'shortDescription',
    'description',
    'status',
    'availabilityStatus',
    'availableFrom',
    'availableTo',
    'version',
    'publishedAt',
    'verifiedAt',
    'createdAt',
    'updatedAt',
  ],
);
const successResponse = objectSchema(
  { success: schema('boolean', { example: true }) },
  ['success'],
);
const logoutAllResponse = objectSchema(
  {
    success: schema('boolean', { example: true }),
    revokedCount: schema('integer', { minimum: 0 }),
  },
  ['success', 'revokedCount'],
);
const twoFactorStatus = objectSchema({ enabled: schema('boolean') }, [
  'enabled',
]);
const enrollmentResponse = objectSchema(
  {
    method: schema('string', { enum: ['totp'] }),
    provisioningUri: schema('string', {
      readOnly: true,
      description: 'TOTP provisioning URI. Sensitive response data.',
    }),
    verificationRequired: schema('boolean', { enum: [true] }),
  },
  ['method', 'provisioningUri', 'verificationRequired'],
);
const recoveryResponse = objectSchema(
  {
    recoveryCodes: arrayOf(
      schema('string', {
        readOnly: true,
        description: 'Single-use recovery code.',
      }),
    ),
  },
  ['recoveryCodes'],
);
const enabledRecoveryResponse = objectSchema(
  {
    enabled: schema('boolean', { enum: [true] }),
    recoveryCodes: arrayOf(
      schema('string', {
        readOnly: true,
        description: 'Single-use recovery code.',
      }),
    ),
  },
  ['enabled', 'recoveryCodes'],
);
const rolePermissionAssignment = objectSchema(
  {
    role: objectSchema(
      { id: schema('string', { format: 'uuid' }), name: schema('string') },
      ['id', 'name'],
    ),
    permission: objectSchema(
      {
        id: schema('string', { format: 'uuid' }),
        name: schema('string'),
        resource: schema('string'),
        action: schema('string'),
        identifier: schema('string'),
      },
      ['id', 'name', 'resource', 'action', 'identifier'],
    ),
  },
  ['role', 'permission'],
);
const userRoleAssignment = objectSchema(
  {
    user: objectSchema({ uuid: schema('string', { format: 'uuid' }) }, [
      'uuid',
    ]),
    role: objectSchema(
      {
        uuid: schema('string', { format: 'uuid' }),
        name: schema('string'),
        code: schema('string'),
      },
      ['uuid', 'name', 'code'],
    ),
    assignedAt: schema('string', { format: 'date-time' }),
  },
  ['user', 'role', 'assignedAt'],
);
const rolePermissionList = objectSchema(
  {
    role: objectSchema(
      { id: schema('string', { format: 'uuid' }), name: schema('string') },
      ['id', 'name'],
    ),
    permissions: arrayOf(
      objectSchema(
        {
          id: schema('string', { format: 'uuid' }),
          name: schema('string'),
          resource: schema('string'),
          action: schema('string'),
          identifier: schema('string'),
        },
        ['id', 'name', 'resource', 'action', 'identifier'],
      ),
    ),
    meta: objectSchema(
      {
        page: schema('integer', { minimum: 1 }),
        limit: schema('integer', { minimum: 1 }),
        total: schema('integer', { minimum: 0 }),
      },
      ['page', 'limit', 'total'],
    ),
  },
  ['role', 'permissions', 'meta'],
);

const addSchema = (
  document: MutableDocument,
  name: string,
  value: Schema,
): void => {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas[name] = value;
};
const setResponse = (
  operation: Operation,
  status: number,
  body: Schema | undefined,
  description: string,
): void => {
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
    if (name)
      operation.responses[String(status)] = {
        $ref: `#/components/responses/${name}`,
      };
  }
};
const addPathParam = (
  operation: Operation,
  name: string,
  value: Schema,
  description: string,
): void => {
  operation.parameters ??= [];
  if (
    !operation.parameters.some(
      (item) => item.name === name && item.in === 'path',
    )
  )
    operation.parameters.push({
      name,
      in: 'path',
      required: true,
      description,
      schema: value,
    });
};
const addQueryParam = (
  operation: Operation,
  name: string,
  value: Schema,
  description: string,
): void => {
  operation.parameters ??= [];
  if (
    !operation.parameters.some(
      (item) => item.name === name && item.in === 'query',
    )
  )
    operation.parameters.push({
      name,
      in: 'query',
      required: false,
      description,
      schema: value,
    });
};
const addListQuery = (operation: Operation): void => {
  addQueryParam(
    operation,
    'page',
    schema('integer', { minimum: 1, maximum: 100, default: 1 }),
    'Page number.',
  );
  addQueryParam(
    operation,
    'limit',
    schema('integer', { minimum: 1, maximum: 100, default: 20 }),
    'Maximum number of records.',
  );
};
const addOperationIds = (document: MutableDocument): void => {
  const used = new Set<string>();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const candidate = item[method];
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;
      const base =
        operation.operationId ??
        `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      let id = base;
      let index = 2;
      while (used.has(id)) id = `${base}_${index++}`;
      operation.operationId = id;
      used.add(id);
    }
  }
};
const addReusableResponses = (document: MutableDocument): void => {
  document.components ??= {};
  document.components.responses ??= {};
  const definitions: Record<string, string> = {
    BadRequest: 'Request validation or business input is invalid.',
    Unauthorized: 'Authentication is required or failed.',
    Forbidden: 'Authenticated principal is not authorized.',
    NotFound: 'Requested resource was not found.',
    Conflict: 'Request conflicts with current resource state.',
    TooManyRequests: 'Rate limit exceeded.',
    InternalServerError: 'Unexpected server error.',
    ServiceUnavailable: 'Required infrastructure service is unavailable.',
  };
  for (const [name, description] of Object.entries(definitions))
    document.components.responses[name] = apiResponse(
      description,
      ref('ApiErrorResponse'),
    );
};
const installRolePermissionContracts = (document: MutableDocument): void => {
  addSchema(document, 'RoleResponse', roleResponse);
  addSchema(document, 'PermissionResponse', permissionResponse);
  addSchema(
    document,
    'RolePermissionAssignmentResponse',
    rolePermissionAssignment,
  );
  addSchema(document, 'UserRoleAssignmentResponse', userRoleAssignment);
  addSchema(document, 'RolePermissionListResponse', rolePermissionList);
  addSchema(
    document,
    'RoleListResponse',
    objectSchema(
      { items: arrayOf(ref('RoleResponse')), meta: ref('PaginationMeta') },
      ['items', 'meta'],
    ),
  );
  addSchema(
    document,
    'PermissionListResponse',
    objectSchema(
      {
        items: arrayOf(ref('PermissionResponse')),
        meta: ref('PaginationMeta'),
      },
      ['items', 'meta'],
    ),
  );

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const candidate = item[method];
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;
      if (path === '/api/v1/roles' && method === 'get') {
        addListQuery(operation);
        addQueryParam(
          operation,
          'filterField',
          schema('string', { enum: ['name', 'code', 'isActive', 'isSystem'] }),
          'Filter field.',
        );
        addQueryParam(
          operation,
          'filterValue',
          schema('string', { maxLength: 100 }),
          'Filter value.',
        );
        addQueryParam(
          operation,
          'sortBy',
          schema('string', {
            enum: ['name', 'code', 'createdAt', 'updatedAt'],
            default: 'createdAt',
          }),
          'Allowed sort field.',
        );
        addQueryParam(
          operation,
          'sortDirection',
          schema('string', { enum: ['asc', 'desc'], default: 'desc' }),
          'Sort direction.',
        );
        addQueryParam(
          operation,
          'search',
          schema('string', { maxLength: 100 }),
          'Search term.',
        );
        setResponse(operation, 200, ref('RoleListResponse'), 'Roles returned.');
        setErrors(operation, [400, 401, 403, 500]);
        continue;
      }
      if (/^\/api\/v1\/roles\/[^/]+$/.test(path)) {
        addPathParam(
          operation,
          'uuid',
          schema('string', { format: 'uuid' }),
          'Role UUID.',
        );
        if (method === 'get') {
          setResponse(operation, 200, ref('RoleResponse'), 'Role returned.');
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'put') {
          setResponse(operation, 200, ref('RoleResponse'), 'Role updated.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        if (method === 'delete') {
          setResponse(operation, 200, ref('SuccessResponse'), 'Role deleted.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      }
      if (/^\/api\/v1\/roles\/[^/]+\/permissions$/.test(path)) {
        addPathParam(
          operation,
          'uuid',
          schema('string', { format: 'uuid' }),
          'Role UUID.',
        );
        if (method === 'get') {
          setResponse(
            operation,
            200,
            ref('RolePermissionListResponse'),
            'Role permissions returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'post') {
          setResponse(
            operation,
            201,
            ref('RolePermissionAssignmentResponse'),
            'Permission assigned to role.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      }
      if (
        /^\/api\/v1\/roles\/[^/]+\/permissions\/[^/]+$/.test(path) &&
        method === 'delete'
      ) {
        addPathParam(
          operation,
          'uuid',
          schema('string', { format: 'uuid' }),
          'Role UUID.',
        );
        addPathParam(
          operation,
          'permissionUuid',
          schema('string', { format: 'uuid' }),
          'Permission UUID.',
        );
        setResponse(
          operation,
          200,
          ref('SuccessResponse'),
          'Permission removed from role.',
        );
        setErrors(operation, [400, 401, 403, 404, 409, 500]);
      }
      if (/^\/api\/v1\/users\/[^/]+\/roles$/.test(path)) {
        addPathParam(
          operation,
          'userUuid',
          schema('string', { format: 'uuid' }),
          'Target user UUID.',
        );
        if (method === 'get') {
          addQueryParam(
            operation,
            'page',
            schema('integer', { minimum: 1, default: 1 }),
            'Page number.',
          );
          addQueryParam(
            operation,
            'limit',
            schema('integer', { minimum: 1, maximum: 100, default: 20 }),
            'Maximum number of roles.',
          );
          setResponse(
            operation,
            200,
            ref('RoleListResponse'),
            'User roles returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'post') {
          setResponse(
            operation,
            201,
            ref('UserRoleAssignmentResponse'),
            'Role assigned to user.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      }
      if (
        /^\/api\/v1\/users\/[^/]+\/roles\/[^/]+$/.test(path) &&
        method === 'delete'
      ) {
        addPathParam(
          operation,
          'userUuid',
          schema('string', { format: 'uuid' }),
          'Target user UUID.',
        );
        addPathParam(
          operation,
          'roleUuid',
          schema('string', { format: 'uuid' }),
          'Role UUID.',
        );
        setResponse(
          operation,
          200,
          ref('SuccessResponse'),
          'Role removed from user.',
        );
        setErrors(operation, [400, 401, 403, 404, 409, 500]);
      }
      if (path === '/api/v1/permissions' && method === 'get') {
        addListQuery(operation);
        addQueryParam(
          operation,
          'filterField',
          schema('string', {
            enum: ['module', 'domain', 'action', 'isSystem'],
          }),
          'Filter field.',
        );
        addQueryParam(
          operation,
          'filterValue',
          schema('string', { maxLength: 100 }),
          'Filter value.',
        );
        addQueryParam(
          operation,
          'sortBy',
          schema('string', {
            enum: [
              'name',
              'code',
              'module',
              'domain',
              'action',
              'createdAt',
              'updatedAt',
            ],
            default: 'createdAt',
          }),
          'Allowed sort field.',
        );
        addQueryParam(
          operation,
          'sortDirection',
          schema('string', { enum: ['asc', 'desc'], default: 'desc' }),
          'Sort direction.',
        );
        setResponse(
          operation,
          200,
          ref('PermissionListResponse'),
          'Permissions returned.',
        );
        setErrors(operation, [400, 401, 403, 500]);
      }
      if (/^\/api\/v1\/permissions\/[^/]+$/.test(path)) {
        addPathParam(
          operation,
          'uuid',
          schema('string', { format: 'uuid' }),
          'Permission UUID.',
        );
        if (method === 'get') {
          setResponse(
            operation,
            200,
            ref('PermissionResponse'),
            'Permission returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'put') {
          setResponse(
            operation,
            200,
            ref('PermissionResponse'),
            'Permission updated.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        if (method === 'delete') {
          setResponse(
            operation,
            200,
            ref('SuccessResponse'),
            'Permission deleted.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      }
    }
  }
};

export const applyOpenApiContract = (
  document: OpenAPIObject,
  configService?: { get<T>(key: string): T | undefined },
): OpenAPIObject => {
  const mutable = document as unknown as MutableDocument;
  addSchema(mutable, 'ApiErrorResponse', errorResponse);
  addSchema(mutable, 'ValidationErrorResponse', errorResponse);
  addSchema(mutable, 'PaginationMeta', paginationMeta);
  addSchema(mutable, 'UserResponse', userResponse);
  addSchema(
    mutable,
    'UserListResponse',
    objectSchema(
      { items: arrayOf(ref('UserResponse')), meta: ref('PaginationMeta') },
      ['items', 'meta'],
    ),
  );
  addSchema(mutable, 'AuthTokenResponse', authTokenResponse);
  addSchema(mutable, 'MfaChallengeResponse', mfaChallengeResponse);
  addSchema(mutable, 'SessionResponse', sessionResponse);
  addSchema(
    mutable,
    'SessionListResponse',
    objectSchema({ data: arrayOf(ref('SessionResponse')) }, ['data']),
  );
  addSchema(mutable, 'LogoutAllResponse', logoutAllResponse);
  addSchema(mutable, 'TwoFactorStatusResponse', twoFactorStatus);
  addSchema(mutable, 'TwoFactorEnrollmentResponse', enrollmentResponse);
  addSchema(
    mutable,
    'TwoFactorEnabledRecoveryResponse',
    enabledRecoveryResponse,
  );
  addSchema(mutable, 'RecoveryCodesResponse', recoveryResponse);
  addSchema(mutable, 'PropertyCatalogResponse', catalogResponse);
  addSchema(mutable, 'PropertyLocationResponse', locationResponse);
  addSchema(mutable, 'PropertyTypeResponse', catalogResponse);
  addSchema(
    mutable,
    'PropertyTypeListResponse',
    objectSchema(
      {
        items: arrayOf(ref('PropertyTypeResponse')),
        meta: ref('PaginationMeta'),
      },
      ['items', 'meta'],
    ),
  );
  addSchema(mutable, 'PropertyResponse', propertyResponse);
  addSchema(
    mutable,
    'PropertyWrappedResponse',
    wrapped(ref('PropertyResponse')),
  );
  addSchema(
    mutable,
    'PropertyListResponse',
    objectSchema(
      { data: arrayOf(ref('PropertyResponse')), meta: ref('PaginationMeta') },
      ['data', 'meta'],
    ),
  );
  addSchema(
    mutable,
    'PropertyNestedResponse',
    objectSchema({ data: objectSchema({}, []) }, ['data']),
  );
  addSchema(mutable, 'SuccessResponse', successResponse);
  addReusableResponses(mutable);
  installRolePermissionContracts(mutable);
  installPropertyContracts(mutable);

  if (mutable.info) {
    const appName = configService?.get<string>('app.name');
    const appVersion = configService?.get<string>('app.version');
    if (appName) mutable.info.title = `${appName} API`;
    if (appVersion) mutable.info.version = appVersion;
    mutable.info.description =
      'Estate Pro public HTTP API contract generated from runtime controllers, DTO validation, serializers, guards, and public error mappings.';
  }

  for (const [path, item] of Object.entries(mutable.paths ?? {})) {
    const normalized = path.startsWith('/api/v1/')
      ? path.slice('/api/v1'.length)
      : path;
    for (const method of METHODS) {
      const candidate = item[method];
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;
      const publicEndpoint =
        normalized === '/auth/login' ||
        normalized === '/auth/refresh' ||
        normalized === '/auth/2fa/verify' ||
        normalized === '/health/live' ||
        normalized === '/health/ready';
      operation.security = publicEndpoint ? [] : [{ bearer: [] }];

      if (normalized === '/auth/login' && method === 'post') {
        setResponse(
          operation,
          201,
          { oneOf: [ref('AuthTokenResponse'), ref('MfaChallengeResponse')] },
          'Authentication succeeded or an MFA challenge was issued.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (normalized === '/auth/refresh' && method === 'post') {
        operation.responses ??= {};
        operation.responses['200'] = {
          ...apiResponse(
            'Tokens rotated successfully.',
            ref('AuthTokenResponse'),
          ),
          headers: {
            'Cache-Control': {
              schema: schema('string', { example: 'no-store' }),
            },
          },
        };
        setErrors(operation, [400, 401, 429, 500]);
      } else if (normalized === '/auth/logout' && method === 'post') {
        setResponse(
          operation,
          201,
          ref('SuccessResponse'),
          'Current session revoked.',
        );
        setErrors(operation, [401, 500]);
      } else if (normalized === '/auth/me' && method === 'get') {
        setResponse(
          operation,
          200,
          ref('UserResponse'),
          'Current user returned.',
        );
        setErrors(operation, [401, 404, 500]);
      } else if (normalized === '/auth/sessions' && method === 'get') {
        addQueryParam(
          operation,
          'limit',
          schema('integer', { minimum: 1, maximum: 100, default: 20 }),
          'Maximum number of sessions.',
        );
        addQueryParam(
          operation,
          'offset',
          schema('integer', { minimum: 0, default: 0 }),
          'Zero-based offset.',
        );
        addQueryParam(
          operation,
          'includeInactive',
          schema('boolean', { default: false }),
          'Whether to include inactive sessions.',
        );
        setResponse(
          operation,
          200,
          ref('SessionListResponse'),
          'Own sessions returned.',
        );
        setErrors(operation, [401, 429, 500]);
      } else if (
        normalized === '/auth/sessions/logout-all' &&
        method === 'post'
      ) {
        setResponse(
          operation,
          201,
          ref('LogoutAllResponse'),
          'All own sessions revoked.',
        );
        setErrors(operation, [401, 429, 500]);
      } else if (
        /^\/auth\/sessions\/\d+$/.test(normalized) &&
        method === 'delete'
      ) {
        addPathParam(
          operation,
          'id',
          schema('string', { pattern: '^\\d+$' }),
          'Public numeric session identifier.',
        );
        setResponse(operation, 200, ref('SuccessResponse'), 'Session revoked.');
        setErrors(operation, [400, 401, 404, 429, 500]);
      } else if (
        /^\/admin\/session-management\/users\/[^/]+\/sessions\/\d+\/revoke$/.test(
          normalized,
        ) &&
        method === 'post'
      ) {
        addPathParam(
          operation,
          'userUuid',
          schema('string', { format: 'uuid' }),
          'Target user UUID.',
        );
        addPathParam(
          operation,
          'id',
          schema('string', { pattern: '^\\d+$' }),
          'Public numeric session identifier.',
        );
        setResponse(
          operation,
          201,
          ref('SuccessResponse'),
          'Target session revoked.',
        );
        setErrors(operation, [400, 401, 403, 404, 429, 500]);
      } else if (normalized === '/auth/2fa' && method === 'get') {
        setResponse(
          operation,
          200,
          ref('TwoFactorStatusResponse'),
          'Two-factor status returned.',
        );
        setErrors(operation, [401, 429, 500]);
      } else if (normalized === '/auth/2fa/enrollment' && method === 'post') {
        setResponse(
          operation,
          201,
          ref('TwoFactorEnrollmentResponse'),
          'Two-factor enrollment started.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (
        normalized === '/auth/2fa/enrollment/verify' &&
        method === 'post'
      ) {
        setResponse(
          operation,
          201,
          ref('TwoFactorEnabledRecoveryResponse'),
          'Two-factor enrollment verified.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (normalized === '/auth/2fa/verify' && method === 'post') {
        operation.security = [];
        setResponse(
          operation,
          201,
          ref('AuthTokenResponse'),
          'MFA verification succeeded.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (
        normalized === '/auth/2fa/recovery-codes/regenerate' &&
        method === 'post'
      ) {
        setResponse(
          operation,
          201,
          ref('RecoveryCodesResponse'),
          'Recovery codes regenerated.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (normalized === '/auth/2fa/disable' && method === 'post') {
        setResponse(
          operation,
          201,
          ref('SuccessResponse'),
          'Two-factor authentication disabled.',
        );
        setErrors(operation, [400, 401, 429, 500]);
      } else if (normalized === '/users' && method === 'get') {
        addListQuery(operation);
        addQueryParam(
          operation,
          'filterField',
          schema('string', {
            enum: ['username', 'email', 'phone', 'status', 'isActive'],
          }),
          'Filter field. Must be paired with filterValue.',
        );
        addQueryParam(
          operation,
          'filterValue',
          schema('string', { maxLength: 100 }),
          'Filter value.',
        );
        addQueryParam(
          operation,
          'sortBy',
          schema('string', {
            enum: [
              'uuid',
              'username',
              'email',
              'phone',
              'status',
              'createdAt',
              'updatedAt',
            ],
            default: 'createdAt',
          }),
          'Allowed sort field.',
        );
        addQueryParam(
          operation,
          'sortDirection',
          schema('string', { enum: ['asc', 'desc'], default: 'desc' }),
          'Sort direction.',
        );
        setResponse(operation, 200, ref('UserListResponse'), 'Users returned.');
        setErrors(operation, [400, 401, 403, 500]);
      } else if (normalized === '/users' && method === 'post') {
        setResponse(operation, 201, ref('UserResponse'), 'User created.');
        setErrors(operation, [400, 401, 403, 409, 500]);
      } else if (
        /^\/users\/email\/[^/]+$/.test(normalized) &&
        method === 'get'
      ) {
        addPathParam(
          operation,
          'email',
          schema('string', { format: 'email' }),
          'User email address.',
        );
        setResponse(operation, 200, ref('UserResponse'), 'User returned.');
        setErrors(operation, [400, 401, 403, 404, 500]);
      } else if (
        /^\/users\/username\/[^/]+$/.test(normalized) &&
        method === 'get'
      ) {
        addPathParam(
          operation,
          'username',
          schema('string', { maxLength: 100 }),
          'Username.',
        );
        setResponse(operation, 200, ref('UserResponse'), 'User returned.');
        setErrors(operation, [400, 401, 403, 404, 500]);
      } else if (/^\/users\/[^/]+$/.test(normalized)) {
        addPathParam(
          operation,
          'uuid',
          schema('string', { format: 'uuid' }),
          'User UUID.',
        );
        if (method === 'get') {
          setResponse(operation, 200, ref('UserResponse'), 'User returned.');
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'patch') {
          setResponse(operation, 200, ref('UserResponse'), 'User updated.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        if (method === 'delete') {
          setNoContent(operation, 'User deleted.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      } else if (/^\/health\/live$/.test(normalized) && method === 'get') {
        operation.security = [];
        setResponse(
          operation,
          200,
          objectSchema(
            {
              status: schema('string', { enum: ['ok'] }),
              checks: objectSchema(
                {
                  application: objectSchema(
                    { status: schema('string', { enum: ['up'] }) },
                    ['status'],
                  ),
                },
                ['application'],
              ),
            },
            ['status', 'checks'],
          ),
          'Liveness check succeeded.',
        );
      } else if (/^\/health\/ready$/.test(normalized) && method === 'get') {
        operation.security = [];
        setResponse(
          operation,
          200,
          objectSchema({ status: schema('string') }, ['status']),
          'Readiness check succeeded.',
        );
        setErrors(operation, [503]);
      }
    }
  }
  addOperationIds(mutable);
  return document;
};
