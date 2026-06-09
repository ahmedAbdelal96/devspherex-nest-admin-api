/**
 * Password Recovery Channel Readiness
 *
 * Pure, side-effect-free readiness registry for password-recovery
 * delivery channels. This file deliberately has NO NestJS DI
 * decorators and NO imports from `@nestjs/*` or from any
 * `@Injectable()` service. It exists as the single source of
 * truth for "is channel X implemented?" and "is channel X safe
 * to use in production?".
 *
 * ------------------------------------------------------------------------
 * Why a pure file (and not methods on PasswordRecoveryChannelService)?
 * ------------------------------------------------------------------------
 * Phase 4-R4 originally placed the readiness predicates on
 * `PasswordRecoveryChannelService`:
 *
 *   - isChannelImplemented(channel)
 *   - isChannelProductionReady(channel)
 *
 * `PasswordRecoveryConfig` then injected the service to call those
 * predicates in its production-safety boot guard.
 *
 * That created a circular dependency:
 *
 *   PasswordRecoveryConfig --> PasswordRecoveryChannelService
 *                                          |
 *                                          v
 *                              PasswordRecoveryConfig
 *
 * TypeScript compiles this fine (the type is available at module
 * load time), but NestJS may fail or behave unpredictably at
 * runtime when resolving the dependency graph, because the
 * `PasswordRecoveryConfig` constructor is invoked during module
 * construction to validate env, and the channel service cannot
 * be constructed until the config is constructed.
 *
 * Phase 4-R4-R1 moves the readiness logic out of the DI graph
 * entirely. Both `PasswordRecoveryConfig` and
 * `PasswordRecoveryChannelService` call into the pure functions
 * here, but neither depends on the other for readiness checks.
 *
 * ------------------------------------------------------------------------
 * Adding a real provider in a future phase
 * ------------------------------------------------------------------------
 * To mark a new channel as implemented / production-ready, update
 * the `READINESS` table below. No DI changes are required.
 *
 * To add a new channel that does not exist yet, also extend
 * `PASSWORD_RECOVERY_CHANNELS` in `password-recovery.types.ts`,
 * add a case in the `resolveChannel` switch in
 * `PasswordRecoveryChannelService`, register the provider in
 * `PasswordRecoveryModule`, and add a row to `READINESS` here.
 */

import {
  PASSWORD_RECOVERY_CHANNELS,
  PasswordRecoveryChannel,
} from './password-recovery.types';

/**
 * Per-channel readiness record. The `reason` string is included
 * in boot-guard error messages so operators see exactly why a
 * channel was refused.
 */
export interface PasswordRecoveryChannelReadiness {
  implemented: boolean;
  productionReady: boolean;
  reason: string;
}

/**
 * The single source of truth for channel readiness.
 *
 *   - implemented: a real `PasswordRecoveryChannelProvider` is
 *     registered in this build and `resolveChannel` returns it.
 *   - productionReady: the registered provider is safe to use in
 *     a live deployment that needs to actually deliver OTPs to
 *     real users.
 *
 * Phase 4-R4-R1 baseline: NO channel is production-ready. A real
 * vendor integration must be implemented before any channel can
 * flip to `productionReady: true`.
 */
const READINESS: Record<
  PasswordRecoveryChannel,
  PasswordRecoveryChannelReadiness
> = {
  [PASSWORD_RECOVERY_CHANNELS.NOOP]: {
    implemented: true,
    productionReady: false,
    reason: 'NOOP discards delivery and is dev/test only',
  },
  [PASSWORD_RECOVERY_CHANNELS.CONSOLE]: {
    implemented: true,
    productionReady: false,
    reason: 'CONSOLE logs OTPs and is dev/test only',
  },
  [PASSWORD_RECOVERY_CHANNELS.EMAIL]: {
    implemented: false,
    productionReady: false,
    reason: 'EMAIL provider is not implemented in this starter',
  },
  [PASSWORD_RECOVERY_CHANNELS.WHATSAPP]: {
    implemented: false,
    productionReady: false,
    reason: 'WHATSAPP provider is not implemented in this starter',
  },
  [PASSWORD_RECOVERY_CHANNELS.SMS]: {
    implemented: false,
    productionReady: false,
    reason: 'SMS provider is not implemented in this starter',
  },
};

/**
 * Returns true when the channel has a registered
 * `PasswordRecoveryChannelProvider` in this build.
 */
export function isPasswordRecoveryChannelImplemented(
  channel: PasswordRecoveryChannel,
): boolean {
  return READINESS[channel]?.implemented ?? false;
}

/**
 * Returns true when the channel is safe to use in a live
 * deployment that needs to deliver OTPs to real users.
 */
export function isPasswordRecoveryChannelProductionReady(
  channel: PasswordRecoveryChannel,
): boolean {
  return READINESS[channel]?.productionReady ?? false;
}

/**
 * Returns the full readiness record for the given channel. The
 * `reason` string is used in boot-guard error messages.
 */
export function getPasswordRecoveryChannelReadiness(
  channel: PasswordRecoveryChannel,
): PasswordRecoveryChannelReadiness {
  return (
    READINESS[channel] ?? {
      implemented: false,
      productionReady: false,
      reason: `Unknown password recovery channel: ${String(channel)}`,
    }
  );
}
