import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  roleSlug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}