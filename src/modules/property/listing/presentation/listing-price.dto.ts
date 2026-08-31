import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LISTING_PRICE_TYPES,
  type ListingPriceType,
} from '../domain/listing.types.js';

export class ListingPriceDto {
  @IsEnum(LISTING_PRICE_TYPES) priceType!: ListingPriceType;
  @IsString() @MinLength(3) @MaxLength(3) currency!: string;
  @IsOptional() @IsString() minPrice?: string | null;
  @IsOptional() @IsString() maxPrice?: string | null;
  @IsOptional() @IsString() pricePerSqm?: string | null;
}
