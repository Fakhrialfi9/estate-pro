import { IsUUID } from 'class-validator';

export class AssignRolePermissionDto {
  @IsUUID('4')
  permissionUuid!: string;
}
