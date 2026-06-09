import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class PaginatedUsersResponseDto {
  data: Array<{
    id: string;
    email: string;
    name: string;
    status: UserStatus;
    role: {
      id: string;
      name: string;
    } | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
