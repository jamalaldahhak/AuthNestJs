import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/)
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
