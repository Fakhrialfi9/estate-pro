export interface UserIdentityReader {
  getByUuid(uuid: string): Promise<{ isAccessible(): boolean }>;
}

export const USER_IDENTITY_READER = Symbol('USER_IDENTITY_READER');
