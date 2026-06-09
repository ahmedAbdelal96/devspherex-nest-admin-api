/**
 * Password Recovery Channel Readiness — Unit Tests
 *
 * Tests the pure readiness registry functions in password-recovery-channel-readiness.ts.
 * No NestJS DI, no database.
 */

import {
  isPasswordRecoveryChannelImplemented,
  isPasswordRecoveryChannelProductionReady,
  getPasswordRecoveryChannelReadiness,
} from './password-recovery-channel-readiness';
import { PASSWORD_RECOVERY_CHANNELS } from './password-recovery.types';

describe('PasswordRecoveryChannelReadiness', () => {
  describe('isPasswordRecoveryChannelImplemented', () => {
    it('NOOP is implemented', () => {
      expect(isPasswordRecoveryChannelImplemented(PASSWORD_RECOVERY_CHANNELS.NOOP)).toBe(true);
    });

    it('CONSOLE is implemented', () => {
      expect(isPasswordRecoveryChannelImplemented(PASSWORD_RECOVERY_CHANNELS.CONSOLE)).toBe(true);
    });

    it('EMAIL is NOT implemented', () => {
      expect(isPasswordRecoveryChannelImplemented(PASSWORD_RECOVERY_CHANNELS.EMAIL)).toBe(false);
    });

    it('WHATSAPP is NOT implemented', () => {
      expect(isPasswordRecoveryChannelImplemented(PASSWORD_RECOVERY_CHANNELS.WHATSAPP)).toBe(false);
    });

    it('SMS is NOT implemented', () => {
      expect(isPasswordRecoveryChannelImplemented(PASSWORD_RECOVERY_CHANNELS.SMS)).toBe(false);
    });

    it('unknown channel returns false', () => {
      expect(isPasswordRecoveryChannelImplemented('UNKNOWN' as never)).toBe(false);
    });
  });

  describe('isPasswordRecoveryChannelProductionReady', () => {
    it('NOOP is NOT production-ready', () => {
      expect(isPasswordRecoveryChannelProductionReady(PASSWORD_RECOVERY_CHANNELS.NOOP)).toBe(false);
    });

    it('CONSOLE is NOT production-ready', () => {
      expect(isPasswordRecoveryChannelProductionReady(PASSWORD_RECOVERY_CHANNELS.CONSOLE)).toBe(false);
    });

    it('EMAIL is NOT production-ready', () => {
      expect(isPasswordRecoveryChannelProductionReady(PASSWORD_RECOVERY_CHANNELS.EMAIL)).toBe(false);
    });

    it('WHATSAPP is NOT production-ready', () => {
      expect(isPasswordRecoveryChannelProductionReady(PASSWORD_RECOVERY_CHANNELS.WHATSAPP)).toBe(false);
    });

    it('SMS is NOT production-ready', () => {
      expect(isPasswordRecoveryChannelProductionReady(PASSWORD_RECOVERY_CHANNELS.SMS)).toBe(false);
    });

    it('unknown channel returns false', () => {
      expect(isPasswordRecoveryChannelProductionReady('UNKNOWN' as never)).toBe(false);
    });
  });

  describe('getPasswordRecoveryChannelReadiness', () => {
    it('NOOP has correct readiness record', () => {
      const r = getPasswordRecoveryChannelReadiness(PASSWORD_RECOVERY_CHANNELS.NOOP);
      expect(r.implemented).toBe(true);
      expect(r.productionReady).toBe(false);
      expect(r.reason).toContain('NOOP');
    });

    it('CONSOLE has correct readiness record', () => {
      const r = getPasswordRecoveryChannelReadiness(PASSWORD_RECOVERY_CHANNELS.CONSOLE);
      expect(r.implemented).toBe(true);
      expect(r.productionReady).toBe(false);
      expect(r.reason).toContain('CONSOLE');
    });

    it('EMAIL has correct readiness record', () => {
      const r = getPasswordRecoveryChannelReadiness(PASSWORD_RECOVERY_CHANNELS.EMAIL);
      expect(r.implemented).toBe(false);
      expect(r.productionReady).toBe(false);
      expect(r.reason).toContain('not implemented');
    });

    it('WHATSAPP has correct readiness record', () => {
      const r = getPasswordRecoveryChannelReadiness(PASSWORD_RECOVERY_CHANNELS.WHATSAPP);
      expect(r.implemented).toBe(false);
      expect(r.productionReady).toBe(false);
    });

    it('SMS has correct readiness record', () => {
      const r = getPasswordRecoveryChannelReadiness(PASSWORD_RECOVERY_CHANNELS.SMS);
      expect(r.implemented).toBe(false);
      expect(r.productionReady).toBe(false);
    });

    it('unknown channel returns safe fallback', () => {
      const r = getPasswordRecoveryChannelReadiness('TURBO' as never);
      expect(r.implemented).toBe(false);
      expect(r.productionReady).toBe(false);
      expect(r.reason).toContain('Unknown');
    });
  });
});
