/**
 * Test Mocks — reusable mock factories for unit tests.
 *
 * Import from here instead of duplicating mock setup across spec files.
 */

import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Build a mock ConfigService with typed get() responses.
 *
 * IMPORTANT: returns a plain object (not jest.Mocked) so that get() returns
 * string | undefined at runtime (not unknown). This is required because
 * PasswordRecoveryConfig calls configService.get<string>(...) and then parses
 * the result with Number.parseInt — String(unknown) would produce "undefined"
 * and parseInt would return NaN.
 */
export function createMockConfigService(
  overrides: Partial<Record<string, unknown>> = {},
): ConfigService {
  const map = new Map<string, unknown>(Object.entries(overrides));
  return {
    get: (key: string): string | undefined => map.get(key) as string | undefined,
    getOrThrow: (key: string): string => {
      const val = map.get(key);
      if (val === undefined) throw new Error(`Config key not found: ${key}`);
      return val as string;
    },
  } as unknown as ConfigService;
}

/**
 * Build a mock Reflector that returns configured values per key.
 */
export function createMockReflector(overrides: Record<string, unknown> = {}): jest.Mocked<Reflector> {
  return {
    get: jest.fn((key: string) => overrides[key]),
    getAllAndOverride: jest.fn((key: string) => overrides[key]),
    getAllMerged: jest.fn((key: string) => overrides[key]),
  } as unknown as jest.Mocked<Reflector>;
}

/**
 * Build a mock ExecutionContext with a request object.
 */
export function createMockExecutionContext(request: Record<string, unknown> = {}): jest.Mocked<ExecutionContext> {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn().mockReturnValue({}),
      getNext: jest.fn(),
    }),
    getClass: jest.fn().mockReturnValue(jest.fn()),
    getHandler: jest.fn().mockReturnValue(jest.fn()),
    getArgs: jest.fn().mockReturnValue([]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn().mockReturnValue({}),
    switchToWs: jest.fn().mockReturnValue({}),
    getType: jest.fn().mockReturnValue('http'),
  } as unknown as jest.Mocked<ExecutionContext>;
}

/**
 * Create a Prisma mock with chainable find/findUnique/create methods.
 */
export function createMockPrismaService() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordRecoveryChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}
