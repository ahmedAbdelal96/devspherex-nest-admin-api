import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Valid email address — must be unique' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Str0ng!Pass', description: 'Password — 8 to 50 characters', minLength: 8, maxLength: 50 })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @ApiProperty({ example: 'Jane Doe', description: 'Full name — 1 to 100 characters', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
