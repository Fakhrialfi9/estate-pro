import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_OPTION_TYPES, type PaymentOptionType } from '../domain/listing.types.js';

export class ListingPaymentDto {
  @IsEnum(PAYMENT_OPTION_TYPES) optionType!: PaymentOptionType;
  @IsOptional() @IsString() downPaymentAmount?: string | null;
  @IsOptional() @IsString() @MaxLength(7) downPaymentPercent?: string | null;
  @IsOptional() @IsString() installmentAmount?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(600) tenorMonths?:
    | number
    | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
}
