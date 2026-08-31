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

const typeMatches = (schema, value) => {
  if (value === null) return schema.nullable === true || schema.type === 'null';
  if (!schema.type) return true;
  switch (schema.type) {
    case 'string': return typeof value === 'string';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return isObject(value);
    default: return true;
  }
};

const validateSchemaQuality = (document, schema, location, seen = new Set()) => {
  if (!isObject(schema)) return;
  if (typeof schema.$ref === 'string') {
    const target = resolveLocalRef(document, schema.$ref);
    if (!seen.has(schema.$ref)) {
      const next = new Set(seen);
      next.add(schema.$ref);
      validateSchemaQuality(document, target, location, next);
    }
    return;
  }
  if (schema.format !== undefined) assert(typeof schema.format === 'string' && KNOWN_FORMATS.has(schema.format), `Unknown schema format at ${location}: ${String(schema.format)}`);
  if (Array.isArray(schema.enum)) {
    assert(schema.enum.length > 0, `Empty enum at ${location}`);
    if (schema.type === 'string') schema.enum.forEach((item) => assert(typeof item === 'string', `String enum contains non-string value at ${location}`));
  }
  if (schema.minimum !== undefined) assert(typeof schema.minimum === 'number', `Non-numeric minimum at ${location}`);
  if (schema.maximum !== undefined) assert(typeof schema.maximum === 'number', `Non-numeric maximum at ${location}`);
  if (schema.minLength !== undefined) assert(Number.isInteger(schema.minLength) && schema.minLength >= 0, `Invalid minLength at ${location}`);
  if (schema.maxLength !== undefined) assert(Number.isInteger(schema.maxLength) && schema.maxLength >= 0, `Invalid maxLength at ${location}`);
  if (schema.minLength !== undefined && schema.maxLength !== undefined) assert(schema.minLength <= schema.maxLength, `minLength exceeds maxLength at ${location}`);
  if (schema.properties !== undefined) {
    assert(isObject(schema.properties), `Schema properties must be an object at ${location}`);
    const properties = schema.properties;
    for (const required of schema.required ?? []) {
      assert(typeof required === 'string' && required in properties, `Required property ${String(required)} is missing from properties at ${location}`);
    }
    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      validateSchemaQuality(document, propertySchema, `${location}.${propertyName}`, seen);
    }
  }
  if (schema.items !== undefined) validateSchemaQuality(document, schema.items, `${location}[]`, seen);
  for (const branch of [...(Array.isArray(schema.oneOf) ? schema.oneOf : []), ...(Array.isArray(schema.anyOf) ? schema.anyOf : []), ...(Array.isArray(schema.allOf) ? schema.allOf : [])]) {
    validateSchemaQuality(document, branch, location, seen);
  }
  if ('default' in schema) assert(typeMatches(schema, schema.default), `Default value violates schema type at ${location}`);
};

const operationSchemasReferencedByResponses = (document) => {
  const refs = new Set();
  const collect = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!isObject(value)) return;
    if (typeof value.$ref === 'string') refs.add(value.$ref);
    Object.values(value).forEach(collect);
  };
  for (const item of Object.values(document.paths ?? {})) {
    if (!isObject(item)) continue;
    for (const [method, operation] of Object.entries(item)) {
      if (METHODS.has(method) && isObject(operation)) collect(operation.responses);
    }
  }
  return refs;
};

export const validateOpenApiDocument = (document) => {
  assert(isObject(document), 'OpenAPI document must be an object');
  assert(document.openapi === '3.0.3' || document.openapi === '3.1.0', `Unsupported OpenAPI version: ${String(document.openapi)}`);
  assert(isObject(document.info), 'OpenAPI info is missing');
  assert(typeof document.info.title === 'string' && document.info.title.length > 0, 'OpenAPI title is missing');
  assert(typeof document.info.version === 'string' && document.info.version.length > 0, 'API contract version is missing');
  assert(isObject(document.paths), 'OpenAPI paths are missing');
  assert(isObject(document.components), 'OpenAPI components are missing');
  assert(isObject(document.components.schemas), 'OpenAPI schemas are missing');
  assert(isObject(document.components.responses), 'OpenAPI reusable responses are missing');
  assert(isObject(document.components.securitySchemes), 'OpenAPI security schemes are missing');

  const bearer = document.components.securitySchemes.bearer;
  assert(isObject(bearer) && bearer.type === 'http' && bearer.scheme === 'bearer' && bearer.bearerFormat === 'JWT', 'Bearer security scheme must be HTTP bearer JWT');

  const operationIds = new Set();
  let operationCount = 0;
  const requestBodies = new Set();
  const responseRefs = operationSchemasReferencedByResponses(document);

  for (const [path, item] of Object.entries(document.paths)) {
    assert(path.startsWith('/api/v1/'), `Unversioned API path detected: ${path}`);
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
      if (successStatuses.every((status) => status !== '204')) {
        assert(successStatuses.some((status) => {
          const response = operation.responses[status];
          return isObject(response) && isObject(response.content) && Object.keys(response.content).length > 0;
        }), `Success response has no response content: ${method.toUpperCase()} ${path}`);
      }
      assert(isObject(operation.security), '');
      if (PUBLIC_PATHS.has(path)) assert(Array.isArray(operation.security) && operation.security.length === 0, `Public endpoint has a security requirement: ${method.toUpperCase()} ${path}`);
      else assert(Array.isArray(operation.security) && operation.security.some((requirement) => isObject(requirement) && 'bearer' in requirement), `Protected endpoint is missing bearer security: ${method.toUpperCase()} ${path}`);

      if (operation.requestBody) {
        requestBodies.add(`${method.toUpperCase()} ${path}`);
        assert(isObject(operation.requestBody.content), `Invalid requestBody content: ${method.toUpperCase()} ${path}`);
        assert(Boolean(operation.requestBody.content['application/json']), `Missing application/json request body: ${method.toUpperCase()} ${path}`);
      }

      const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
      const pathParameters = new Set(parameters.filter((parameter) => isObject(parameter) && parameter.in === 'path').map((parameter) => parameter.name));
      for (const template of templates) {
        assert(pathParameters.has(template), `Undocumented path parameter ${template}: ${method.toUpperCase()} ${path}`);
        const parameter = parameters.find((candidate) => isObject(candidate) && candidate.in === 'path' && candidate.name === template);
        assert(parameter.required === true, `Path parameter must be required: ${template} in ${method.toUpperCase()} ${path}`);
      }

      const statusCodes = Object.keys(operation.responses);
      for (const status of statusCodes) {
        assert(/^(?:2\d\d|3\d\d|4\d\d|5\d\d|default)$/.test(status), `Invalid response status ${status}: ${method.toUpperCase()} ${path}`);
        const response = operation.responses[status];
        assert(isObject(response), `Invalid response object ${status}: ${method.toUpperCase()} ${path}`);
        if (status === '204') assert(!response.content, `204 response must not define a response body: ${method.toUpperCase()} ${path}`);
        if (response.content) {
          assert(isObject(response.content), `Invalid response content: ${method.toUpperCase()} ${path}`);
          if (response.content['application/json']) {
            assert(isObject(response.content['application/json'].schema), `JSON response is missing schema: ${method.toUpperCase()} ${path} ${status}`);
          }
        }
      }
    }
  }

  for (const [name, schema] of Object.entries(document.components.schemas)) validateSchemaQuality(document, schema, `components.schemas.${name}`);
  for (const reference of responseRefs) {
    if (!reference.startsWith('#/components/schemas/')) continue;
    const schemaName = reference.slice('#/components/schemas/'.length);
    assert(schemaName in document.components.schemas, `Response references missing schema ${schemaName}`);
  }

  const sensitiveResponseSchemaNames = new Set();
  for (const reference of responseRefs) {
    if (!reference.startsWith('#/components/schemas/')) continue;
    const name = reference.slice('#/components/schemas/'.length);
    const schema = document.components.schemas[name];
    if (!isObject(schema) || !isObject(schema.properties)) continue;
    for (const propertyName of Object.keys(schema.properties)) {
      if (SENSITIVE_NAMES.has(propertyName)) sensitiveResponseSchemaNames.add(name);
    }
  }
  for (const name of sensitiveResponseSchemaNames) {
    assert(RESPONSE_ALLOWLIST.has(name), `Sensitive field appears in response schema ${name} without an explicit response allowlist entry`);
  }

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