import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT access token — use in Authorization header as Bearer <token>' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Refresh token — use to obtain a new access token' })
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds (default: 900 = 15 minutes)' })
  expiresIn: number;

  @ApiProperty({
    description: 'Authenticated user profile',
    properties: {
      id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      email: { type: 'string', example: 'user@example.com' },
      name: { type: 'string', example: 'Jane Doe' },
    },
  })
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export class RefreshTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'New JWT access token' })
  accessToken: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;
}
