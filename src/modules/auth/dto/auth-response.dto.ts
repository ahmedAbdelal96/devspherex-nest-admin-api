export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export class RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
}
