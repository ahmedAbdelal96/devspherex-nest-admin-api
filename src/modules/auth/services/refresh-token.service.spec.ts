/**
 * RefreshTokenService — Unit Tests
 *
 * Tests token generation, hashing, and verification.
 */

import { RefreshTokenService } from './refresh-token.service';
import { createMockConfigService } from '../../../test-utils/mocks';

function buildService(configOverrides: Record<string, unknown> = {}) {
  return new RefreshTokenService(createMockConfigService({
    'jwt.refreshExpiresIn': '7d',
    ...configOverrides,
  }) as never);
}

describe('RefreshTokenService', () => {
  describe('generateRefreshTokenPayloadAsync', () => {
    it('returns rawToken, jti, familyId, tokenHash, and expiresAt', async () => {
      const svc = buildService();
      const result = await svc.generateRefreshTokenPayloadAsync();
      expect(result.rawToken).toBeDefined();
      expect(result.jti).toBeDefined();
      expect(result.familyId).toBeDefined();
      expect(result.tokenHash).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('rawToken format is jti.secret', async () => {
      const svc = buildService();
      const result = await svc.generateRefreshTokenPayloadAsync();
      const [jti, secret] = result.rawToken.split('.');
      expect(result.jti).toBe(jti);
      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('tokenHash is not the raw token', async () => {
      const svc = buildService();
      const result = await svc.generateRefreshTokenPayloadAsync();
      expect(result.tokenHash).not.toBe(result.rawToken);
      // bcrypt hashes are base64-ish and don't look like a JWT dot-token
      expect(result.tokenHash).not.toMatch(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
    });
  });

  describe('extractJti', () => {
    it('extracts jti from valid token', () => {
      const svc = buildService();
      expect(svc.extractJti('abc-uuid.secret-hex')).toBe('abc-uuid');
    });

    it('returns null for invalid format', () => {
      const svc = buildService();
      expect(svc.extractJti('no-dot-here')).toBeNull();
      expect(svc.extractJti('')).toBeNull();
    });
  });

  describe('verifyRefreshTokenAsync', () => {
    it('returns true for matching token and hash', async () => {
      const svc = buildService();
      const { rawToken, tokenHash } = await svc.generateRefreshTokenPayloadAsync();
      const result = await svc.verifyRefreshTokenAsync(rawToken, tokenHash);
      expect(result).toBe(true);
    });

    it('returns false for wrong token', async () => {
      const svc = buildService();
      const { tokenHash } = await svc.generateRefreshTokenPayloadAsync();
      const result = await svc.verifyRefreshTokenAsync('wrong.token.here', tokenHash);
      expect(result).toBe(false);
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('parses 7d correctly', () => {
      const svc = buildService({ 'jwt.refreshExpiresIn': '7d' });
      const now = Date.now();
      const expiry = svc.getRefreshTokenExpiry();
      const diffMs = expiry.getTime() - now;
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });

    it('parses 1h correctly', () => {
      const svc = buildService({ 'jwt.refreshExpiresIn': '1h' });
      const now = Date.now();
      const expiry = svc.getRefreshTokenExpiry();
      const diffMs = expiry.getTime() - now;
      const diffHours = diffMs / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThan(0.99);
      expect(diffHours).toBeLessThan(1.01);
    });

    it('falls back to 7 days for invalid format', () => {
      const svc = buildService({ 'jwt.refreshExpiresIn': 'invalid' });
      const now = Date.now();
      const expiry = svc.getRefreshTokenExpiry();
      const diffMs = expiry.getTime() - now;
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });
  });
});
