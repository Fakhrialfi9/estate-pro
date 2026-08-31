const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const PUBLIC_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/2fa/verify',
  '/api/v1/health/live',
  '/api/v1/health/ready',
]);
const KNOWN_FORMATS = new Set(['date', 'date-time', 'duration', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 'regex', 'json-pointer', 'relative-json-pointer', 'byte', 'binary', 'password']);
const SENSITIVE_NAMES = new Set(['password', 'passwordHash', 'passwordConfirmation', 'refreshToken', 'accessToken', 'secret', 'sessionSecret', 'jwtSecret', 'twoFactorSecret', 'recoveryCodes', 'clientSecret']);
const RESPONSE_ALLOWLIST = new Set(['AuthTokenResponse', 'MfaChallengeResponse', 'TwoFactorEnrollmentResponse', 'TwoFactorEnabledRecoveryResponse', 'RecoveryCodesResponse']);
const REQUEST_BODY_MEDIA_TYPES = new Set(['application/json', 'multipart/form-data']);

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const resolveLocalRef = (document, reference) => {
  assert(reference.startsWith('#/'), `Only local OpenAPI refs are supported by the contract validator: ${reference}`);
  let current = document;
  for (const part of reference.slice(2).split('/')) {
    assert(isObject(current) && part in current, `Unresolved OpenAPI $ref: ${reference}`);
    current = current[part];
  }
  return current;
};

const validateSchemaQuality = (document, schema, location) => {
  assert(isObject(schema), `Schema is invalid: ${location}`);
  if ('$ref' in schema) {
    assert(typeof schema.$ref === 'string', `Schema $ref is invalid: ${location}`);
    return;
  }
  if ('type' in schema) assert(typeof schema.type === 'string', `Schema type is invalid: ${location}`);
  if ('format' in schema) assert(KNOWN_FORMATS.has(schema.format), `Unknown OpenAPI format ${schema.format}: ${location}`);
  if ('required' in schema) {
    assert(Array.isArray(schema.required), `Schema required must be an array: ${location}`);
    for (const property of schema.required) assert(typeof property === 'string', `Schema required property is invalid: ${location}`);
  }
  if ('properties' in schema) {
    assert(isObject(schema.properties), `Schema properties must be an object: ${location}`);
    for (const [name, propertySchema] of Object.entries(schema.properties)) validateSchemaQuality(document, propertySchema, `${location}.${name}`);
  }
  if ('items' in schema) validateSchemaQuality(document, schema.items, `${location}.items`);
  if ('oneOf' in schema) {
    assert(Array.isArray(schema.oneOf), `Schema oneOf must be an array: ${location}`);
    for (const child of schema.oneOf) validateSchemaQuality(document, child, `${location}.oneOf`);
  }
  if ('anyOf' in schema) {
    assert(Array.isArray(schema.anyOf), `Schema anyOf must be an array: ${location}`);
    for (const child of schema.anyOf) validateSchemaQuality(document, child, `${location}.anyOf`);
  }
  if ('allOf' in schema) {
    assert(Array.isArray(schema.allOf), `Schema allOf must be an array: ${location}`);
    for (const child of schema.allOf) validateSchemaQuality(document, child, `${location}.allOf`);
  }
  if ('additionalProperties' in schema && isObject(schema.additionalProperties)) validateSchemaQuality(document, schema.additionalProperties, `${location}.additionalProperties`);
};

const operationSchemasReferencedByResponses = (document) => {
  const references = new Set();
  for (const item of Object.values(document.paths ?? {})) {
    if (!isObject(item)) continue;
    for (const [method, operation] of Object.entries(item)) {
      if (!METHODS.has(method) || !isObject(operation) || !isObject(operation.responses)) continue;
      for (const response of Object.values(operation.responses)) {
        if (!isObject(response)) continue;
        const content = response.content;
        if (!isObject(content)) continue;
        for (const mediaType of Object.values(content)) {
          if (!isObject(mediaType) || !isObject(mediaType.schema)) continue;
          const schema = mediaType.schema;
          if (typeof schema.$ref === 'string') references.add(schema.$ref);
        }
      }
    }
  }
  return references;
};

export const validateOpenApiDocument = (document) => {
  assert(isObject(document), 'OpenAPI document is not an object');
  assert(typeof document.openapi === 'string', 'Missing OpenAPI version');
  assert(isObject(document.info), 'Missing OpenAPI info');
  assert(isObject(document.paths), 'Missing OpenAPI paths');
  assert(isObject(document.components), 'Missing OpenAPI components');
  assert(isObject(document.components.schemas), 'Missing OpenAPI schemas');

  let operationCount = 0;
  const operationIds = new Set();
  const requestBodies = new Set();
  const responseRefs = operationSchemasReferencedByResponses(document);

  for (const [path, item] of Object.entries(document.paths)) {
    assert(path === '/api/v1' || path.startsWith('/api/v1/'), `Unversioned API path detected: ${path}`);
    assert(isObject(item), `Path item is invalid: ${path}`);
    const templates = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).filter(Boolean);

    for (const [method, operation] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      assert(isObject(operation), `Operation is invalid: ${method.toUpperCase()} ${path}`);
      operationCount += 1;
      assert(typeof operation.operationId === 'string' && operation.operationId.length > 0, `Missing operationId: ${method.toUpperCase()} ${path}`);
      assert(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      assert(isObject(operation.responses) && Object.keys(operation.responses).length > 0, `Missing responses: ${method.toUpperCase()} ${path}`);
      const successStatuses = Object.keys(operation.responses).filter((status) => /^2\d\d$/.test(status));
      assert(successStatuses.length > 0, `Missing success response: ${method.toUpperCase()} ${path}`);
      if (successStatuses.every((status) => status !== '204')) assert(successStatuses.some((status) => {
        const response = operation.responses[status];
        return isObject(response) && isObject(response.content) && Object.keys(response.content).length > 0;
      }), `Success response has no response content: ${method.toUpperCase()} ${path}`);

      assert(Array.isArray(operation.security), `Missing security metadata: ${method.toUpperCase()} ${path}`);
      if (PUBLIC_PATHS.has(path)) assert(operation.security.length === 0, `Public endpoint has a security requirement: ${method.toUpperCase()} ${path}`);
      else assert(operation.security.some((requirement) => isObject(requirement) && 'bearer' in requirement), `Protected endpoint is missing bearer security: ${method.toUpperCase()} ${path}`);

      if (operation.requestBody) {
        requestBodies.add(`${method.toUpperCase()} ${path}`);
        assert(isObject(operation.requestBody.content), `Invalid requestBody content: ${method.toUpperCase()} ${path}`);
        const mediaTypes = Object.keys(operation.requestBody.content);
        assert(mediaTypes.length > 0, `Request body has no media types: ${method.toUpperCase()} ${path}`);
        const supportedMediaTypes = mediaTypes.filter((mediaType) => REQUEST_BODY_MEDIA_TYPES.has(mediaType));
        assert(supportedMediaTypes.length > 0, `Missing supported request body media type: ${method.toUpperCase()} ${path}`);
        for (const mediaType of supportedMediaTypes) {
          const mediaTypeObject = operation.requestBody.content[mediaType];
          assert(isObject(mediaTypeObject) && isObject(mediaTypeObject.schema), `Request body media type is missing schema: ${mediaType} ${method.toUpperCase()} ${path}`);
        }
      }

      const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const pathParameters = new Set(parameters.filter((parameter) => isObject(parameter) && parameter.in === 'path').map((parameter) => parameter.name));
      for (const template of templates) {
        assert(pathParameters.has(template), `Undocumented path parameter ${template}: ${method.toUpperCase()} ${path}`);
        const parameter = parameters.find((candidate) => isObject(candidate) && candidate.in === 'path' && candidate.name === template);
        assert(parameter.required === true, `Path parameter must be required: ${template} in ${method.toUpperCase()} ${path}`);
      }

      for (const status of Object.keys(operation.responses)) {
        assert(/^(?:2\d\d|3\d\d|4\d\d|5\d\d|default)$/.test(status), `Invalid response status ${status}: ${method.toUpperCase()} ${path}`);
        const response = operation.responses[status];
        assert(isObject(response), `Invalid response object ${status}: ${method.toUpperCase()} ${path}`);
        if (status === '204') assert(!response.content, `204 response must not define a response body: ${method.toUpperCase()} ${path}`);
        if (response.content) {
          assert(isObject(response.content), `Invalid response content: ${method.toUpperCase()} ${path}`);
          if (response.content['application/json']) assert(isObject(response.content['application/json'].schema), `JSON response is missing schema: ${method.toUpperCase()} ${path} ${status}`);
        }
      }
    }
  }

  for (const [name, componentSchema] of Object.entries(document.components.schemas)) validateSchemaQuality(document, componentSchema, `components.schemas.${name}`);
  for (const reference of responseRefs) {
    if (!reference.startsWith('#/components/schemas/')) continue;
    const schemaName = reference.slice('#/components/schemas/'.length);
    assert(schemaName in document.components.schemas, `Response references missing schema ${schemaName}`);
  }

  const sensitiveResponseSchemaNames = new Set();
  for (const reference of responseRefs) {
    if (!reference.startsWith('#/components/schemas/')) continue;
    const name = reference.slice('#/components/schemas/'.length);
    const componentSchema = document.components.schemas[name];
    if (!isObject(componentSchema) || !isObject(componentSchema.properties)) continue;
    if (Object.keys(componentSchema.properties).some((propertyName) => SENSITIVE_NAMES.has(propertyName))) sensitiveResponseSchemaNames.add(name);
  }
  for (const name of sensitiveResponseSchemaNames) assert(RESPONSE_ALLOWLIST.has(name), `Sensitive field appears in response schema ${name} without an explicit response allowlist entry`);

  return { operationCount, schemaCount: Object.keys(document.components.schemas).length, requestBodyCount: requestBodies.size };
};

const input = process.argv[2];
if (input) {
  const value = input.startsWith('http://') || input.startsWith('https://')
    ? await fetch(input).then(async (response) => {
        assert(response.ok, `OpenAPI endpoint returned HTTP ${response.status}`);
        return response.json();
      })
    : await import('node:fs/promises').then((fs) => fs.readFile(input, 'utf8')).then(JSON.parse);
  const result = validateOpenApiDocument(value);
  console.log(`OpenAPI validation passed: ${result.operationCount} operations, ${result.schemaCount} schemas, ${result.requestBodyCount} request bodies.`);
}