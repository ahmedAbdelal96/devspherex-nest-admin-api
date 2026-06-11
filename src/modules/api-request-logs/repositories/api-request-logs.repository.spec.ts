/**
 * API Request Logs Repository Tests
 */

import { ApiRequestLogsRepository } from './api-request-logs.repository';
import { createMockPrismaService } from '../../../test-utils/mocks';

describe('ApiRequestLogsRepository', () => {
  let repository: ApiRequestLogsRepository;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repository = new ApiRequestLogsRepository(mockPrisma as never);
  });

  describe('create', () => {
    it('calls Prisma create with correct fields', async () => {
      mockPrisma.apiRequestLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await repository.create({
        requestId: 'req-123',
        actorId: 'user-1',
        userEmail: 'a@b.com',
        userRoleId: 'role-1',
        method: 'POST',
        path: '/auth/login',
        route: '/auth/login',
        statusCode: 200,
        durationMs: 42,
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: undefined,
        errorMessage: undefined,
      });

      expect(result).toEqual({ id: 'log-1' });
      expect(mockPrisma.apiRequestLog.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req-123',
          actorId: 'user-1',
          userEmail: 'a@b.com',
          userRoleId: 'role-1',
          method: 'POST',
          path: '/auth/login',
          route: '/auth/login',
          statusCode: 200,
          durationMs: 42,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          errorCode: null,
          errorMessage: null,
        },
        select: { id: true },
      });
    });

    it('passes null for optional fields when not provided', async () => {
      mockPrisma.apiRequestLog.create.mockResolvedValue({ id: 'log-2' });

      await repository.create({
        method: 'GET',
        path: '/health',
        statusCode: 200,
        durationMs: 5,
        outcome: 'SUCCESS',
      });

      expect(mockPrisma.apiRequestLog.create).toHaveBeenCalledWith({
        data: {
          requestId: null,
          actorId: null,
          userEmail: null,
          userRoleId: null,
          method: 'GET',
          path: '/health',
          route: null,
          statusCode: 200,
          durationMs: 5,
          outcome: 'SUCCESS',
          ipAddress: null,
          userAgent: null,
          errorCode: null,
          errorMessage: null,
        },
        select: { id: true },
      });
    });
  });

  describe('findAll', () => {
    it('filters by requestId', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ requestId: 'req-abc' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ requestId: 'req-abc' }),
        }),
      );
    });

    it('filters by method', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ method: 'POST' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ method: 'POST' }),
        }),
      );
    });

    it('filters by statusCode', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ statusCode: 401 });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ statusCode: 401 }),
        }),
      );
    });

    it('filters by outcome', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ outcome: 'FAILURE' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ outcome: 'FAILURE' }),
        }),
      );
    });

    it('filters by userId (actorId)', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ userId: 'user-xyz' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorId: 'user-xyz' }),
        }),
      );
    });

    it('filters by errorCode', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ errorCode: 'AUTH_INVALID_CREDENTIALS' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ errorCode: 'AUTH_INVALID_CREDENTIALS' }),
        }),
      );
    });

    it('filters by date range from/to', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');

      await repository.findAll({ from, to });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: from, lte: to },
          }),
        }),
      );
    });

    it('filters by duration range', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ minDurationMs: 100, maxDurationMs: 500 });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            durationMs: { gte: 100, lte: 500 },
          }),
        }),
      );
    });

    it('pagination works with default page 1 and limit 20', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      const result = await repository.findAll({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('pagination respects page and limit params', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([
        { id: 'log-1', requestId: 'req-1' },
        { id: 'log-2', requestId: 'req-2' },
      ]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(50);

      const result = await repository.findAll({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('caps limit at 100', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ limit: 500 });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('paths filter uses contains with insensitive mode', async () => {
      mockPrisma.apiRequestLog.findMany.mockResolvedValue([]);
      mockPrisma.apiRequestLog.count.mockResolvedValue(0);

      await repository.findAll({ path: '/auth' });

      expect(mockPrisma.apiRequestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            path: { contains: '/auth', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns log when found', async () => {
      const mockLog = { id: 'log-1', requestId: 'req-123', method: 'GET', path: '/ok' };
      mockPrisma.apiRequestLog.findUnique.mockResolvedValue(mockLog);

      const result = await repository.findById('log-1');

      expect(result).toEqual(mockLog);
      expect(mockPrisma.apiRequestLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.apiRequestLog.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});