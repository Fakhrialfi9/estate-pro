import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignUserRoleDto {
  @IsUUID('4')
  @IsNotEmpty()
  roleUuid!: string;
}
