import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ObservabilityQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  subscriptionUuid?: string;

  toDates() {
    return {
      from: this.from ? new Date(this.from) : undefined,
      to: this.to ? new Date(this.to) : undefined,
      subscriptionUuid: this.subscriptionUuid,
    };
  }
}
