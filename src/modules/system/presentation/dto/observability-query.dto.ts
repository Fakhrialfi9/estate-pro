import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

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

  @IsOptional()
  @IsIn(['hour', 'day', 'week'])
  granularity?: 'hour' | 'day' | 'week';

  toDates() {
    return {
      from: this.from ? new Date(this.from) : undefined,
      to: this.to ? new Date(this.to) : undefined,
      subscriptionUuid: this.subscriptionUuid,
      granularity: this.granularity ?? 'day',
    };
  }
}
