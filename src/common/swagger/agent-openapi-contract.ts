import type { OpenAPIObject } from '@nestjs/swagger';

type Schema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  responses?: Record<
    string,
    ResponseObject | { $ref: string } | undefined
  >;
};
type MutableDocument = OpenAPIObject & {
  components?: OpenAPIObject['components'] & {
    schemas?: Record<string, Schema>;
  };
  paths?: Record<string, Record<string, unknown>>;
};

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';
const METHODS: Method[] = ['get', 'post', 'patch', 'delete', 'put'];

const schema = (type: string, extra: Schema = {}): Schema => ({
  type,
  ...extra,
});

const objectSchema = (
  properties: Record<string, Schema>,
  required: string[] = [],
  extra: Schema = {},
): Schema => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});

const arrayOf = (items: Schema): Schema => ({ type: 'array', items });

const response = (description: string, body: Schema): ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: body,
    },
  },
});

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
  body: Schema,
  description: string,
): void => {
  operation.responses ??= {};
  operation.responses[String(status)] = response(description, body);
};

const agentResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    userUuid: schema('string', { format: 'uuid' }),
    displayName: schema('string', { nullable: true }),
    bio: schema('string', { nullable: true }),
    status: schema('string'),
    hireDate: schema('string', { format: 'date', nullable: true }),
    licenseNumberMasked: schema('string', { nullable: true }),
    timeZone: schema('string'),
    maxActiveAssignments: schema('integer', { minimum: 0 }),
    version: schema('integer', { minimum: 1 }),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
  },
  [
    'uuid',
    'userUuid',
    'displayName',
    'bio',
    'status',
    'hireDate',
    'licenseNumberMasked',
    'timeZone',
    'maxActiveAssignments',
    'version',
    'createdAt',
    'updatedAt',
  ],
);

const agentListResponse = objectSchema(
  {
    items: arrayOf(agentResponse),
    nextCursor: schema('string', { nullable: true }),
  },
  ['items', 'nextCursor'],
);

const agentSpecializationResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    code: schema('string'),
    name: schema('string'),
    description: schema('string', { nullable: true }),
    isPrimary: schema('boolean', { nullable: true }),
  },
  ['uuid', 'code', 'name'],
  { additionalProperties: true },
);

const agentSpecializationListResponse = arrayOf(agentSpecializationResponse);

const agentGenericObjectResponse = objectSchema({}, [], {
  additionalProperties: true,
});

const agentGenericArrayResponse = arrayOf(
  objectSchema({}, [], { additionalProperties: true }),
);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const applyAgentOpenApiContract = (
  document: OpenAPIObject,
): OpenAPIObject => {
  const mutable = document as MutableDocument;

  addSchema(mutable, 'AgentResponse', agentResponse);
  addSchema(mutable, 'AgentListResponse', agentListResponse);
  addSchema(
    mutable,
    'AgentSpecializationResponse',
    agentSpecializationResponse,
  );
  addSchema(
    mutable,
    'AgentSpecializationListResponse',
    agentSpecializationListResponse,
  );
  addSchema(mutable, 'AgentGenericObjectResponse', agentGenericObjectResponse);
  addSchema(mutable, 'AgentGenericArrayResponse', agentGenericArrayResponse);

  for (const [path, item] of Object.entries(mutable.paths ?? {})) {
    if (!path.startsWith('/api/v1/agents')) continue;

    for (const method of METHODS) {
      const candidate = item[method];
      if (!isObject(candidate)) continue;

      const operation = candidate as Operation;
      if (!operation.responses) continue;

      for (const [status, rawResponse] of Object.entries(operation.responses)) {
        if (
          !/^2\d\d$/.test(status) ||
          status === '204' ||
          !isObject(rawResponse) ||
          '$ref' in rawResponse
        ) {
          continue;
        }

        if (
          isObject(rawResponse.content) &&
          Object.keys(rawResponse.content).length > 0
        ) {
          continue;
        }

        const isAgentsList = path === '/api/v1/agents' && method === 'get';
        const isSpecializationList =
          method === 'get' &&
          (path === '/api/v1/agents/specializations' ||
            /^\/api\/v1\/agents\/[^/]+\/specializations$/.test(path));
        const isArrayResult =
          (method === 'get' && path === '/api/v1/agents/candidates/search') ||
          isSpecializationList;
        const isAgentEntity =
          path === '/api/v1/agents' ||
          /^\/api\/v1\/agents\/[^/]+$/.test(path);

        if (isAgentsList) {
          setResponse(
            operation,
            Number(status),
            { $ref: '#/components/schemas/AgentListResponse' },
            'Cursor-paginated agent directory.',
          );
        } else if (isSpecializationList) {
          setResponse(
            operation,
            Number(status),
            { $ref: '#/components/schemas/AgentSpecializationListResponse' },
            'Agent specializations returned.',
          );
        } else if (isArrayResult) {
          setResponse(
            operation,
            Number(status),
            { $ref: '#/components/schemas/AgentGenericArrayResponse' },
            'Agent collection returned.',
          );
        } else if (isAgentEntity) {
          setResponse(
            operation,
            Number(status),
            { $ref: '#/components/schemas/AgentResponse' },
            'Agent resource returned.',
          );
        } else {
          setResponse(
            operation,
            Number(status),
            { $ref: '#/components/schemas/AgentGenericObjectResponse' },
            'Agent operation succeeded.',
          );
        }
      }
    }
  }

  return document;
};