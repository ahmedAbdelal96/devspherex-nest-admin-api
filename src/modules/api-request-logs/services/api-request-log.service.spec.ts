/**
 * API Request Log Service Tests
 */

import { ApiRequestLogService } from './api-request-log.service';
import { ApiRequestLogsRepository } from '../repositories/api-request-logs.repository';

describe('ApiRequestLogService', () => {
  let service: ApiRequestLogService;
  let mockRepository: {
    create: jest.Mock;
  };

  beforeEach(() => {
    mockRepository = { create: jest.fn() };
    service = new ApiRequestLogService(mockRepository as unknown as ApiRequestLogsRepository);
  });

  describe('log', () => {
    it('creates log with SUCCESS outcome', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        requestId: 'req-123',
        method: 'POST',
        path: '/auth/login',
        statusCode: 200,
        durationMs: 42,
        outcome: 'SUCCESS',
        user: { id: 'user-1', email: 'a@b.com', roleId: 'role-1' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        requestId: 'req-123',
        actorId: 'user-1',
        userEmail: 'a@b.com',
        userRoleId: 'role-1',
        method: 'POST',
        path: '/auth/login',
        route: undefined,
        statusCode: 200,
        durationMs: 42,
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: undefined,
        errorMessage: undefined,
      });
    });

    it('creates log with FAILURE outcome and errorCode', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-2' });

      await service.log({
        method: 'POST',
        path: '/auth/login',
        statusCode: 401,
        durationMs: 15,
        outcome: 'FAILURE',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.64.1',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        errorMessage: 'Invalid credentials',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        requestId: undefined,
        actorId: undefined,
        userEmail: undefined,
        userRoleId: undefined,
        method: 'POST',
        path: '/auth/login',
        route: undefined,
        statusCode: 401,
        durationMs: 15,
        outcome: 'FAILURE',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.64.1',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        errorMessage: 'Invalid credentials',
      });
    });

    it('includes user info when authenticated', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-3' });

      await service.log({
        requestId: 'req-456',
        method: 'GET',
        path: '/users',
        statusCode: 200,
        durationMs: 88,
        outcome: 'SUCCESS',
        user: { id: 'user-2', email: 'test@test.com', roleId: 'admin' },
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-2',
          userEmail: 'test@test.com',
          userRoleId: 'admin',
        }),
      );
    });

    it('does not throw when repository fails', async () => {
      mockRepository.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({
          method: 'GET',
          path: '/health',
          statusCode: 200,
          durationMs: 5,
          outcome: 'SUCCESS',
        }),
      ).resolves.not.toThrow();
    });

    it('does not include body/authorization/cookies', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-4' });

      await service.log({
        requestId: 'req-789',
        method: 'POST',
        path: '/auth/login',
        statusCode: 200,
        durationMs: 30,
        outcome: 'SUCCESS',
        user: { id: 'user-1' },
      });

      const callArgs = mockRepository.create.mock.calls[0][0];
      // Body, auth, cookies are not in the input type so they can't be passed
      expect(callArgs).not.toHaveProperty('body');
      expect(callArgs).not.toHaveProperty('authorization');
      expect(callArgs).not.toHaveProperty('cookie');
      expect(callArgs).not.toHaveProperty('requestBody');
    });

    it('truncates long path to 2048 chars', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-5' });
      const longPath = '/'.repeat(3000);

      await service.log({
        method: 'GET',
        path: longPath,
        statusCode: 200,
        durationMs: 10,
        outcome: 'SUCCESS',
      });

      const callArgs = mockRepository.create.mock.calls[0][0];
      expect(callArgs.path).toHaveLength(2048);
    });

    it('truncates long userAgent to 512 chars', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-6' });
      const longUA = 'Mozilla/'.repeat(200);

      await service.log({
        method: 'GET',
        path: '/ok',
        statusCode: 200,
        durationMs: 10,
        outcome: 'SUCCESS',
        userAgent: longUA,
      });

      const callArgs = mockRepository.create.mock.calls[0][0];
      expect(callArgs.userAgent).toHaveLength(512);
    });

    it('handles missing optional fields gracefully', async () => {
      mockRepository.create.mockResolvedValue({ id: 'log-7' });

      await service.log({
        method: 'GET',
        path: '/',
        statusCode: 404,
        durationMs: 5,
        outcome: 'FAILURE',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
          actorId: undefined,
          userEmail: undefined,
          userRoleId: undefined,
          route: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          errorCode: undefined,
          errorMessage: undefined,
        }),
      );
    });
  });
});