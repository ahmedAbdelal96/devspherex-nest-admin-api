/**
 * ApiResponseInterceptor — Unit Tests
 *
 * Tests that successful responses are wrapped in the standard ApiSuccessResponse shape.
 * Proves that internal markers never leak to JSON output.
 */

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';
import { isWrapped } from './api-response.types';

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

  describe('message-envelope detection (strict)', () => {
    it('extracts message from { message: string } — logout envelope', (done) => {
      const ctx = mockContext({ path: '/auth/logout', method: 'POST' });
      const handler = mockCallHandler({ message: 'Logged out successfully' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['success']).toBe(true);
        expect((result as Record<string, unknown>)['message']).toBe('Logged out successfully');
        expect((result as Record<string, unknown>)['data']).toBeNull();
        done();
      });
    });

    it('extracts message and tokens from auth login envelope', (done) => {
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

    it('preserves user object in auth envelope with message', (done) => {
      const ctx = mockContext({ path: '/auth/login', method: 'POST' });
      const handler = mockCallHandler({
        message: 'Logged in successfully',
        accessToken: 'tok1',
        refreshToken: 'tok2',
        user: { id: 'u1', email: 'a@test.com', roleId: 'r1' },
      });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
        expect(data['accessToken']).toBe('tok1');
        expect(data['user']).toEqual({ id: 'u1', email: 'a@test.com', roleId: 'r1' });
        done();
      });
    });

    it('does NOT treat domain object with message as envelope — { message, id, body }', async () => {
      const ctx = mockContext({ path: '/users/u1', method: 'GET' });
      const handler = mockCallHandler({ message: 'Record retrieved successfully', id: 'u1', body: 'some content' });
      const result = await interceptor.intercept(ctx, handler).toPromise();
      const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
      expect(data['id']).toBe('u1');
      expect(data['body']).toBe('some content');
      expect((result as Record<string, unknown>)['message']).toBe('Records retrieved successfully');
    });

    it('does NOT treat domain object with message as envelope — { message, email, roleId }', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler({ message: 'Records retrieved successfully', email: 'a@test.com', roleId: 'r1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
        expect(data['email']).toBe('a@test.com');
        expect(data['roleId']).toBe('r1');
        done();
      });
    });

    it('treats { message, devOtp } as valid envelope (password recovery)', (done) => {
      const ctx = mockContext({ path: '/auth/password-recovery/request', method: 'POST' });
      const handler = mockCallHandler({ message: 'OTP sent successfully', devOtp: '123456' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['message']).toBe('OTP sent successfully');
        const data = (result as Record<string, unknown>)['data'] as Record<string, unknown>;
        expect(data['devOtp']).toBe('123456');
        done();
      });
    });
  });

  describe('marker leakage prevention', () => {
    it('JSON.stringify does not include __api_response_wrapped__', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler({ id: 'u1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        const json = JSON.stringify(result);
        expect(json).not.toContain('__api_response_wrapped__');
        done();
      });
    });

    it('Object.keys does not include __api_response_wrapped__', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler({ id: 'u1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect(Object.keys(result as object)).not.toContain('__api_response_wrapped__');
        done();
      });
    });

    it('Object.keys does not include any internal Symbol property', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const handler = mockCallHandler({ id: 'u1' });
      interceptor.intercept(ctx, handler).subscribe((result) => {
        const keys = Object.keys(result as object);
        expect(keys).not.toContain('__api_response_wrapped__');
        expect(keys).toEqual(expect.arrayContaining(['success', 'message', 'data', 'meta']));
        done();
      });
    });

    it('isWrapped returns true for already-marked response', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const alreadyMarked = {
        success: true,
        message: 'Already wrapped',
        data: { id: 'u1' },
        meta: { requestId: 'existing', timestamp: '2026-01-01T00:00:00Z', path: '/users', method: 'GET' },
      } as unknown as object;
      // Manually mark it (as a downstream interceptor would)
      Object.defineProperty(alreadyMarked, Symbol.for('devspherex.apiResponseWrapped'), {
        value: true,
        enumerable: false,
      });
      const handler = mockCallHandler(alreadyMarked);
      interceptor.intercept(ctx, handler).subscribe((result) => {
        expect((result as Record<string, unknown>)['message']).toBe('Already wrapped');
        // Not double-wrapped
        expect(isWrapped(result)).toBe(true);
        done();
      });
    });
  });

  describe('double wrapping prevention', () => {
    it('skips already-wrapped responses (structural detection)', (done) => {
      const ctx = mockContext({ path: '/users', method: 'GET' });
      const alreadyWrapped = {
        success: true,
        message: 'Already wrapped',
        data: { id: 'u1' },
        meta: { requestId: 'existing', timestamp: '2026-01-01T00:00:00Z', path: '/users', method: 'GET' },
      };
      // Mark it via Symbol
      Object.defineProperty(alreadyWrapped, Symbol.for('devspherex.apiResponseWrapped'), {
        value: true,
        enumerable: false,
      });
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