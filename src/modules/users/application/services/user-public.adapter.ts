import { Injectable } from '@nestjs/common';
import { UserManagementService } from './user-management.service.js';
import type { UserPublicPort, UserPublicSnapshot } from '../../../../common/contracts/user-public.port.js';

@Injectable()
export class UserPublicAdapter implements UserPublicPort {
  constructor(private readonly users: UserManagementService) {}
  async getUser(uuid:string):Promise<UserPublicSnapshot>{
    const user=await this.users.getByUuid(uuid);
    return {uuid:user.uuid,status:user.status,isActive:user.isActive,deletedAt:user.deletedAt};
  }
}
