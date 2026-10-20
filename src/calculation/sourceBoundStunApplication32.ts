import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'

/** MIT upstream expression and exact current localization agree that this
 * source's Stun DMG Multiplier also applies outside stun. Other providers keep
 * their existing stun-only boundary. This qualifies an already produced effect;
 * it does not produce the Aftershock-hit condition or infer its five-second uptime. */
export const sourceBoundStunApplicationPolicy32 = {
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaSha256: 'C24093AAEF041B0CA582F19729665387060E64C6CDDC9DAF7B338DA37075B0A6',
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Trigger.ts',
  path: 'libs/zzz/dm-localization/assets/locales/en/char_Trigger_gen.json',
  sha256: '7f2afba79c80a441dd59427e40c6b1c2a7365dfeccabfe97be4f6e5d6b52c03e',
  locators: ['/core/desc/6', '/mindscapes/1/desc'],
  effectKeys: ['agent-trigger:core_stun_', 'agent-trigger:m1_stun_'],
  scope: 'source-conditional additive enemy Core debuff; Aftershock is its activation condition',
} as const
export const sourceBoundStunApplicationIdentity32 = stableContentHash(
  sourceBoundStunApplicationPolicy32,
)

export function classifySourceBoundStunApplication32(
  effect: { providerAgentId: string; effectKey: string },
  source: { commit: string; formulaSha256: string } | undefined,
): boolean | null {
  if (
    effect.providerAgentId !== 'agent-trigger' ||
    !sourceBoundStunApplicationPolicy32.effectKeys.some((key) => key === effect.effectKey)
  )
    return false
  return source?.commit === sourceBoundStunApplicationPolicy32.commit &&
    source.formulaSha256 === sourceBoundStunApplicationPolicy32.formulaSha256
    ? true
    : null
}

/** Null is an unreviewed changed source, never a proven inactive effect. */
export function sourceStunAppliesOutsideStun32(effect: {
  providerAgentId: string
  effectKey: string
}) {
  return classifySourceBoundStunApplication32(
    effect,
    getCurrentAgentEventContract(effect.providerAgentId)?.source,
  )
}
