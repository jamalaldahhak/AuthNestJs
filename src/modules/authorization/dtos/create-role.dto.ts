import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { LoginMethod } from '../constants/login-method.enum.js';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(LoginMethod)
  loginMethod: LoginMethod;

  @IsOptional()
  @IsBoolean()
  selfRegistrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
