import { stableContentHash } from '../gameDataPacks/types'
import { commonAnomalySettlementHash32 } from './currentCommonAnomalySettlementIdentity32'

export const planningAnomalyLifecycleIdentity32 = Object.freeze({
  revision: 'accepted-anomaly-start-to-one-bound-event-r1',
  settlement: commonAnomalySettlementHash32,
  clock: 'event.atSeconds - accepted application.atSeconds; no rounding or inferred duration',
  interval: 'start inclusive, end exclusive; explicit end terminates the named state',
  scope: 'one declared accepted anomaly state, no buildup threshold or automatic rotation',
  inactiveEffects:
    'expired physical state closes Alice Disorder; a non-trigger closes Yanagi polarity-only branches',
  alice: {
    formulaSha256: '8387F008FE972025AC5FAE619EBD40F8971119568C4DEA0048D798E0241F82E5',
    localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Alice_gen.json',
    localizationSha256: '2FE510E8A460864BF870630BA09D497608E15AE8E584793F4AA7194C70F27943',
    locator: '/core/desc/6/0',
    originalAttribute: 'physical',
  },
  yanagi: {
    formulaSha256: '5FFF32C390B426C1CAFF95FDD0EE6C744EF8D2FDCBD3A7F24D378C2EDEB921A2',
    localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Yanagi_gen.json',
    localizationSha256: 'ED6A2A4F0EB9220CC3A80054EEBCA72CBF2FCD265AFAE93BF95C5EAAF0A52B02',
    locator: '/special/EXSpecialAttackGekkaRuten/desc/3',
    triggerEventId: 'special.EXSpecialAttackGekkaRuten.hit-1',
    unresolvedUltimateEventId: 'chain.UltimateRaieiTenge.hit-0',
    unresolvedThrustEventId: 'special.EXSpecialAttackGekkaRuten.hit-0',
    polarityCondition: 1,
    consumesOriginalAnomaly: false,
  },
})
export const planningAnomalyLifecycleHash32 = stableContentHash(planningAnomalyLifecycleIdentity32)

/** Read only flags produced after validating a supplied lifecycle declaration.
 * Missing state never proves inactivity. */
export function planningAnomalyLifecycleEffectInactive32(
  effectKey: string,
  references: Readonly<Record<string, unknown>>,
) {
  if (!Object.hasOwn(references, 'anomalyLifecycle32')) return false
  if (effectKey === 'agent-alice:core_addl_disorder_')
    return references.anomalyStateActive32 === false
  return (
    /^agent-yanagi:(?:exSpecial|ult)_anom_(?:base_|flat_dmg)$/.test(effectKey) &&
    references.yanagiPolarityTrigger32 === false
  )
}
