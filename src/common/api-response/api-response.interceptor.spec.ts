/**
 * ApiResponseInterceptor — Unit Tests
 *
 * Tests that successful responses are wrapped in the standard ApiSuccessResponse shape.
 */

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';
import { WRAPPED_MARKER } from './api-response.types';

function mockContext(overrides: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        requestId: 'test-request-id',
        path: '/users',
        method: 'GET',
        ...overrides,
      }),
    }),
  } as unknown as ExecutionContext;
}

function mockCallHandler(data: unknown): CallHandler {
  return {
    handle: () => of(data),
  };
}

describe('ApiResponseInterceptor', () => {
  let interceptor: ApiResponseInterceptor;

  beforeEach(() => {
    interceptor = new ApiResponseInterceptor();
  });

  describe('wrapping plain objects', () => {
    it('wraps a plain object response', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler({ id: 'u1', email: 'a@test.com' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['message']).toBe('Records retrieved successfully');
        expect((result as Record<string, unknown>)['data']).toEqual({ id: 'u1', email: 'a@test.com' });
        const meta = (result as Record<string, unknown>)['meta'] as Record<string, unknown>;
        expect(meta['requestId']).toBe('test-request-id');
        expect(meta['path']).toBe('/users');
        expect(meta['method']).toBe('GET');
        expect(meta['timestamp']).toBeDefined();
        done();
      });
    });

    it('wraps an array response', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler([{ id: 'u1' }, { id: 'u2' }]);
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['data']).toEqual([{ id: 'u1' }, { id: 'u2' }]);
        done();
      });
    });

    it('wraps null as empty response', (done) => {
      const ctx = mockContext({ path: '/auth/logout', method: 'POST' });
      const handler = mockCallHandler(null);
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['data']).toBeNull();
        done();
      });
    });

    it('wraps undefined as empty response', (done) => {
      const ctx = mockContext({ path: '/auth/logout', method: 'POST' });
      const handler = mockCallHandler(undefined);
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['data']).toBeNull();
        done();
      });
    });
  });

  describe('message extraction', () => {
    it('extracts message from { message: string } returns', (done) => {
      const ctx = mockContext({ path: '/auth/logout', method: 'POST' });
      const handler = mockCallHandler({ message: 'Logged out successfully' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['message']).toBe('Logged out successfully');
        expect((result as Record<string, unknown>)['data']).toBeNull();
        done();
      });
    });

    it('extracts message and data from { message, data } returns', (done) => {
      const ctx = mockContext({ path: '/auth/login', method: 'POST' });
      const handler = mockCallHandler({
        message: 'Logged in successfully',
        accessToken: 'tok1',
        refreshToken: 'tok2',
      });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['message']).toBe('Logged in successfully');
        const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
        expect(data['accessToken']).toBe('tok1');
        expect(data['refreshToken']).toBe('tok2');
        done();
      });
    });

    it('does not treat { message: string, id: string } as auth message (includes non-auth fields)', (done) => {
      const ctx = mockContext({ path: '/users/u1', method: 'GET' });
      const handler = mockCallHandler({ message: 'Record retrieved successfully', id: 'u1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        // message extraction only happens for small objects with message + optional auth fields
        // { id: 'u1' } should end up in data
        const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
        expect(data['id']).toBe('u1');
        done();
      });
    });
  });

  describe('double wrapping prevention', () => {
    it('skips already-wrapped responses', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const alreadyWrapped = {
        success: true,
        message: 'Already wrapped',
        data: { id: 'u1' },
        meta: { requestId: 'existing', timestamp: '2026-01-01T00:00:00Z', path: '/users', method: 'GET' },
        [WRAPPED_MARKER]: true,
      };
      const handler = mockCallHandler(alreadyWrapped);
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['message']).toBe('Already wrapped');
        done();
      });
    });
  });

  describe('meta fields', () => {
    it('includes requestId, timestamp, path, method in meta', (done) => {
      const ctx = mockContext({ path: '/roles', method: 'POST', requestId: 'req-abc' });
      const handler = mockCallHandler({ id: 'r1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        const meta = (result as Record<string, unknown>)['meta'] as Record<string, unknown>;
        expect(meta['requestId']).toBe('req-abc');
        expect(meta['path']).toBe('/roles');
        expect(meta['method']).toBe('POST');
        expect(meta['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        done();
      });
    });
  });
});
