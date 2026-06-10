/**
 * AuditLogsRepository — Unit Tests
 *
 * Verifies:
 * - create() calls Prisma with before/after/metadata stored separately
 * - create() stores actorEmail, actorRoleId, ipAddress, status
 * - findAll() applies all filters including requestId, status, resourceType/resourceId
 * - findAll() applies date range filters (from/to)
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
    it('stores before/after/metadata in separate fields', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        action: 'users.update',
        before: { id: 'user-1', name: 'Old' },
        after: { id: 'user-1', name: 'New' },
        metadata: { change: 'name' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: null,
          actorEmail: null,
          actorRoleId: null,
          action: 'users.update',
          resourceType: null,
          resourceId: null,
          status: 'SUCCESS',
          requestId: null,
          ipAddress: null,
          userAgent: null,
          before: { id: 'user-1', name: 'Old' },
          after: { id: 'user-1', name: 'New' },
          metadata: { change: 'name' },
        },
      });
    });

    it('stores actorEmail and actorRoleId when provided', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        actorId: 'admin-1',
        actorEmail: 'admin@test.com',
        actorRoleId: 'role-admin',
        action: 'users.create',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin-1',
            actorEmail: 'admin@test.com',
            actorRoleId: 'role-admin',
          }),
        }),
      );
    });

    it('stores ipAddress when provided', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        action: 'users.create',
        ipAddress: '192.168.1.100',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: '192.168.1.100',
          }),
        }),
      );
    });

    it('stores status when provided', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({
        action: 'users.create',
        status: 'FAILURE',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILURE',
          }),
        }),
      );
    });

    it('defaults status to SUCCESS when not provided', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({ action: 'users.create' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
          }),
        }),
      );
    });

    it('converts undefined fields to null', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      await repository.create({ action: 'users.create' });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          actorEmail: null,
          actorRoleId: null,
          resourceType: null,
          resourceId: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
        }),
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

    it('applies resourceType filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ resourceType: 'User', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resourceType: 'User' }),
        }),
      );
    });

    it('applies resourceId filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ resourceId: 'user-123', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resourceId: 'user-123' }),
        }),
      );
    });

    it('applies status filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ status: 'SUCCESS', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
    });

    it('applies requestId filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await repository.findAll({ requestId: 'req-abc-123', page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ requestId: 'req-abc-123' }),
        }),
      );
    });

    it('applies date range filter (from/to)', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);
      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');

      await repository.findAll({ from, to, page: 1, limit: 20 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: from, lte: to },
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