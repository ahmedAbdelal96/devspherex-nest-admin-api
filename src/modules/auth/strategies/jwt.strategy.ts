import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/database/prisma.service';
import { JwtPayload } from '../services/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Validate tokenVersion is present
    if (typeof payload.tokenVersion !== 'number') {
      throw new UnauthorizedException('Invalid token: missing tokenVersion');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    // Validate tokenVersion matches
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been invalidated');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      role: user.role,
      status: user.status,
    };
  }
}