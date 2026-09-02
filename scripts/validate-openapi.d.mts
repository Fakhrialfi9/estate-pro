export interface OpenApiValidationResult {
  readonly operationCount: number;
  readonly schemaCount: number;
  readonly requestBodyCount: number;
}

export declare function validateOpenApiDocument(
  document: unknown,
): OpenApiValidationResult;
