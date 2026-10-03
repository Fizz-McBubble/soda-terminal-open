import { reviewedPlanningConditionSemanticsIdentity32 } from './reviewedPlanningConditionSemanticsIdentity32'
import { reviewedWEngineReceiverSemantics32Identity } from './reviewedWEngineReceiverSemanticsIdentity32'
import { reviewedRoxyAttributeWindowsIdentity32 } from './reviewedRoxyAttributeWindowsIdentity32'
import { reviewedDriveDiscSemanticsIdentity32 } from './reviewedDriveDiscSemanticsIdentity32'
import { reviewedRoxyPreparedTriggersIdentity32 } from './reviewedRoxyPreparedTriggersIdentity32'
/** Lightweight identities for saved-result invalidation; no expression runtime imports. */
export const commonAnomalyEffectIdentity32 = Object.freeze({
  revision: 'explicit-common-windswept-single-instance-r1',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/formula/src/data/common/anomaly.ts',
  sha256: 'B4FD12623C89A981F1BE1EA3134C01DB0C56FF5A4063CD82EAB0B5B2E6BC2ED8',
  locator: 'windswept_direct_dmg_',
})

export const reviewedRoxyEnergyConversionIdentity32 = Object.freeze({
  revision: 'roxy-named-er-step-division-explicit-core1-overlay-r2',
  commit: commonAnomalyEffectIdentity32.commit,
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Roxy.ts',
  formulaSha256: 'DFB173A363EFD3D9384AB3D53C543824B2B420ED14C67FD3039DC5F3C022D27D',
  localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Roxy_gen.json',
  localizationSha256: '2479FD13C7812CBCE726361C41322997758236DC237665B3410CE2A820CC67BD',
  unitEvidence:
    'each 0.01 initial Energy Regen above 1.2 grants 5 ATK and 0.4 Impact; retain source core caps',
  corroboration: 'https://www.prydwen.gg/zenless/characters/roxy',
  expressionHashes: {
    core_atk: '97ADC652EA4351CA094DDF1753E4F28ED9D1F3600943DFC77E7BA512C84704CF',
    core_impact: 'FAF5D7448143F290ABDE53D0721E03C43634FA9C02843EDF36AD90E5B84008CF',
  },
})

export const reviewedClaretIntrinsicActionIdentity32 = Object.freeze({
  revision: 'claret-two-effects-exact-intrinsic-action-or-r1',
  commit: commonAnomalyEffectIdentity32.commit,
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Claret.ts',
  formulaSha256: 'BDF57EEC001BFA499D2C08BDB8E5004469EAE22E411D9EAFE4F614E3C55F5AF3',
  localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Claret_gen.json',
  localizationSha256: '9EBB0A9057D9B797C89E62B78636413730D1628688D028A2F641287BE8B17C3F',
  expressionHashes: {
    'agent-claret:core_crit_': 'CE99ED3F2C54F52B05A91548661E4BD234475ED157DCFB20024E69129600184E',
    'agent-claret:m2_electric_resIgn_':
      '438058F99D6C7EF3F354040E842CCF6A9B9528379C286686A535FE90441713EB',
  },
})

export const planningEffectResolutionIdentity32 = Object.freeze({
  revision: 'same-event-final-stat-dag-roxy-prepared-mindscapes-stun-r9',
  roxyPrepared: reviewedRoxyPreparedTriggersIdentity32,
  common: commonAnomalyEffectIdentity32,
  coefficientUnits: sourceEventQuantityIdentity32,
  roxy: reviewedRoxyEnergyConversionIdentity32,
  claret: reviewedClaretIntrinsicActionIdentity32,
  conditionSemantics: reviewedPlanningConditionSemanticsIdentity32,
  wEngineRecipients: reviewedWEngineReceiverSemantics32Identity,
  roxyWindows: reviewedRoxyAttributeWindowsIdentity32,
  driveDiscs: reviewedDriveDiscSemanticsIdentity32,
})
import { sourceEventQuantityIdentity32 } from './sourceEventQuantity32'
