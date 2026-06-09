/**
 * JwtStrategy — Unit Tests
 *
 * Tests tokenVersion validation and inactive user rejection.
 */

import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { createMockConfigService } from '../../../test-utils/mocks';
import { createMockPrismaService } from '../../../test-utils/mocks';

function buildStrategy(prismaOverrides: Record<string, unknown> = {}, configOverrides: Record<string, unknown> = {}) {
  const prisma = createMockPrismaService();
  Object.assign(prisma, prismaOverrides);
  const config = createMockConfigService({ 'jwt.secret': 'test-secret', ...configOverrides });
  return new JwtStrategy(prisma as never, config as never);
}

describe('JwtStrategy', () => {
  describe('validate payload', () => {
    it('rejects payload without tokenVersion', async () => {
      const strategy = buildStrategy({}, {});
      await expect(strategy.validate({ sub: 'user-1' } as never)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects inactive user', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', status: 'DISABLED', tokenVersion: 1 });
      const strategy = buildStrategy(prisma);
      await expect(strategy.validate({ sub: 'user-1', tokenVersion: 1 } as never)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects stale tokenVersion', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE', tokenVersion: 2 });
      const strategy = buildStrategy(prisma);
      await expect(strategy.validate({ sub: 'user-1', tokenVersion: 1 } as never)).rejects.toThrow(UnauthorizedException);
    });

    it('accepts valid token with matching tokenVersion', async () => {
      const prisma = createMockPrismaService();
      prisma.user.findUnique = jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        roleId: 'role-1',
        status: 'ACTIVE',
        tokenVersion: 3,
        role: { name: 'Admin', permissions: [] },
      });
      const strategy = buildStrategy(prisma);
      const result = await strategy.validate({ sub: 'user-1', tokenVersion: 3 } as never);
      expect(result.id).toBe('user-1');
      expect(result.status).toBe('ACTIVE');
    });
  });
});
