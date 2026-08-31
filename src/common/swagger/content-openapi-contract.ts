import type { OpenAPIObject } from '@nestjs/swagger';

type Schema = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type Operation = Record<string, unknown> & {
  responses?: Record<string, ResponseObject>;
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

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});

const response = (description: string, body: Schema): ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: body,
    },
  },
});

const paginationMeta = ref('PaginationMeta');

const contentResourceResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
  },
  ['uuid'],
  { additionalProperties: true },
);

const articleResponse = objectSchema(
  {
    uuid: schema('string', { format: 'uuid' }),
    title: schema('string'),
    slug: schema('string'),
    subtitle: schema('string', { nullable: true }),
    excerpt: schema('string', { nullable: true }),
    content: schema('object', { nullable: true }),
    contentFormat: schema('string'),
    type: schema('string'),
    status: schema('string'),
    visibility: schema('string'),
    language: schema('string'),
    featured: schema('boolean'),
    allowComments: schema('boolean'),
    wordCount: schema('integer', { minimum: 0 }),
    readingTimeMin: schema('integer', { minimum: 1 }),
    authorUuid: schema('string', { format: 'uuid', nullable: true }),
    categoryUuid: schema('string', { format: 'uuid', nullable: true }),
    category: schema('object', { nullable: true, additionalProperties: true }),
    tags: arrayOf(schema('object', { additionalProperties: true })),
    coverMedia: schema('object', {
      nullable: true,
      additionalProperties: true,
    }),
    version: schema('integer', { minimum: 1 }),
    scheduledAt: schema('string', { format: 'date-time', nullable: true }),
    publishedAt: schema('string', { format: 'date-time', nullable: true }),
    createdAt: schema('string', { format: 'date-time' }),
    updatedAt: schema('string', { format: 'date-time' }),
    deletedAt: schema('string', { format: 'date-time', nullable: true }),
  },
  [
    'uuid',
    'title',
    'slug',
    'subtitle',
    'excerpt',
    'content',
    'contentFormat',
    'type',
    'status',
    'visibility',
    'language',
    'featured',
    'allowComments',
    'wordCount',
    'readingTimeMin',
    'authorUuid',
    'categoryUuid',
    'category',
    'tags',
    'coverMedia',
    'version',
    'scheduledAt',
    'publishedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
  { additionalProperties: true },
);

const articleListResponse = objectSchema(
  {
    items: arrayOf(articleResponse),
    meta: paginationMeta,
  },
  ['items', 'meta'],
);

const resourceListResponse = objectSchema(
  {
    items: arrayOf(contentResourceResponse),
    meta: paginationMeta,
  },
  ['items', 'meta'],
);

const arrayResponse = arrayOf(contentResourceResponse);

const interactionResponse = objectSchema(
  {
    active: schema('boolean'),
    count: schema('integer', { minimum: 0 }),
  },
  ['active', 'count'],
);

const viewResponse = objectSchema(
  {
    recorded: schema('boolean'),
    views: schema('integer', { minimum: 0 }),
    uniqueViewsToday: schema('integer', { minimum: 0 }),
  },
  ['recorded', 'views', 'uniqueViewsToday'],
);

const contentComponents = {
  ContentResourceResponse: contentResourceResponse,
  ContentArticleResponse: articleResponse,
  ContentArticleListResponse: articleListResponse,
  ContentResourceListResponse: resourceListResponse,
  ContentArrayResponse: arrayResponse,
  ContentInteractionResponse: interactionResponse,
  ContentViewResponse: viewResponse,
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCollectionPath = (path: string): boolean =>
  /^\/api\/v1\/cms\/(categories|tags|pages|faqs|testimonials|banners|menus|redirects|media)$/.test(
    path,
  ) || path === '/api/v1/cms/articles';

const isArticleListPath = (path: string): boolean =>
  path === '/api/v1/cms/articles';

const isArrayResultPath = (path: string, method: Method): boolean =>
  (method === 'get' && /\/articles\/[^/]+\/revisions$/.test(path)) ||
  (method === 'get' && /\/relations\/[^/]+$/.test(path)) ||
  (method === 'post' && /\/menus\/[^/]+\/reorder$/.test(path));

const isInteractionPath = (path: string): boolean =>
  /\/articles\/[^/]+\/(likes|bookmark)$/.test(path);

const isViewPath = (path: string, method: Method): boolean =>
  method === 'post' && /^\/api\/v1\/content\/articles\/[^/]+\/view$/.test(path);

const ensureComponents = (document: MutableDocument): Record<string, Schema> => {
  document.components ??= {};
  document.components.schemas ??= {};
  return document.components.schemas;
};

const classifyBody = (path: string, method: Method): Schema => {
  if (isViewPath(path, method)) return ref('ContentViewResponse');
  if (isInteractionPath(path)) return ref('ContentInteractionResponse');
  if (isArrayResultPath(path, method)) return ref('ContentArrayResponse');
  if (isArticleListPath(path) && method === 'get') {
    return ref('ContentArticleListResponse');
  }
  if (isCollectionPath(path) && method === 'get') {
    return ref('ContentResourceListResponse');
  }
  if (/^\/api\/v1\/content\/(articles|pages)\/[^/]+$/.test(path)) {
    return ref('ContentResourceResponse');
  }
  if (/^\/api\/v1\/cms\/articles/.test(path)) {
    return ref('ContentArticleResponse');
  }
  return ref('ContentResourceResponse');
};

export const applyContentOpenApiContract = (
  document: OpenAPIObject,
): OpenAPIObject => {
  const mutable = document as MutableDocument;
  const schemas = ensureComponents(mutable);

  for (const [name, value] of Object.entries(contentComponents)) {
    schemas[name] = value;
  }

  for (const [path, item] of Object.entries(mutable.paths ?? {})) {
    const isContentPath =
      path.startsWith('/api/v1/cms/') || path.startsWith('/api/v1/content/');
    if (!isContentPath) continue;

    for (const method of METHODS) {
      const candidate = item[method];
      if (!isObject(candidate)) continue;

      const operation = candidate as Operation;
      if (!operation.responses) continue;

      for (const [status, rawResponse] of Object.entries(operation.responses)) {
        if (!/^2\d\d$/.test(status) || status === '204' || !isObject(rawResponse)) {
          continue;
        }
        if (isObject(rawResponse.content) && Object.keys(rawResponse.content).length) {
          continue;
        }

        const description =
          typeof rawResponse.description === 'string' &&
          rawResponse.description.length > 0
            ? rawResponse.description
            : 'Successful response.';
        operation.responses[status] = response(
          description,
          classifyBody(path, method),
        );
      }
    }
  }

  return document;
};
