import {
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class SetUserPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permissionIds: number[];
}
