import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ExecutiveDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  ownerUserUuid?: string;
}
