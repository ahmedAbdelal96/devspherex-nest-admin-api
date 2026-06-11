/**
 * Swagger / OpenAPI Configuration
 *
 * Environment-aware: only enabled when SWAGGER_ENABLED=true.
 * Sets up Swagger UI at /docs and OpenAPI JSON at /docs-json.
 */

import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_CONFIG = {
  title: 'DevSphereX Admin API',
  description: `
DevSphereX NestJS Admin API — production-grade REST API with JWT authentication,
role-based access control (RBAC), audit logging, and request observability.

## Response Contract

All successful responses follow the \`ApiSuccessResponse<T>\` shape:
\`\`\`json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "requestId": "abc123",
    "timestamp": "2026-06-10T12:00:00.000Z",
    "path": "/users",
    "method": "GET"
  }
}
\`\`\`

All error responses follow the \`ApiErrorResponse\` shape:
\`\`\`json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_FAILED",
  "statusCode": 400,
  "errors": [{ "field": "email", "message": "Invalid email format", "code": "VALIDATION_FIELD_INVALID" }],
  "meta": { "requestId": "abc123", "timestamp": "...", "path": "/users", "method": "POST" }
}
\`\`\`

## Authentication

Protected endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

Public endpoints (login, register, etc.) do not require authentication.

## Rate Limiting

Rate-limited endpoints return 429 with code \`RATE_LIMITED\` when quota is exceeded.
`,
  version: '1.0.0',
  contact: {
    name: 'DevSphereX Support',
    url: 'https://devspherex.example.com',
  },
  bearerConfig: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Enter your access token (from /auth/login or /auth/refresh)',
  },
  tags: [
    { name: 'Auth', description: 'Authentication & authorization' },
    { name: 'Users', description: 'User management' },
    { name: 'Roles', description: 'Role management' },
    { name: 'Permissions', description: 'Permission management' },
    { name: 'Audit Logs', description: 'Security audit trail' },
    { name: 'API Request Logs', description: 'Request observability' },
  ],
} as const;

export function setupSwagger(app: INestApplication): void {
  const swaggerEnabled = process.env['SWAGGER_ENABLED'] === 'true';

  if (!swaggerEnabled) {
    Logger.warn(
      'Swagger disabled — set SWAGGER_ENABLED=true to enable /docs',
      'SwaggerModule',
    );
    return;
  }

  const logger = new Logger('SwaggerModule');

  const config = new DocumentBuilder()
    .setTitle(SWAGGER_CONFIG.title)
    .setDescription(SWAGGER_CONFIG.description)
    .setVersion(SWAGGER_CONFIG.version)
    .addBearerAuth(
      { type: SWAGGER_CONFIG.bearerConfig.type, scheme: SWAGGER_CONFIG.bearerConfig.scheme, bearerFormat: SWAGGER_CONFIG.bearerConfig.bearerFormat, description: 'Enter your access token (from /auth/login or /auth/refresh)' },
      'Bearer',
    )
    .addTag('Auth', SWAGGER_CONFIG.tags.find(t => t.name === 'Auth')!.description)
    .addTag('Users', SWAGGER_CONFIG.tags.find(t => t.name === 'Users')!.description)
    .addTag('Roles', SWAGGER_CONFIG.tags.find(t => t.name === 'Roles')!.description)
    .addTag('Permissions', SWAGGER_CONFIG.tags.find(t => t.name === 'Permissions')!.description)
    .addTag('Audit Logs', SWAGGER_CONFIG.tags.find(t => t.name === 'Audit Logs')!.description)
    .addTag('API Request Logs', SWAGGER_CONFIG.tags.find(t => t.name === 'API Request Logs')!.description);

  const document = SwaggerModule.createDocument(app, config.build(), {
    extraModels: [],
  });

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      doc: 'docs',
    },
    customSiteTitle: 'DevSphereX Admin API — Swagger',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .opblock-tag { font-size: 18px; font-weight: 600; }
    `,
  });

  logger.log('📖 Swagger UI available at /docs');
  logger.log('📄 OpenAPI JSON available at /docs-json');
}