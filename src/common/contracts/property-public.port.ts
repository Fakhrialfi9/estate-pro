export interface PropertyPublicPort { getProperty(uuid:string):Promise<unknown>; }
export const PROPERTY_PUBLIC_PORT=Symbol('PROPERTY_PUBLIC_PORT');
