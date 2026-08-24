import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';

class InputDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}

describe('HTTP input security baseline', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
  });

  it('rejects unexpected properties instead of silently accepting them', async () => {
    await expect(
      pipe.transform(
        { name: 'safe', isAdmin: true },
        { type: 'body', metatype: InputDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized field values at the DTO boundary', async () => {
    await expect(
      pipe.transform(
        { name: '<script>alert(1)</script>'.repeat(20) },
        { type: 'body', metatype: InputDto, data: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
