/**
 * Validation Error Integration Tests
 *
 * Uses supertest + a minimal NestJS app to verify:
 * - ValidationPipe exceptionFactory wiring produces VALIDATION_FAILED
 * - Field-level errors appear in errors[]
 * - Sensitive fields are sanitized
 * - requestId propagation
 * - No internal marker in JSON output
 * - Unexpected errors are safe in production
 */

import { NestFactory } from '@nestjs/core';
import { Module, Post, Body, Controller, HttpCode, HttpStatus } from '@nestjs/common';
import { ValidationPipe, BadRequestException, ValidationError } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import * as request from 'supertest';
import { GlobalExceptionFilter } from './app-exception.filter';
import { ApiResponseInterceptor } from '../api-response/api-response.interceptor';
import { requestIdMiddleware } from '../request-context/request-id.middleware';

// ─── Test DTOs ─────────────────────────────────────────────────────────────

class ProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'first name is required' })
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'last name is required' })
  lastName!: string;
}

class CredentialsDto {
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password!: string;
}

class TestValidationDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  age?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDto)
  profile?: ProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CredentialsDto)
  credentials?: CredentialsDto;
}

// ─── Test Controller & Module ───────────────────────────────────────────────

@Controller()
class TestController {
  @Post('test-validation')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() _dto: TestValidationDto) {
    return { id: 'created-1' };
  }

  @Post('test-throw-error')
  @HttpCode(HttpStatus.OK)
  throwError(@Body() _body: unknown) {
    throw new Error('boom password: secret token: abc123');
  }

  @Post('test-throw-string')
  @HttpCode(HttpStatus.OK)
  throwString(@Body() _body: unknown) {
    throw 'critical failure string';
  }
}

@Module({
  controllers: [TestController],
})
class TestModule {}

// ─── App factory ────────────────────────────────────────────────────────────

async function createTestApp() {
  const app = await NestFactory.create(TestModule);

  app.use(requestIdMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          errors,
        }),
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  return app;
}

async function createProductionApp() {
  process.env['NODE_ENV'] = 'production';
  const app = await NestFactory.create(TestModule);

  app.use(requestIdMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          errors,
        }),
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  await app.init();

  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Validation Error Integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Invalid DTO validation ─────────────────────────────────────────────

  describe('POST /test-validation — invalid DTO', () => {
    it('returns 400 with VALIDATION_FAILED code', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email', password: '123', extraField: 'should-be-rejected' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.body['success']).toBe(false);
          expect(res.body['code']).toBe('VALIDATION_FAILED');
          expect(res.body['statusCode']).toBe(400);
        });
    });

    it('includes field-level errors array', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email', password: '123' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body['errors'])).toBe(true);
          expect(res.body['errors'].length).toBeGreaterThan(0);
        });
    });

    it('includes email field error', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res: request.Response) => {
          const emailError = res.body['errors'].find(
            (e: { field: string }) => e['field'] === 'email',
          );
          expect(emailError).toBeDefined();
          expect(emailError['code']).toBe('VALIDATION_FIELD_INVALID');
        });
    });

    it('does NOT expose raw password value in validation errors', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email', password: 'SuperSecret123' })
        .expect(400)
        .expect((res: request.Response) => {
          const bodyStr = JSON.stringify(res.body);
          expect(bodyStr).not.toContain('SuperSecret123');
          expect(bodyStr).not.toContain('"password"');
        });
    });

    it('does NOT include extraField (forbidNonWhitelisted)', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'a@b.com', extraField: 'rejected' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.body['code']).toBe('VALIDATION_FAILED');
        });
    });

    it('includes meta.requestId', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.body['meta']['requestId']).toBeDefined();
          expect(typeof res.body['meta']['requestId']).toBe('string');
        });
    });
  });

  // ─── Request ID propagation ─────────────────────────────────────────────

  describe('x-request-id header propagation', () => {
    it('uses client-provided request ID', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .set('x-request-id', 'test-request-123')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.headers['x-request-id']).toBe('test-request-123');
          expect(res.body['meta']['requestId']).toBe('test-request-123');
        });
    });

    it('generates request ID when header missing', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.body['meta']['requestId']).toBeDefined();
          expect(res.body['meta']['requestId']).toMatch(/^[a-f0-9]{32}$/);
        });
    });

    it('response header x-request-id matches client value', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .set('x-request-id', 'my-custom-req-id')
        .send({ email: 'not-an-email' })
        .expect(400)
        .expect((res: request.Response) => {
          expect(res.headers['x-request-id']).toBe('my-custom-req-id');
        });
    });
  });

  // ─── Valid request ───────────────────────────────────────────────────────

  describe('POST /test-validation — valid DTO', () => {
    it('returns 201 with success envelope', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'valid@test.com', password: 'StrongPass123!' })
        .expect(HttpStatus.CREATED)
        .expect((res: request.Response) => {
          expect(res.body['success']).toBe(true);
          expect(res.body['data']).toBeDefined();
        });
    });

    it('does not include __api_response_wrapped__ in JSON', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'valid@test.com', password: 'StrongPass123!' })
        .expect(HttpStatus.CREATED)
        .expect((res: request.Response) => {
          const json = JSON.stringify(res.body);
          expect(json).not.toContain('__api_response_wrapped__');
          expect(Object.keys(res.body)).not.toContain('__api_response_wrapped__');
        });
    });

    it('includes meta.requestId in valid response', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'valid@test.com', password: 'StrongPass123!' })
        .expect(HttpStatus.CREATED)
        .expect((res: request.Response) => {
          expect(res.body['meta']['requestId']).toBeDefined();
        });
    });
  });

  // ─── Nested validation errors ────────────────────────────────────────────

  describe('POST /test-validation — nested validation', () => {
    it('returns dot-path fields for nested errors', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'a@b.com', profile: { firstName: '', lastName: '' } })
        .expect(400)
        .expect((res: request.Response) => {
          const fields = res.body['errors'].map((e: { field: string }) => e['field']);
          expect(fields).toContain('profile.firstName');
          expect(fields).toContain('profile.lastName');
        });
    });
  });

  // ─── Sensitive field sanitization ────────────────────────────────────────

  describe('POST /test-validation — sensitive field sanitization', () => {
    it('sanitizes credentials.password in nested errors', () => {
      return request(app.getHttpServer())
        .post('/test-validation')
        .send({ email: 'a@b.com', credentials: { password: '' } })
        .expect(400)
        .expect((res: request.Response) => {
          const fields = res.body['errors'].map((e: { field: string }) => e['field']);
          expect(fields).toContain('field');
          // The field path "credentials.password" is sanitized to "field".
          // The message may say "password is required" — that is the error description,
          // not the secret value. The actual value must not appear.
          const bodyStr = JSON.stringify(res.body);
          expect(bodyStr).not.toContain('secret123');
        });
    });
  });
});

// ─── Production error tests (separate app) ──────────────────────────────────

describe('Validation Error Integration — Production Mode', () => {
  let prodApp: Awaited<ReturnType<typeof createProductionApp>>;

  beforeAll(async () => {
    prodApp = await createProductionApp();
  });

  afterAll(async () => {
    await prodApp.close();
  });

  describe('POST /test-throw-error — generic Error with secrets', () => {
    it('returns 500 with safe message in production', () => {
      return request(prodApp.getHttpServer())
        .post('/test-throw-error')
        .send({})
        .expect(500)
        .expect((res: request.Response) => {
          expect(res.body['success']).toBe(false);
          expect(res.body['code']).toBe('INTERNAL_SERVER_ERROR');
          expect(res.body['statusCode']).toBe(500);
          expect(res.body['message']).toBe('An unexpected error occurred. Please try again later.');
          const bodyStr = JSON.stringify(res.body);
          expect(bodyStr).not.toContain('secret');
          expect(bodyStr).not.toContain('abc123');
          expect(bodyStr).not.toContain('password');
          expect(bodyStr).not.toContain('stack');
        });
    });
  });

  describe('POST /test-throw-string — string thrown value', () => {
    it('returns 500 with safe error response', () => {
      return request(prodApp.getHttpServer())
        .post('/test-throw-string')
        .send({})
        .expect(500)
        .expect((res: request.Response) => {
          expect(res.body['success']).toBe(false);
          expect(res.body['code']).toBe('INTERNAL_SERVER_ERROR');
          expect(res.body['message']).toBe('An unexpected error occurred. Please try again later.');
        });
    });
  });
});