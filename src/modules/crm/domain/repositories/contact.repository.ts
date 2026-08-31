import type {
  ContactEntity,
  ContactPatch,
  ContactProps,
} from '../entities/contact.entity.js';
import type {
  PageQuery,
  PageResult,
} from '../../application/ports/page-query.port.js';

export interface ContactRepository {
  create(
    props: Omit<ContactProps, 'uuid' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContactEntity>;
  findByUuid(uuid: string): Promise<ContactEntity | null>;
  list(query: PageQuery): Promise<PageResult<ContactEntity>>;
  update(uuid: string, patch: ContactPatch): Promise<ContactEntity>;
  archive(uuid: string): Promise<void>;
}
export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');
