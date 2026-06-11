/**
 * GlobalExceptionFilter — Unit Tests
 *
 * Tests that exceptions are mapped to the standard ApiErrorResponse shape.
 * Includes ValidationPipe exceptionFactory scenario.
 */

import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { GlobalExceptionFilter } from './app-exception.filter';
import { AppErrorCodes } from './app-error-codes';
import { Prisma } from '@prisma/client';

interface MockResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

interface ApiFieldError {
  field: string;
  message: string;
  code: string;
}

function createMockHost(requestId = 'test-req-id', path = '/test', method = 'POST'): {
  host: { switchToHttp: () => { getResponse: () => Response; getRequest: () => Record<string, unknown> } };
  mockRes: MockResponse;
  mockReq: Record<string, unknown>;
} {
  const mockRes: MockResponse = { statusCode: 200, body: {} };
  const mockResponse = {
    status: (s: number) => { mockRes.statusCode = s; return mockResponse; },
    json: (body: Record<string, unknown>) => { mockRes.body = body; return mockResponse; },
  } as unknown as Response;
  // Shared request object so observability set by filter is readable by test assertions
  const mockReq: Record<string, unknown> = { requestId, path, method };
  const host = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockReq,
    }),
  };
  return { host, mockRes, mockReq };
}

// Simulates what ValidationPipe exceptionFactory produces
function createValidationException(errors: Array<{ property: string; constraints?: Record<string, string> }>) {
  return new BadRequestException({
    message: 'Validation failed',
    errors,
  });
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  describe('HttpException mapping', () => {
    it('maps BadRequestException to 400/BAD_REQUEST', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new BadRequestException('Invalid input'), host as never);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body['success']).toBe(false);
      expect(mockRes.body['code']).toBe(AppErrorCodes.BAD_REQUEST);
    });

    it('maps UnauthorizedException to 401/AUTH_UNAUTHORIZED', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new UnauthorizedException('Unauthorized'), host as never);
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body['code']).toBe(AppErrorCodes.AUTH_UNAUTHORIZED);
    });

    it('maps ForbiddenException to 403/AUTH_FORBIDDEN', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new ForbiddenException('Forbidden'), host as never);
      expect(mockRes.statusCode).toBe(403);
      expect(mockRes.body['code']).toBe(AppErrorCodes.AUTH_FORBIDDEN);
    });

    it('maps NotFoundException to 404/NOT_FOUND', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new NotFoundException('Not found'), host as never);
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.body['code']).toBe(AppErrorCodes.NOT_FOUND);
    });

    it('maps ConflictException to 409/CONFLICT', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new ConflictException('Conflict'), host as never);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body['code']).toBe(AppErrorCodes.CONFLICT);
    });
  });

  describe('ValidationPipe exceptionFactory mapping', () => {
    it('maps ValidationPipe exceptionFactory errors to VALIDATION_FAILED', () => {
      const { host, mockRes } = createMockHost();
      const exception = createValidationException([
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
        { property: 'password', constraints: { minLength: 'password must be longer' } },
      ]);
      filter.catch(exception, host as never);

      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body['success']).toBe(false);
      expect(mockRes.body['code']).toBe(AppErrorCodes.VALIDATION_FAILED);
      expect(mockRes.body['message']).toBe('Validation failed');
    });

    it('includes field-level errors array', () => {
      const { host, mockRes } = createMockHost();
      const exception = createValidationException([
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
        { property: 'password', constraints: { minLength: 'password must be longer' } },
      ]);
      filter.catch(exception, host as never);

      const body = mockRes.body as { errors: ApiFieldError[] };
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBe(2);
    });

    it('sanitizes password field to "field"', () => {
      const { host, mockRes } = createMockHost();
      const exception = createValidationException([
        { property: 'password', constraints: { minLength: 'password must be longer' } },
      ]);
      filter.catch(exception, host as never);

      const body = mockRes.body as { errors: ApiFieldError[] };
      expect(body.errors[0].field).toBe('field');
    });

    it('marks isNotEmpty constraints as VALIDATION_FIELD_REQUIRED', () => {
      const { host, mockRes } = createMockHost();
      const exception = createValidationException([
        { property: 'email', constraints: { isNotEmpty: 'email should not be empty' } },
      ]);
      filter.catch(exception, host as never);

      const body = mockRes.body as { errors: ApiFieldError[] };
      expect(body.errors[0].code).toBe(AppErrorCodes.VALIDATION_FIELD_REQUIRED);
    });

    it('marks isEmail constraints as VALIDATION_FIELD_INVALID', () => {
      const { host, mockRes } = createMockHost();
      const exception = createValidationException([
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
      ]);
      filter.catch(exception, host as never);

      const body = mockRes.body as { errors: ApiFieldError[] };
      expect(body.errors[0].code).toBe(AppErrorCodes.VALIDATION_FIELD_INVALID);
    });

    it('uses custom message from exceptionFactory', () => {
      const { host, mockRes } = createMockHost();
      const exception = new BadRequestException({
        message: 'Custom validation message',
        errors: [
          { property: 'name', constraints: { isNotEmpty: 'name required' } },
        ],
      });
      filter.catch(exception, host as never);

      expect(mockRes.body['message']).toBe('Custom validation message');
    });
  });

  describe('Prisma error mapping', () => {
    it('maps P2002 to 409/DB_UNIQUE_CONSTRAINT', () => {
      const { host, mockRes } = createMockHost();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.0.0',
      });
      filter.catch(prismaError, host as never);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body['code']).toBe(AppErrorCodes.DB_UNIQUE_CONSTRAINT);
    });

    it('maps P2025 to 404/DB_RECORD_NOT_FOUND', () => {
      const { host, mockRes } = createMockHost();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.0.0',
      });
      filter.catch(prismaError, host as never);
      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.body['code']).toBe(AppErrorCodes.DB_RECORD_NOT_FOUND);
    });

    it('maps P2003 to 409/DB_FOREIGN_KEY_CONSTRAINT', () => {
      const { host, mockRes } = createMockHost();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Foreign key', {
        code: 'P2003',
        clientVersion: '7.0.0',
      });
      filter.catch(prismaError, host as never);
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body['code']).toBe(AppErrorCodes.DB_FOREIGN_KEY_CONSTRAINT);
    });

    it('maps P2002 with meta.target to errors[0].field', () => {
      const { host, mockRes } = createMockHost();
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '7.0.0',
        meta: { target: ['email'] },
      }) as unknown as Prisma.PrismaClientKnownRequestError;
      filter.catch(prismaError, host as never);
      const body = mockRes.body as { errors: ApiFieldError[] };
      expect(body.errors[0].field).toBe('email');
    });

    it('maps PrismaClientInitializationError to 503/DB_CONNECTION_ERROR', () => {
      const { host, mockRes } = createMockHost();
      const error = new Prisma.PrismaClientInitializationError('Connection failed', '7.0.0');
      filter.catch(error, host as never);
      expect(mockRes.statusCode).toBe(503);
      expect(mockRes.body['code']).toBe(AppErrorCodes.DB_CONNECTION_ERROR);
    });
  });

  describe('generic Error mapping', () => {
    it('maps generic Error to 500/INTERNAL_SERVER_ERROR', () => {
      const { host, mockRes } = createMockHost();
      filter.catch(new Error('Something went wrong'), host as never);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body['code']).toBe(AppErrorCodes.INTERNAL_SERVER_ERROR);
    });

    it('maps unknown thrown value to 500/INTERNAL_SERVER_ERROR', () => {
      const { host, mockRes } = createMockHost();
      filter.catch('not an Error object', host as never);
      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body['code']).toBe(AppErrorCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe('meta fields', () => {
    it('includes requestId, timestamp, path, method in error meta', () => {
      const { host, mockRes } = createMockHost('req-xyz', '/auth/login', 'POST');
      filter.catch(new Error('test'), host as never);
      const meta = mockRes.body['meta'] as Record<string, unknown>;
      expect(meta['requestId']).toBe('req-xyz');
      expect(meta['path']).toBe('/auth/login');
      expect(meta['method']).toBe('POST');
      expect(meta['timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('request observability attachment', () => {
    it('attaches errorCode to req.observability on BadRequestException', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new BadRequestException('Bad input'), host as never);
      expect(mockReq['observability']).toEqual({
        errorCode: AppErrorCodes.BAD_REQUEST,
        errorMessage: 'Bad input',
      });
    });

    it('attaches errorCode to req.observability on UnauthorizedException', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new UnauthorizedException('Not authenticated'), host as never);
      expect(mockReq['observability']).toEqual({
        errorCode: AppErrorCodes.AUTH_UNAUTHORIZED,
        errorMessage: 'Not authenticated',
      });
    });

    it('attaches errorCode to req.observability on NotFoundException', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new NotFoundException('Resource not found'), host as never);
      expect(mockReq['observability']).toEqual({
        errorCode: AppErrorCodes.NOT_FOUND,
        errorMessage: 'Resource not found',
      });
    });

    it('attaches errorCode to req.observability on generic Error', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new Error('Something broke'), host as never);
      const obs = mockReq['observability'] as Record<string, unknown>;
      expect(obs).toBeDefined();
      expect(obs['errorCode']).toBe(AppErrorCodes.INTERNAL_SERVER_ERROR);
    });

    it('attaches errorCode to req.observability on unknown thrown value', () => {
      const { mockReq, host } = createMockHost();
      filter.catch('not an Error', host as never);
      const obs = mockReq['observability'] as Record<string, unknown>;
      expect(obs).toBeDefined();
      expect(obs['errorCode']).toBe(AppErrorCodes.INTERNAL_SERVER_ERROR);
    });

    it('observability does not include stack trace or raw exception', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new Error('password=secret'), host as never);
      const obs = mockReq['observability'] as Record<string, unknown>;
      expect(obs).not.toHaveProperty('stack');
      expect(obs).not.toHaveProperty('exception');
      expect(obs['errorMessage']).not.toContain('secret');
    });

    it('observability errorMessage is sanitized of sensitive patterns', () => {
      const { mockReq, host } = createMockHost();
      filter.catch(new BadRequestException('password=supersecret token=abc123'), host as never);
      const obs = mockReq['observability'] as Record<string, unknown>;
      expect(obs['errorMessage']).toBe('password: <redacted> token: <redacted>');
    });
  });
});