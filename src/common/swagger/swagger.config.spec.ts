/**
 * Swagger Configuration Tests
 *
 * Verifies environment-aware Swagger setup behavior.
 */

import { INestApplication, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger.config';

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: jest.fn().mockReturnValue({ info: { title: 'Test' } }),
      setup: jest.fn(),
    },
    DocumentBuilder: jest.fn().mockImplementation(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setVersion: jest.fn().mockReturnThis(),
      addBearerAuth: jest.fn().mockReturnThis(),
      addTag: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ info: { title: 'Test' } }),
    })),
  };
});

describe('setupSwagger', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when SWAGGER_ENABLED is not true', () => {
    delete process.env['SWAGGER_ENABLED'];
    const app = { use: jest.fn() } as unknown as INestApplication;
    setupSwagger(app as INestApplication);
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('sets up Swagger when SWAGGER_ENABLED=true', () => {
    process.env['SWAGGER_ENABLED'] = 'true';
    const app = { use: jest.fn() } as unknown as INestApplication;
    setupSwagger(app as INestApplication);
    expect(SwaggerModule.createDocument).toHaveBeenCalled();
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'docs',
      app,
      expect.any(Object),
      expect.objectContaining({
        swaggerOptions: expect.objectContaining({ persistAuthorization: true }),
      }),
    );
  });
});