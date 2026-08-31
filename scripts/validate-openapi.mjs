const URL = process.argv[2];

if (!URL) {
  console.error('Usage: node scripts/validate-openapi.mjs <docs-json-url>');
  process.exit(1);
}

const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const response = await fetch(URL, { headers: { accept: 'application/json' } });
assert(response.ok, `OpenAPI endpoint returned HTTP ${response.status}`);

const document = await response.json();
assert(isObject(document), 'OpenAPI document must be an object');
assert(typeof document.openapi === 'string', 'OpenAPI version is missing');
assert(isObject(document.info), 'OpenAPI info is missing');
assert(typeof document.info.version === 'string' && document.info.version.length > 0, 'API contract version is missing');
assert(isObject(document.paths), 'OpenAPI paths are missing');
assert(isObject(document.components), 'OpenAPI components are missing');
assert(isObject(document.components.schemas), 'OpenAPI schemas are missing');
assert(isObject(document.components.responses), 'OpenAPI reusable responses are missing');
assert(isObject(document.components.securitySchemes), 'OpenAPI security schemes are missing');
assert(isObject(document.components.securitySchemes.bearer), 'Bearer security scheme is missing');

const bearer = document.components.securitySchemes.bearer;
assert(bearer.type === 'http' && bearer.scheme === 'bearer', 'Bearer scheme must be HTTP bearer');
assert(bearer.bearerFormat === 'JWT', 'Bearer scheme must advertise JWT format');

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const localRefs = new Set();
const sensitiveNames = new Set([
  'password',
  'passwordHash',
  'passwordConfirmation',
  'refreshToken',
  'accessToken',
  'secret',
  'sessionSecret',
  'jwtSecret',
  'twoFactorSecret',
  'recoveryCodes',
  'clientSecret',
]);

const collectRefs = (value) => {
  if (Array.isArray(value)) {
    value.forEach(collectRefs);
    return;
  }
  if (!isObject(value)) return;
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
    localRefs.add(value.$ref);
  }
  Object.values(value).forEach(collectRefs);
};

let operationCount = 0;
for (const [path, item] of Object.entries(document.paths)) {
  assert(path.startsWith('/api/v1/'), `Unversioned API path detected: ${path}`);
  assert(isObject(item), `Path item is invalid: ${path}`);

  for (const [method, operation] of Object.entries(item)) {
    if (!methods.has(method)) continue;
    assert(isObject(operation), `Operation is invalid: ${method.toUpperCase()} ${path}`);
    operationCount += 1;
    assert(typeof operation.operationId === 'string' && operation.operationId.length > 0, `Missing operationId: ${method.toUpperCase()} ${path}`);
    assert(isObject(operation.responses) && Object.keys(operation.responses).length > 0, `Missing responses: ${method.toUpperCase()} ${path}`);

    if (operation.requestBody) {
      assert(isObject(operation.requestBody.content), `Invalid requestBody content: ${method.toUpperCase()} ${path}`);
      assert(Boolean(operation.requestBody.content['application/json']), `Missing application/json request body: ${method.toUpperCase()} ${path}`);
    }

    collectRefs(operation);
  }
}

const operationIds = new Set();
for (const item of Object.values(document.paths)) {
  if (!isObject(item)) continue;
  for (const [method, operation] of Object.entries(item)) {
    if (!methods.has(method) || !isObject(operation)) continue;
    assert(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
  }
}

for (const localRef of localRefs) {
  const parts = localRef.slice(2).split('/');
  let current = document;
  for (const part of parts) {
    assert(isObject(current) && part in current, `Unresolved OpenAPI $ref: ${localRef}`);
    current = current[part];
  }
}

const schemas = document.components.schemas;
for (const [schemaName, schema] of Object.entries(schemas)) {
  if (!isObject(schema)) continue;
  const properties = isObject(schema.properties) ? schema.properties : {};
  for (const sensitive of sensitiveNames) {
    const field = properties[sensitive];
    if (!field) continue;
    const lower = schemaName.toLowerCase();
    const isRequestLike = lower.includes('request') || lower.includes('login') || lower.includes('token') || lower.includes('verify') || lower.includes('regenerate') || lower.includes('disable');
    assert(
      isRequestLike || field.writeOnly === true,
      `Sensitive field ${sensitive} is exposed by response-capable schema ${schemaName}`,
    );
  }
}

console.log(`OpenAPI validation passed: ${operationCount} operations, ${Object.keys(schemas).length} schemas, ${localRefs.size} local refs.`);
