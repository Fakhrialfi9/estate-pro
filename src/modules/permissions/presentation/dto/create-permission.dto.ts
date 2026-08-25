import { IsString, Length } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 100)
  module!: string;

  @IsString()
  @Length(1, 100)
  domain!: string;

  @IsString()
  @Length(1, 50)
  action!: string;
}
