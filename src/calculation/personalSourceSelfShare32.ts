import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { isReviewedTemplateMechanicEffect32 } from './reviewedTemplateMechanicEffects32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { canonicalJson, sha256 } from '../application/contentHash'

// The pinned source text explicitly says the entire squad receives these
// effects, including the provider. This list grants only that self share; it
// is not a general teamBuff, enemy, teammate, or ability activation policy.
const reviewedSelfShares: Readonly<Record<string, string>> = Object.freeze({
  'agent-sunna:reviewed_angelic_chord_attack32': 'teamBuff.combat.atk',
  'agent-zhao:reviewed_wellspring_attack32': 'teamBuff.combat.atk',
  'agent-nangong:reviewed_core_team_damage32': 'teamBuff.combat.common_dmg_',
})

export function isPersonalSourceSelfShare32(entry: CurrentAgentPlanningEffectBlueprint): boolean {
  if (entry.effectKey === 'agent-lucia:core_common_dmg_') {
    const source = getCurrentAgentEventContract('agent-lucia')?.source
    return Boolean(
      entry.providerAgentId === 'agent-lucia' &&
      entry.targetKinds.length === 1 &&
      entry.targetKinds[0] === 'team' &&
      effectReceiverMetadata(entry.numericExpression.expressionIr).receiverPath ===
        'teamBuff.combat.common_dmg_' &&
      entry.numericExpression.sourceStatus === 'upstream_expression_available' &&
      entry.numericExpression.expressionSha256 ===
        '1B67E5104BCD7C064E16C76ED247CBBE4ECBDCB9DA842DBDD31CECD2D6C76A25' &&
      sha256(canonicalJson(entry.numericExpression.expressionIr)) ===
        '69779a85cf53cedf4884e3b37cf3047f5b5058772f157fb8eebf779d86d7ba64' &&
      source?.commit === '3456cd0f6f5bea10e168074502460dac2fcd6df4' &&
      source.formulaSha256 === 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555' &&
      source.statsSha256 === '766884CB5FE953D5F6A4E256203500FCA39A2084FAF94316D48FCA270D264AB1',
    )
  }
  const receiver = reviewedSelfShares[entry.effectKey]
  return Boolean(
    receiver &&
    entry.providerAgentId === entry.effectKey.split(':')[0] &&
    entry.targetKinds.length === 1 &&
    entry.targetKinds[0] === 'team' &&
    effectReceiverMetadata(entry.numericExpression.expressionIr).receiverPath === receiver &&
    isReviewedTemplateMechanicEffect32(entry),
  )
}
