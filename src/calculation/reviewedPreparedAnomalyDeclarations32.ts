import { stableContentHash } from '../gameDataPacks/types'
import { graduationCandidateProfilesPart02 } from '../gameDataPacks/generated/graduationCandidateProfilesPart02'
import { graduationCandidateProfilesPart03 } from '../gameDataPacks/generated/graduationCandidateProfilesPart03'
import { commonAnomalySettlementHash32 } from './currentCommonAnomalySettlementIdentity32'
import { getReviewedPotentialDefinition } from '../gameDataPacks/reviewedPotentialDefinitions'

export type PreparedAnomalyPreparation32 =
  | {
      kind: 'jane_single_assault'
      acceptedSingleOwnerSettlement: true
      passion: boolean
      gnawed: boolean
      priorAssaultOrDisorderBuffActive: boolean
    }
  | { kind: 'piper_single_assault'; acceptedSingleOwnerSettlement: true; powerStacks: 0 }
  | {
      kind: 'alice_single_polarized_assault'
      acceptedSingleOwnerSettlement: true
      bladeEtiquette: 300
    }
  | {
      kind: 'promeia_single_self_ice_abloom'
      acceptedSingleOwnerSettlement: true
      trialByCold: 1
      ownIceAnomalyPresent: boolean
    }
  | {
      kind: 'aria_single_self_ether_abloom'
      acceptedSingleOwnerSettlement: true
      perfectPitchHit3Heavy: true
      ownEtherAnomalyPresent: boolean
      fandomPowerPrepared: boolean
      enemyStunned: boolean
      momentOfDelusion?: boolean
    }

export const sourceFormulaHashes = {
  'agent-jane': '95F6A36CB88F44EA406EF193DE3D0CF295498F693561D717A3B270D34D5F55E8',
  'agent-piper': '71601E28CB2202D7B95B9486C79B761AC0EA299605598896645B595FF50AFAC2',
  'agent-alice': '8387F008FE972025AC5FAE619EBD40F8971119568C4DEA0048D798E0241F82E5',
  'agent-promeia': '4BAA6F6B37A325AD72CBD628805F8BA55BB7AC3589E78BE8E28244826320FD66',
  'agent-aria': '3164FA902E16366CCDBBBF2F41660D77DA72168F95E618157B51CE2A28E3A7F3',
} as const
export const promeiaProfile = graduationCandidateProfilesPart02.find(
  (row) => row.agentId === 'agent-promeia',
)!
export const promeiaCoreFact = promeiaProfile.inputReferences.find((row) =>
  row.record_id.includes('core-levels'),
)!
export const promeiaCore = JSON.parse(String(promeiaCoreFact.value)) as {
  abloom_multiplier_by_tier: number[]
}
export const ariaProfile = graduationCandidateProfilesPart03.find(
  (row) => row.agentId === 'agent-aria',
)!
export const ariaCoreFact = ariaProfile.inputReferences.find((row) =>
  row.record_id.includes('core-levels'),
)!
export const ariaLocalizationSourceSha256 =
  '19C145475722980973D75C24ED3F100B35CB79AA4BA368F22E20C41F09B20433' as const
export const ariaEtherAbloomMultipliers = [0.138, 0.16, 0.183, 0.206, 0.229, 0.252, 0.275] as const
export const reviewedPreparedAnomalyObjectiveIdentity32 = Object.freeze({
  version: 'prepared-single-owner-anomaly-objective32-r3',
  arithmetic: commonAnomalySettlementHash32,
  sourceFormulaHashes,
  janeAssaultPotential: getReviewedPotentialDefinition('agent-jane'),
  promeiaProfileHash: promeiaProfile.profileHash,
  promeiaCoreFact,
  ariaProfileHash: ariaProfile.profileHash,
  ariaCoreFact,
  ariaLocalizationSourceSha256,
  ariaEtherAbloomMultipliers,
  domain: 'one_prepared_settlement_no_cycle_no_inferred_frequency',
})
export const reviewedPreparedAnomalyObjectiveHash32 = stableContentHash(
  reviewedPreparedAnomalyObjectiveIdentity32,
)

export function reviewedPreparedAnomalyPreparation32(
  agentId: string,
  options?: { enemyStunned?: boolean; momentOfDelusion?: boolean },
): PreparedAnomalyPreparation32 | null {
  if (agentId === 'agent-jane')
    return {
      kind: 'jane_single_assault',
      acceptedSingleOwnerSettlement: true,
      passion: true,
      gnawed: true,
      priorAssaultOrDisorderBuffActive: false,
    }
  if (agentId === 'agent-piper')
    return { kind: 'piper_single_assault', acceptedSingleOwnerSettlement: true, powerStacks: 0 }
  if (agentId === 'agent-alice')
    return {
      kind: 'alice_single_polarized_assault',
      acceptedSingleOwnerSettlement: true,
      bladeEtiquette: 300,
    }
  if (agentId === 'agent-promeia')
    return {
      kind: 'promeia_single_self_ice_abloom',
      acceptedSingleOwnerSettlement: true,
      trialByCold: 1,
      ownIceAnomalyPresent: true,
    }
  if (agentId === 'agent-aria')
    return {
      kind: 'aria_single_self_ether_abloom',
      acceptedSingleOwnerSettlement: true,
      perfectPitchHit3Heavy: true,
      ownEtherAnomalyPresent: true,
      fandomPowerPrepared: true,
      enemyStunned: options?.enemyStunned ?? false,
      momentOfDelusion: options?.momentOfDelusion ?? false,
    }
  return null
}
