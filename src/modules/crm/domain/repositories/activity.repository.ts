export interface ActivityRecord {
  readonly uuid: string;
  readonly type: string;
  readonly status: string;
  readonly contactUuid: string | null;
  readonly leadUuid: string | null;
  readonly assigneeUserUuid: string | null;
  readonly dueAt: Date | null;
}
export interface ActivityRepository {
  create(record: Omit<ActivityRecord, 'uuid'>): Promise<ActivityRecord>;
  findByUuid(uuid: string): Promise<ActivityRecord | null>;
  list(query: {
    page: number;
    limit: number;
    leadUuid?: string;
    contactUuid?: string;
    assigneeUserUuid?: string;
    type?: string;
    status?: string;
  }): Promise<{
    items: readonly ActivityRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateStatus(uuid: string, status: string): Promise<ActivityRecord>;
}
export const ACTIVITY_REPOSITORY = Symbol('ACTIVITY_REPOSITORY');
