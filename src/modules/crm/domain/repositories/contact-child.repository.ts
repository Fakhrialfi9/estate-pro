export type ContactChildKind='address'|'phone'|'email';
export interface ContactChildRepository<TRecord=unknown,TCreate=Record<string,unknown>,TPatch=Record<string,unknown>>{
  create(contactUuid:string,input:TCreate):Promise<TRecord>;
  update(contactUuid:string,uuid:string,input:TPatch):Promise<TRecord>;
  delete(contactUuid:string,uuid:string):Promise<void>;
  setPrimary(contactUuid:string,uuid:string):Promise<TRecord>;
}
export const CONTACT_CHILD_REPOSITORY=Symbol('CONTACT_CHILD_REPOSITORY');
