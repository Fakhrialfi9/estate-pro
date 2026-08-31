type Schema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  responses?: Record<string, ResponseObject>;
  parameters?: ResponseObject[];
};
type Document = {
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, Schema> };
};

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
const wrapped = (data: Schema): Schema => objectSchema({ data }, ['data']);
const response = (description: string, body?: Schema): ResponseObject => ({
  description,
  ...(body ? { content: { 'application/json': { schema: body } } } : {}),
});

const addPathParam = (
  operation: Operation,
  name: string,
  schemaValue: Schema,
  description: string,
): void => {
  operation.parameters ??= [];
  if (
    !operation.parameters.some(
      (parameter) => parameter.name === name && parameter.in === 'path',
    )
  )
    operation.parameters.push({
      name,
      in: 'path',
      required: true,
      description,
      schema: schemaValue,
    });
};
const addQueryParam = (
  operation: Operation,
  name: string,
  schemaValue: Schema,
  description: string,
): void => {
  operation.parameters ??= [];
  if (
    !operation.parameters.some(
      (parameter) => parameter.name === name && parameter.in === 'query',
    )
  )
    operation.parameters.push({
      name,
      in: 'query',
      required: false,
      description,
      schema: schemaValue,
    });
};
const setResponse = (
  operation: Operation,
  status: number,
  body: Schema | undefined,
  description: string,
): void => {
  operation.responses ??= {};
  operation.responses[String(status)] = response(description, body);
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

export const installPropertyContracts = (document: Document): void => {
  const schemas = document.components?.schemas;
  if (!schemas) return;
  schemas.PropertyNestedResponse = objectSchema(
    { data: objectSchema({}, []) },
    ['data'],
  );
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, candidate] of Object.entries(item)) {
      if (!['get', 'post', 'patch', 'delete', 'put'].includes(method)) continue;
      if (!candidate || typeof candidate !== 'object') continue;
      const operation = candidate as Operation;

      for (const parameterMatch of path.matchAll(/\{([^}]+)\}/g)) {
        const name = parameterMatch[1];
        if (!name) continue;
        const value =
          name.toLowerCase().includes('uuid') || name === 'level'
            ? schema(
                'string',
                name === 'level'
                  ? {
                      enum: [
                        'country',
                        'province',
                        'city',
                        'district',
                        'subdistrict',
                      ],
                    }
                  : { format: 'uuid' },
              )
            : schema('string');
        addPathParam(operation, name, value, `${name} path parameter.`);
      }

      if (path === '/api/v1/roles' && method === 'post') {
        setResponse(operation, 201, ref('RoleResponse'), 'Role created.');
        setErrors(operation, [400, 401, 403, 409, 500]);
        continue;
      }
      if (path === '/api/v1/permissions' && method === 'post') {
        setResponse(
          operation,
          201,
          ref('PermissionResponse'),
          'Permission created.',
        );
        setErrors(operation, [400, 401, 403, 409, 500]);
        continue;
      }

      if (path === '/api/v1/property/properties' && method === 'get') {
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
          'Maximum number of properties.',
        );
        addQueryParam(
          operation,
          'search',
          schema('string', { maxLength: 100 }),
          'Search term.',
        );
        addQueryParam(
          operation,
          'sortBy',
          schema('string', { maxLength: 50 }),
          'Property sort field accepted by runtime.',
        );
        addQueryParam(
          operation,
          'sortDirection',
          schema('string', { enum: ['asc', 'desc'] }),
          'Sort direction.',
        );
        addQueryParam(
          operation,
          'isActive',
          schema('boolean'),
          'Filter by active state.',
        );
        for (const name of [
          'parentUuid',
          'typeUuid',
          'categoryUuid',
          'subcategoryUuid',
        ])
          addQueryParam(
            operation,
            name,
            schema('string', { format: 'uuid' }),
            'UUID filter.',
          );
        addQueryParam(
          operation,
          'status',
          schema('string', {
            enum: [
              'DRAFT',
              'IN_REVIEW',
              'ACTIVE',
              'ARCHIVED',
              'SOLD',
              'RENTED',
            ],
          }),
          'Property status.',
        );
        addQueryParam(
          operation,
          'category',
          schema('string', {
            enum: [
              'OUTDOOR',
              'SECURITY',
              'TECHNOLOGY',
              'PARKING',
              'CLIMATE',
              'UTILITY',
              'ACCESSIBILITY',
              'RECREATION',
              'OTHER',
            ],
          }),
          'Facility category.',
        );
        setResponse(
          operation,
          200,
          objectSchema(
            {
              data: arrayOf(ref('PropertyResponse')),
              meta: ref('PaginationMeta'),
            },
            ['data', 'meta'],
          ),
          'Properties returned.',
        );
        setErrors(operation, [400, 401, 403, 500]);
        continue;
      }

      if (
        /^\/api\/v1\/property\/(categories|subcategories|facilities)$/.test(
          path,
        ) &&
        method === 'get'
      ) {
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
          'Maximum number of records.',
        );
        addQueryParam(
          operation,
          'search',
          schema('string', { maxLength: 100 }),
          'Search term.',
        );
        addQueryParam(
          operation,
          'isActive',
          schema('boolean'),
          'Filter by active state.',
        );
      }

      if (/^\/api\/v1\/property\/properties\/[^/]+$/.test(path)) {
        if (method === 'get') {
          setResponse(
            operation,
            200,
            ref('PropertyWrappedResponse'),
            'Property returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
          continue;
        }
        if (method === 'patch' || method === 'put') {
          setResponse(
            operation,
            200,
            ref('PropertyWrappedResponse'),
            'Property updated.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
          continue;
        }
        if (method === 'delete') {
          operation.responses ??= {};
          operation.responses['204'] = response('Property deleted.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
          continue;
        }
      }
      if (path === '/api/v1/property/properties' && method === 'post') {
        setResponse(
          operation,
          201,
          ref('PropertyWrappedResponse'),
          'Property created.',
        );
        setErrors(operation, [400, 401, 403, 409, 500]);
        continue;
      }
      if (
        /^\/api\/v1\/property\/properties\/[^/]+\/(restore|duplicate)$/.test(
          path,
        ) &&
        method === 'post'
      ) {
        setResponse(
          operation,
          201,
          ref('PropertyWrappedResponse'),
          'Property operation completed.',
        );
        setErrors(operation, [400, 401, 403, 404, 409, 500]);
        continue;
      }
      if (
        /^\/api\/v1\/property\/properties\/[^/]+\/(verify|publish)$/.test(
          path,
        ) &&
        method === 'post'
      ) {
        setResponse(
          operation,
          201,
          ref('PropertyResponse'),
          'Property lifecycle operation completed.',
        );
        setErrors(operation, [400, 401, 403, 404, 409, 500]);
        continue;
      }
      if (path.includes('/property/properties/')) {
        if (method === 'delete') {
          operation.responses ??= {};
          if (!operation.responses['204'])
            operation.responses['204'] = response(
              'Property subresource deleted.',
            );
        } else
          setResponse(
            operation,
            method === 'post' ? 201 : 200,
            ref('PropertyNestedResponse'),
            'Serialized property subresource.',
          );
        setErrors(operation, [400, 401, 403, 404, 409, 500]);
        continue;
      }
      if (
        /^\/api\/v1\/property\/(categories|subcategories|facilities)\/[^/]+$/.test(
          path,
        )
      ) {
        if (method === 'get') {
          setResponse(
            operation,
            200,
            wrapped(ref('PropertyCatalogResponse')),
            'Catalog resource returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'post') {
          setResponse(
            operation,
            201,
            wrapped(ref('PropertyCatalogResponse')),
            'Catalog resource created.',
          );
          setErrors(operation, [400, 401, 403, 409, 500]);
        }
        if (method === 'patch') {
          setResponse(
            operation,
            200,
            wrapped(ref('PropertyCatalogResponse')),
            'Catalog resource updated.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        if (method === 'delete') {
          operation.responses ??= {};
          operation.responses['204'] = response('Catalog resource deleted.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        continue;
      }
      if (path.startsWith('/api/v1/property/locations/')) {
        if (method === 'get') {
          setResponse(
            operation,
            200,
            wrapped(ref('PropertyLocationResponse')),
            'Location returned.',
          );
          setErrors(operation, [400, 401, 403, 404, 500]);
        }
        if (method === 'post') {
          setResponse(
            operation,
            201,
            wrapped(ref('PropertyLocationResponse')),
            'Location created.',
          );
          setErrors(operation, [400, 401, 403, 409, 500]);
        }
        if (method === 'patch') {
          setResponse(
            operation,
            200,
            wrapped(ref('PropertyLocationResponse')),
            'Location updated.',
          );
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
        if (method === 'delete') {
          operation.responses ??= {};
          operation.responses['204'] = response('Location deleted.');
          setErrors(operation, [400, 401, 403, 404, 409, 500]);
        }
      }
    }
  }
};
