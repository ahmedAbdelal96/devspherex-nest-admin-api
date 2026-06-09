/**
 * Request ID Utility — Unit Tests
 */

import { getOrCreateRequestId, generateRequestId, REQUEST_ID_HEADER } from './request-id.util';

describe('requestId util', () => {
  describe('generateRequestId', () => {
    it('generates a 32-char hex string', () => {
      const id = generateRequestId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[a-f0-9]+$/);
    });

    it('generates unique values', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getOrCreateRequestId', () => {
    it('uses x-request-id header when present and valid', () => {
      const headers = { [REQUEST_ID_HEADER]: 'valid-request-id-123' };
      expect(getOrCreateRequestId(headers)).toBe('valid-request-id-123');
    });

    it('uses first value when x-request-id is an array', () => {
      const headers = { [REQUEST_ID_HEADER]: ['req-abc', 'req-def'] };
      expect(getOrCreateRequestId(headers)).toBe('req-abc');
    });

    it('generates new ID when x-request-id is missing', () => {
      const headers = {};
      const id = getOrCreateRequestId(headers);
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[a-f0-9]+$/);
    });

    it('generates new ID when x-request-id is empty string', () => {
      const headers = { [REQUEST_ID_HEADER]: '' };
      const id = getOrCreateRequestId(headers);
      expect(id).toHaveLength(32);
    });

    it('generates new ID when x-request-id exceeds max length', () => {
      const headers = { [REQUEST_ID_HEADER]: 'a'.repeat(65) };
      const id = getOrCreateRequestId(headers);
      expect(id).toHaveLength(32);
    });

    it('generates new ID when x-request-id contains invalid chars', () => {
      const headers = { [REQUEST_ID_HEADER]: 'req with spaces!' };
      const id = getOrCreateRequestId(headers);
      expect(id).toHaveLength(32);
    });
  });
});
