export interface InquiryRecord {
  readonly uuid: string;
  readonly intent: string;
  readonly status: string;
  readonly contactUuid: string | null;
  readonly leadUuid: string | null;
  readonly propertyUuid: string | null;
  readonly createdAt: Date;
}
export interface InquiryRepository {
  create(
    record: Omit<InquiryRecord, 'uuid' | 'createdAt'>,
  ): Promise<InquiryRecord>;
  findByUuid(uuid: string): Promise<InquiryRecord | null>;
  list(query: {
    page: number;
    limit: number;
    intent?: string;
    status?: string;
    propertyUuid?: string;
    leadUuid?: string;
  }): Promise<{
    items: readonly InquiryRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  attachLead(uuid: string, leadUuid: string): Promise<InquiryRecord>;
}
export const INQUIRY_REPOSITORY = Symbol('INQUIRY_REPOSITORY');
