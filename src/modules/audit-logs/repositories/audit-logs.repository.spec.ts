/**
 * AuditLogsRepository — Unit Tests
 *
 * Verifies:
 * - create() calls Prisma with sanitized data
 * - findAll() applies filters and pagination
 * - findById() returns record
 */

import { AuditLogsRepository } from './audit-logs.repository';
import { PrismaService } from '../../../common/database/prisma.service';

function createMockPrismaService() {
  return {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;
}

describe('AuditLogsRepository', () => {
  let prisma: jest.Mocked<PrismaService>;
  let repository: AuditLogsRepository;

  beforeEach(() => {
    prisma = createMockPrismaService();
    repository = new AuditLogsRepository(prisma);
  });

  describe('create()', () => {
    it('calls prisma.auditLog.create with sanitized data', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        actorId: 'admin-1',
        action: 'users.create',
        entity: 'User',
        entityId: 'user-1',
        metadata: { id: 'user-1', email: 'new@test.com' },
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'req-123',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          action: 'users.create',
          entity: 'User',
          entityId: 'user-1',
          metadata: { id: 'user-1', email: 'new@test.com' },
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          requestId: 'req-123',
        },
      });
    });

    it('converts undefined fields to null', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        action: 'users.create',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: null,
          action: 'users.create',
          entity: null,
          entityId: null,
          metadata: undefined,
          ip: null,
          userAgent: null,
          requestId: null,
        },
      });
    });
  });

  describe('findAll()', () => {
    it('applies actorId filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ actorId: 'admin-1', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorId: 'admin-1' }),
        }),
      );
    });

    it('applies action filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ action: 'users.create', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'users.create' }),
        }),
      );
    });

    it('applies entity filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ entity: 'User', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entity: 'User' }),
        }),
      );
    });

    it('applies date range filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);
      const start = new Date('2026-01-01');
      const end = new Date('2026-12-31');

      await repository.findAll({ startDate: start, endDate: end, page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('applies pagination (skip and take)', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ page: 3, limit: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('orders by createdAt descending', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns data and total count', async () => {
      const logs = [{ id: 'a1' }, { id: 'a2' }];
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(logs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(42);

      const result = await repository.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(42);
    });
  });

  describe('findById()', () => {
    it('calls prisma.auditLog.findUnique with id', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.findById('audit-1');

      expect(prisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'audit-1' },
      });
    });

    it('returns null when record not found', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});