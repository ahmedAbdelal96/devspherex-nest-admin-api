import { IsArray, IsUUID } from 'class-validator';

export class UpdateUserPermissionOverridesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
