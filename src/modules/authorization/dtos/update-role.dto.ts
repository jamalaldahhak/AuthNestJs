import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { LoginMethod } from '../constants/login-method.enum.js';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsEnum(LoginMethod)
  loginMethod?: LoginMethod;

  @IsOptional()
  @IsBoolean()
  selfRegistrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
