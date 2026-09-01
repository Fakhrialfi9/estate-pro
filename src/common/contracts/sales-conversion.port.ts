export interface SalesConversionInput {
  readonly leadUuid: string;
  readonly contactUuid: string;
  readonly ownerUserUuid: string | null;
  readonly idempotencyKey: string;
}

export interface SalesConversionResult {
  readonly opportunityUuid: string;
  readonly created: boolean;
}

export interface SalesConversionPort {
  createFromQualifiedLead(
    input: SalesConversionInput,
  ): Promise<SalesConversionResult>;
}

export const SALES_CONVERSION_PORT = Symbol('SALES_CONVERSION_PORT');
