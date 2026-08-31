export interface UserPublicSnapshot {
  readonly uuid: string;
  readonly status: string;
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
}

export interface UserPublicPort {
  getUser(uuid: string): Promise<UserPublicSnapshot>;
}

export const USER_PUBLIC_PORT = Symbol('USER_PUBLIC_PORT');
