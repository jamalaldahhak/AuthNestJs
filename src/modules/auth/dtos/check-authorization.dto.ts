import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CheckAuthorizationDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @Matches(/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/, { each: true })
  permissionKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { each: true })
  roleSlugs?: string[];
}
