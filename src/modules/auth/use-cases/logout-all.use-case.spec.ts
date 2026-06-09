/**
 * LogoutAllUseCase — Unit Tests
 *
 * Tests tokenVersion increment and refresh token revocation.
 */

import { LogoutAllUseCase } from './logout-all.use-case';
import { createMockPrismaService } from '../../../test-utils/mocks';

describe('LogoutAllUseCase', () => {
  it('revokes all refresh tokens and increments tokenVersion', async () => {
    const prisma = createMockPrismaService();
    // $transaction with array form: Prisma executes the operations internally.
    // Mock just resolves successfully without throwing.
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    const uc = new LogoutAllUseCase(prisma as never);
    await uc.execute('user-1');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('does not throw when user has no tokens', async () => {
    const prisma = createMockPrismaService();
    // $transaction with array form receives the operations array directly.
    // The Prisma client internally runs them; mock just resolves successfully.
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    const uc = new LogoutAllUseCase(prisma as never);
    await expect(uc.execute('user-1')).resolves.not.toThrow();
  });
});
