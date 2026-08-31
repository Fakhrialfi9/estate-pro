import type { LeadEntity, LeadProps } from '../entities/lead.entity.js';
import type {
  PageQuery,
  PageResult,
} from '../../application/ports/page-query.port.js';

export interface LeadRepository {
  create(
    props: Omit<LeadProps, 'uuid' | 'createdAt' | 'updatedAt'>,
  ): Promise<LeadEntity>;
  findByUuid(uuid: string): Promise<LeadEntity | null>;
  list(query: PageQuery): Promise<PageResult<LeadEntity>>;
  update(
    uuid: string,
    patch: Partial<Pick<LeadProps, 'code' | 'campaignUuid'>>,
  ): Promise<LeadEntity>;
  archive(uuid: string): Promise<void>;
  assign(uuid: string, assigneeUserUuid: string | null): Promise<LeadEntity>;
  saveScore(
    uuid: string,
    score: number,
    factors: readonly { code: string; points: number; explanation: string }[],
  ): Promise<LeadEntity>;
}
export const LEAD_REPOSITORY = Symbol('LEAD_REPOSITORY');
