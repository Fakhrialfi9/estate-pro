export interface PageQuery {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc'|'desc';
}
export interface PageResult<T> { readonly items: readonly T[]; readonly total:number; readonly page:number; readonly limit:number; }
