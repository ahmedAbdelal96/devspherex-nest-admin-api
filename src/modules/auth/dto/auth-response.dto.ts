export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export class RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
}
