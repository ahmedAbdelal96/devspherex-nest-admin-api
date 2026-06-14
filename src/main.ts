import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/errors/app-exception.filter';
import { ApiResponseInterceptor } from './common/api-response/api-response.interceptor';
import { requestIdMiddleware } from './common/request-context/request-id.middleware';
import { setupSwagger } from './common/swagger/swagger.config';
import { LoggingService, setupGlobalExceptionHandlers } from './common/logging';

async function bootstrap() {
  // Set up global exception/rejection handlers before creating the app
  setupGlobalExceptionHandlers();

  const app = await NestFactory.create(AppModule);

  // Replace Nest's default logger with Winston-based LoggingService
  const loggingService = app.get(LoggingService);
  app.useLogger(loggingService);

  const logger = loggingService;

  // Request ID middleware — must run before any handler
  app.use(requestIdMiddleware);

  // Global validation pipe — safe defaults
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          errors,
        }),
    }),
  );

  // Global exception filter — needs LoggingService injected
  app.useGlobalFilters(new GlobalExceptionFilter(loggingService));

  // Global response interceptor
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // Enable CORS
  app.enableCors();

  // Swagger / OpenAPI documentation — environment-aware (SWAGGER_ENABLED=true)
  setupSwagger(app);

  // Get config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;
  const env = configService.get<string>('app.env') || 'development';

  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📖 Environment: ${env}`);
}

bootstrap();