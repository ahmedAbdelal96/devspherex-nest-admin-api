/**
 * API Request Observability — Integration-Style Test
 *
 * Verifies the interceptor chain works correctly in a minimal NestJS app
 * without requiring a real database connection.
 *
 * Tests:
 * - requestId is captured and passed through
 * - errorCode from exception filter is captured in observability
 * - skipped paths are not logged
 * - Phase 6 response contract is preserved
 */

import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../../common/errors/app-exception.filter';
import { ApiResponseInterceptor } from '../../../common/api-response/api-response.interceptor';
import { requestIdMiddleware } from '../../../common/request-context/request-id.middleware';
import { REQUEST_ID_HEADER } from '../../../common/request-context/request-id.util';
import { ApiRequestObservabilityInterceptor } from './api-request-observability.interceptor';
import * as request from 'supertest';

// Test module with a simple controller
@Controller('test')
class TestController {
  @Get('ok')
  ok() {
    return { data: 'ok' };
  }

  @Post('fail')
  @HttpCode(HttpStatus.BAD_REQUEST)
  fail() {
    throw new Error(' Deliberate test error ');
  }
}

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [TestController, HealthController],
})
class TestModule {}

describe('ApiRequestObservabilityInterceptor — Integration', () => {
  let mockLog: jest.Mock;
   
  let app: any;

  beforeAll(async () => {
    mockLog = jest.fn().mockResolvedValue(undefined);

    const testApp = await NestFactory.create(TestModule, { logger: false });

    testApp.use(requestIdMiddleware);
    testApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
    );
    testApp.useGlobalFilters(new GlobalExceptionFilter());
    testApp.useGlobalInterceptors(new ApiResponseInterceptor());
    testApp.useGlobalInterceptors(
      new ApiRequestObservabilityInterceptor({ log: mockLog } as never),
    );

    const server = await testApp.listen(0);
    app = server; // supertest uses the server
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    mockLog.mockClear();
  });

  describe('GET /test/ok', () => {
    it('produces one SUCCESS log', async () => {
      await request(app as never)
        .get('/test/ok')
        .set(REQUEST_ID_HEADER, 'req-ok-123')
        .expect(200);

      expect(mockLog).toHaveBeenCalledTimes(1);
      const call = mockLog.mock.calls[0][0];
      expect(call.outcome).toBe('SUCCESS');
      expect(call.statusCode).toBe(200);
      expect(call.requestId).toBe('req-ok-123');
      expect(call.method).toBe('GET');
      expect(call.path).toBe('/test/ok');
      expect(call.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('response follows Phase 6 standard ApiSuccessResponse shape', async () => {
      const res = await request(app as never)
        .get('/test/ok')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('requestId');
    });
  });

  describe('POST /test/fail', () => {
    it('produces one FAILURE log with errorCode from exception filter', async () => {
      await request(app as never)
        .post('/test/fail')
        .set(REQUEST_ID_HEADER, 'req-fail-456')
        .expect(500);

      expect(mockLog).toHaveBeenCalledTimes(1);
      const call = mockLog.mock.calls[0][0];
      expect(call.outcome).toBe('FAILURE');
      expect(call.statusCode).toBe(500);
      expect(call.requestId).toBe('req-fail-456');
      expect(call.errorCode).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('GET /health (skipped path)', () => {
    it('produces no request log for /health', async () => {
      // /health is skipped via shouldSkipLog (SKIPPED_PATTERNS = ['/health', '/favicon', '/static'])
      // We create a dedicated health endpoint
      await request(app as never)
        .get('/health')
        .set(REQUEST_ID_HEADER, 'req-health-789')
        .expect(200);

      expect(mockLog).not.toHaveBeenCalled();
    });
  });

  describe('requestId correlation', () => {
    it('uses requestId from x-request-id header', async () => {
      await request(app as never)
        .get('/test/ok')
        .set(REQUEST_ID_HEADER, 'custom-req-id')
        .expect(200);

      expect(mockLog.mock.calls[0][0].requestId).toBe('custom-req-id');
    });

    it('generates requestId when not provided', async () => {
      await request(app as never).get('/test/ok').expect(200);

      expect(mockLog).toHaveBeenCalledTimes(1);
      const call = mockLog.mock.calls[0][0];
      expect(call.requestId).toBeDefined();
      expect(call.requestId).toMatch(/^[a-f0-9]{32}$/);
    });
  });
});