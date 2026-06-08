import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateUserRoleDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  roleId?: string;
}
