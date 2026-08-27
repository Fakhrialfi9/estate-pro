import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePropertyTypeDto {
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message: 'code must contain only letters, numbers, underscores, or hyphens',
  })
  code!: string;

  @IsString()
  @Length(2, 150)
  name!: string;

  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
    message: 'slug must be a valid slug',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  icon?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  sortOrder?: number;
}
