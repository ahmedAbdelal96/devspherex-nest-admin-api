/**
 * API Request Log Response Mapper Tests
 */

import { toApiRequestLogResponse } from './api-request-log-response.mapper';

describe('ApiRequestLogResponseMapper', () => {
  describe('toApiRequestLogResponse', () => {
    it('maps user object correctly', () => {
      const log = {
        id: 'log-1',
        requestId: 'req-123',
        actorId: 'user-1',
        userEmail: 'a@b.com',
        userRoleId: 'role-1',
        method: 'GET',
        path: '/users',
        route: '/users',
        statusCode: 200,
        durationMs: 55,
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-10T12:00:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result.user).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        roleId: 'role-1',
      });
    });

    it('maps client object correctly', () => {
      const log = {
        id: 'log-1',
        requestId: 'req-123',
        actorId: null,
        userEmail: null,
        userRoleId: null,
        method: 'GET',
        path: '/health',
        route: '/health',
        statusCode: 200,
        durationMs: 5,
        outcome: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'HealthCheck/1.0',
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-10T12:00:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result.client).toEqual({
        ipAddress: '127.0.0.1',
        userAgent: 'HealthCheck/1.0',
      });
    });

    it('maps error object correctly', () => {
      const log = {
        id: 'log-1',
        requestId: 'req-456',
        actorId: null,
        userEmail: null,
        userRoleId: null,
        method: 'POST',
        path: '/auth/login',
        route: '/auth/login',
        statusCode: 401,
        durationMs: 30,
        outcome: 'FAILURE',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.64',
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        errorMessage: 'Invalid credentials',
        createdAt: new Date('2026-06-10T12:00:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result.error).toEqual({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    });

    it('maps createdAt as ISO string', () => {
      const log = {
        id: 'log-1',
        requestId: 'req-123',
        actorId: null,
        userEmail: null,
        userRoleId: null,
        method: 'GET',
        path: '/',
        route: null,
        statusCode: 200,
        durationMs: 10,
        outcome: 'SUCCESS',
        ipAddress: null,
        userAgent: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-10T14:30:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result.createdAt).toBe('2026-06-10T14:30:00.000Z');
    });

    it('handles null values safely', () => {
      const log = {
        id: 'log-1',
        requestId: null,
        actorId: null,
        userEmail: null,
        userRoleId: null,
        method: 'GET',
        path: '/health',
        route: null,
        statusCode: 200,
        durationMs: 3,
        outcome: 'SUCCESS',
        ipAddress: null,
        userAgent: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-10T12:00:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result.requestId).toBeNull();
      expect(result.user.id).toBeNull();
      expect(result.user.email).toBeNull();
      expect(result.user.roleId).toBeNull();
      expect(result.client.ipAddress).toBeNull();
      expect(result.client.userAgent).toBeNull();
      expect(result.error.code).toBeNull();
      expect(result.error.message).toBeNull();
      expect(result.route).toBeNull();
    });

    it('returns correct response shape for success log', () => {
      const log = {
        id: 'abc-123',
        requestId: 'req-xyz',
        actorId: 'user-5',
        userEmail: 'admin@test.com',
        userRoleId: 'admin-role',
        method: 'POST',
        path: '/users',
        route: '/users',
        statusCode: 201,
        durationMs: 120,
        outcome: 'SUCCESS',
        ipAddress: '172.16.0.5',
        userAgent: 'PostmanRuntime/7.29.0',
        errorCode: null,
        errorMessage: null,
        createdAt: new Date('2026-06-10T09:00:00Z'),
      };

      const result = toApiRequestLogResponse(log as never);

      expect(result).toEqual({
        id: 'abc-123',
        requestId: 'req-xyz',
        method: 'POST',
        path: '/users',
        route: '/users',
        statusCode: 201,
        durationMs: 120,
        outcome: 'SUCCESS',
        user: {
          id: 'user-5',
          email: 'admin@test.com',
          roleId: 'admin-role',
        },
        client: {
          ipAddress: '172.16.0.5',
          userAgent: 'PostmanRuntime/7.29.0',
        },
        error: {
          code: null,
          message: null,
        },
        createdAt: '2026-06-10T09:00:00.000Z',
      });
    });
  });
});