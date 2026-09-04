import { IsBase64, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class ImportDto {
  @IsString() @MaxLength(255) filename!: string;
  @IsBase64() contentBase64!: string;
  @IsOptional() @IsIn(['csv','json']) format?: 'csv'|'json';
  @IsOptional() @IsString() @MaxLength(200) idempotencyKey?: string;
  @IsOptional() @IsBoolean() preview?: boolean;
}
export class ImportQueryDto {
  @IsOptional() @IsInt() @Min(1) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsIn(['QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','RETRYABLE']) state?: string;
}
