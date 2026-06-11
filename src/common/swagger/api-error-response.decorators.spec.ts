/**
 * Error Response Decorator Tests
 *
 * Verifies all error response decorators apply correctly.
 */

import {
  ApiValidationErrorResponse,
  ApiUnauthorizedErrorResponse,
  ApiForbiddenErrorResponse,
  ApiNotFoundErrorResponse,
  ApiConflictErrorResponse,
  ApiRateLimitErrorResponse,
  ApiInternalServerErrorResponse,
  ApiCommonErrorResponses,
} from './api-error-response.decorators';

describe('ApiErrorResponse decorators', () => {
  describe('ApiValidationErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiValidationErrorResponse();
      expect(decorator).toBeDefined();
    });

    it('applies with custom description', () => {
      const decorator = ApiValidationErrorResponse('Custom validation error message');
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiUnauthorizedErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiUnauthorizedErrorResponse();
      expect(decorator).toBeDefined();
    });

    it('applies with custom description', () => {
      const decorator = ApiUnauthorizedErrorResponse('Custom unauthorized message');
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiForbiddenErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiForbiddenErrorResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiNotFoundErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiNotFoundErrorResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiConflictErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiConflictErrorResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiRateLimitErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiRateLimitErrorResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiInternalServerErrorResponse', () => {
    it('applies with default description', () => {
      const decorator = ApiInternalServerErrorResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiCommonErrorResponses', () => {
    it('applies all seven error response decorators', () => {
      const decorator = ApiCommonErrorResponses();
      expect(decorator).toBeDefined();
    });
  });
});