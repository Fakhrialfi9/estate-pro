import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class RetentionHoldDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsDateString()
  until?: string;

  toDate(): Date | undefined {
    return this.until ? new Date(this.until) : undefined;
  }
}
