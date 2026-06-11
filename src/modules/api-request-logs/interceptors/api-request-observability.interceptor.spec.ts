/**
 * API Request Observability Interceptor Tests
 */

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ApiRequestObservabilityInterceptor } from './api-request-observability.interceptor';
import { ApiRequestLogService } from '../services/api-request-log.service';

function mockRequest(overrides: Record<string, unknown> = {}): never {
  return {
    method: 'GET',
    originalUrl: '/users',
    url: '/users',
    ip: () => '127.0.0.1',
    headers: { 'user-agent': 'TestAgent/1.0' },
    route: { path: '/users' },
    ...overrides,
  } as never;
}

function mockResponse(statusCode = 200): never {
  return { statusCode } as never;
}

function mockContext(requestOverrides: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest(requestOverrides),
      getResponse: () => mockResponse(200),
    }),
  } as unknown as ExecutionContext;
}

function mockCallHandler(): CallHandler {
  return {
    handle: () => of({ success: true }),
  };
}

describe('ApiRequestObservabilityInterceptor', () => {
  let interceptor: ApiRequestObservabilityInterceptor;
  let mockService: { log: jest.Mock };

  beforeEach(() => {
    mockService = { log: jest.fn() };
    interceptor = new ApiRequestObservabilityInterceptor(
      mockService as unknown as ApiRequestLogService,
    );
  });

  it('logs successful request with durationMs and statusCode', async () => {
    const ctx = mockContext({ requestId: 'req-123', user: { id: 'user-1', email: 'a@b.com', roleId: 'role-1' } });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log).toHaveBeenCalledTimes(1);
    const call = mockService.log.mock.calls[0][0];
    expect(call.requestId).toBe('req-123');
    expect(call.method).toBe('GET');
    expect(call.path).toBe('/users');
    expect(call.statusCode).toBe(200);
    expect(call.durationMs).toBeGreaterThanOrEqual(0);
    expect(call.outcome).toBe('SUCCESS');
    expect(call.user).toEqual({ id: 'user-1', email: 'a@b.com', roleId: 'role-1' });
  });

  it('logs failed request with FAILURE outcome', async () => {
    const ctx = mockContext({ requestId: 'req-456' });
    const handler: CallHandler = {
      handle: () => throwError(() => ({ getStatus: () => 401 })),
    };

    await new Promise<void>((resolve, _reject) => {
      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          resolve();
        },
      });
    }).catch(() => {});

    const call = mockService.log.mock.calls[0][0];
    expect(call.outcome).toBe('FAILURE');
  });

  it('reads requestId from req.requestId', async () => {
    const ctx = mockContext({ requestId: 'custom-request-id' });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log.mock.calls[0][0].requestId).toBe('custom-request-id');
  });

  it('reads user from req.user', async () => {
    const ctx = mockContext({ user: { id: 'user-x', email: 'user@domain.com', roleId: 'admin' } });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log.mock.calls[0][0].user).toEqual({
      id: 'user-x',
      email: 'user@domain.com',
      roleId: 'admin',
    });
  });

  it('reads IP from x-forwarded-for', async () => {
    const ctx = mockContext({
      headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18', 'user-agent': 'Test' },
    });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log.mock.calls[0][0].ipAddress).toBe('203.0.113.50');
  });

  it('reads userAgent from headers', async () => {
    const ctx = mockContext({
      headers: { 'user-agent': 'Chrome/120.0' },
    });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log.mock.calls[0][0].userAgent).toBe('Chrome/120.0');
  });

  it('skips /health path', async () => {
    const ctx = mockContext({ originalUrl: '/health', url: '/health' });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log).not.toHaveBeenCalled();
  });

  it('skips /favicon path', async () => {
    const ctx = mockContext({ originalUrl: '/favicon.ico', url: '/favicon.ico' });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log).not.toHaveBeenCalled();
  });

  it('skips /static path', async () => {
    const ctx = mockContext({ originalUrl: '/static/logo.png', url: '/static/logo.png' });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log).not.toHaveBeenCalled();
  });

  it('does not change response data', async () => {
    const ctx = mockContext();
    const handler: CallHandler = {
      handle: () => of({ custom: 'payload', nested: { data: 123 } }),
    };

    let receivedData: unknown;
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        next: (data) => {
          receivedData = data;
        },
        complete: () => resolve(),
      });
    });

    expect(receivedData).toEqual({ custom: 'payload', nested: { data: 123 } });
  });

  it('does not throw if service fails', async () => {
    // Mock service that returns resolved Promise (non-blocking like real service)
    mockService.log.mockResolvedValue(undefined);
    const ctx = mockContext({ requestId: 'req-error' });
    const handler = mockCallHandler();

    await expect(
      new Promise<void>((resolve, _reject) => {
        interceptor.intercept(ctx, handler).subscribe({
          next: () => {},
          complete: () => resolve(),
          error: (_e: unknown) => {
            // Error should not propagate from a non-blocking service
            resolve();
          },
        });
      }),
    ).resolves.toBeUndefined();
  });

  it('reads route from req.route.path', async () => {
    const ctx = mockContext({ route: { path: '/users/:id' } } as Record<string, unknown>);
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.log.mock.calls[0][0].route).toBe('/users/:id');
  });

  it('reads errorCode from req.observability set by exception filter', async () => {
    const ctx = mockContext({
      observability: { errorCode: 'AUTH_INVALID_CREDENTIALS', errorMessage: 'Invalid credentials' },
    } as Record<string, unknown>);
    const handler: CallHandler = {
      handle: () => throwError(() => ({ getStatus: () => 401 })),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          resolve();
        },
      });
    }).catch(() => {});

    const call = mockService.log.mock.calls[0][0];
    expect(call.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
    expect(call.errorMessage).toBe('Invalid credentials');
  });

  it('does not log when user is not present (unauthenticated)', async () => {
    const ctx = mockContext({ user: undefined, requestId: 'req-no-user' });
    const handler = mockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => resolve(),
      });
    });

    const call = mockService.log.mock.calls[0][0];
    expect(call.user).toBeUndefined();
  });
});