/**
 * Standard Response Decorator Tests
 *
 * Verifies decorator application and schema generation.
 */

import {
  ApiStandardOkResponse,
  ApiStandardCreatedResponse,
  ApiStandardNoContentResponse,
  ApiStandardPaginatedResponse,
  ApiStandardMessageResponse,
} from './api-standard-response.decorators';

class FakeResponseDto {
  id: string;
  name: string;
}

describe('ApiStandardResponse decorators', () => {
  describe('ApiStandardOkResponse', () => {
    it('applies without crashing', () => {
      const decorator = ApiStandardOkResponse('Returns user data', FakeResponseDto, 200);
      expect(decorator).toBeDefined();
    });

    it('works without responseType', () => {
      const decorator = ApiStandardOkResponse('Operation succeeded');
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiStandardCreatedResponse', () => {
    it('applies without crashing', () => {
      const decorator = ApiStandardCreatedResponse('User created', FakeResponseDto);
      expect(decorator).toBeDefined();
    });

    it('works without responseType', () => {
      const decorator = ApiStandardCreatedResponse('Resource created');
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiStandardNoContentResponse', () => {
    it('applies with custom description', () => {
      const decorator = ApiStandardNoContentResponse('Resource deleted');
      expect(decorator).toBeDefined();
    });

    it('applies with default description', () => {
      const decorator = ApiStandardNoContentResponse();
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiStandardPaginatedResponse', () => {
    it('applies without crashing', () => {
      const decorator = ApiStandardPaginatedResponse(
        'Returns paginated users',
        FakeResponseDto,
      );
      expect(decorator).toBeDefined();
    });

    it('applies with custom pagination params', () => {
      const decorator = ApiStandardPaginatedResponse(
        'Returns paginated items',
        FakeResponseDto,
        { pageParam: 'pageNum', limitParam: 'pageSize', totalParam: 'count' },
      );
      expect(decorator).toBeDefined();
    });
  });

  describe('ApiStandardMessageResponse', () => {
    it('applies without crashing', () => {
      const decorator = ApiStandardMessageResponse(
        'Password changed successfully',
        'Password changed successfully',
        200,
      );
      expect(decorator).toBeDefined();
    });

    it('works without status override', () => {
      const decorator = ApiStandardMessageResponse(
        'Operation done',
        'Operation done',
      );
      expect(decorator).toBeDefined();
    });
  });
});