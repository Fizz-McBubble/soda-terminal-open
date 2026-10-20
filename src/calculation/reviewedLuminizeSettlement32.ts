import {
  declaredLuminizeSettlementSchema32,
  type DeclaredLuminizeSettlement32,
} from './luminizeSettlementContract32'
export {
  declaredLuminizeSettlementSchema32,
  type DeclaredLuminizeSettlement32,
} from './luminizeSettlementContract32'
import { contentHash } from '../application/contentHash'
import { calculateAnomalyDamageCore } from './anomalyDamageCore'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  evaluateReviewedLuminizeMultiplier32,
  reviewedLumifluxMechanicsHash32,
  reviewedLumifluxMechanicsIdentity32,
} from './reviewedLumifluxMechanics32'

export const declaredLuminizeBoundary32 =
  '已声明队友虚光的单次、非暴击辉映结算；快照攻/精通/增伤/穿透与折光、当前丽弥尔倍率和当前敌人状态分开。未推断虚光取得、自动攻击、重复齐射或完整循环，不授予Formal或导入资格。'

export function evaluateReviewedLuminizeSettlement32(raw: unknown) {
  const failure = (blocker: string) => ({
    status: 'unsupported' as const,
    totalDamage: null,
    instances: [],
    blockers: [blocker],
    boundary: declaredLuminizeBoundary32,
    formalCycleReady: false as const,
    modelQualification32: null,
  })
  const parsed = declaredLuminizeSettlementSchema32.safeParse(raw)
  if (!parsed.success) return failure('luminize_declaration_invalid')
  const input = parsed.data
  const members = new Set(input.memberAgentIds)
  const provider = getCurrentAgentEventContract('agent-remielle')
  if (
    members.size !== input.memberAgentIds.length ||
    !members.has('agent-remielle') ||
    provider?.source.commit !== reviewedLumifluxMechanicsIdentity32.source.commit ||
    input.memberAgentIds.some(
      (agentId) =>
        getCurrentAgentEventContract(agentId)?.source.commit !==
        reviewedLumifluxMechanicsIdentity32.source.commit,
    )
  )
    return failure('luminize_formation_source_mismatch')
  if (new Set(input.voidflares.map((flare) => flare.id)).size !== input.voidflares.length)
    return failure('luminize_duplicate_voidflare')
  for (const flare of input.voidflares) {
    const owner = getCurrentAgentEventContract(flare.ownerAgentId)
    if (
      !members.has(flare.ownerAgentId) ||
      flare.ownerAgentId === 'agent-remielle' ||
      owner?.identity.attribute !== flare.attribute ||
      flare.snapshotAtSeconds > input.atSeconds
    )
      return failure('luminize_snapshot_ownership_or_time_mismatch')
    if (
      input.target.resistanceByAttribute[flare.attribute] === undefined ||
      input.target.resistanceReductionByAttribute[flare.attribute] === undefined
    )
      return failure('luminize_target_attribute_state_missing')
  }
  const multiplier = evaluateReviewedLuminizeMultiplier32({
    skill: input.skill,
    effectiveSkillLevel: input.effectiveSkillLevel,
    remielleAnomalyProficiency: input.remielle.anomalyProficiency,
    remielleMindscape: input.remielle.mindscape,
    remielleCoreLevel: input.remielle.coreLevel,
    prismaticDefenseIgnoreWindow: input.remielle.prismaticDefenseIgnoreWindow,
  })
  if (multiplier.status !== 'limited_benchmark') return failure('luminize_multiplier_unresolved')
  const instances = input.voidflares.map((flare) => {
    const calculated = calculateAnomalyDamageCore({
      ...flare.stats,
      baseMultiplier: multiplier.finalPercent / 100,
      anomalyBaseBonus: 0,
      flatAnomalyDamage: 0,
      anomalyCritRate: 0,
      anomalyCritDamage: 0,
      buffBonus: input.remielle.generalAnomalyDamageBonus,
      directDamageBonus: 0,
      defenseIgnore: multiplier.mindscapeTwoDefenseIgnore,
      resistanceIgnore: multiplier.mindscapeOneResistanceIgnore,
      enemyDefense: input.target.enemyDefense,
      defenseReduction: input.target.defenseReduction,
      resistance: input.target.resistanceByAttribute[flare.attribute]!,
      resistanceReduction: input.target.resistanceReductionByAttribute[flare.attribute]!,
      vulnerability: input.target.vulnerability,
      stunMultiplier: input.target.stunMultiplier,
    })
    const refringeMultiplier = 1 + flare.storedRefringeCoefficient
    return {
      id: flare.id,
      ownerAgentId: flare.ownerAgentId,
      attribute: flare.attribute,
      snapshotAtSeconds: flare.snapshotAtSeconds,
      storedRefringeCoefficient: flare.storedRefringeCoefficient,
      nonCriticalDamage: calculated.nonCriticalDamage * refringeMultiplier,
      factors: { ...calculated.factors, refringeMultiplier },
      sourceRefs: flare.sourceRefs,
    }
  })
  const totalDamage = instances.reduce((sum, instance) => sum + instance.nonCriticalDamage, 0)
  if (!Number.isFinite(totalDamage)) return failure('luminize_nonfinite_result')
  return {
    status: 'declared_arithmetic' as const,
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
    inputFingerprint: contentHash(input),
    totalDamage,
    instances,
    multiplier,
    blockers: [],
    boundary: declaredLuminizeBoundary32,
    formalCycleReady: false as const,
    modelQualification32: null,
  }
}

/** Compare the same named volley/target. Snapshot and provider numeric factors
 * may change; source ownership, order and timing cannot silently change. */
export function compareReviewedLuminizeSettlements32(current: unknown, candidate: unknown) {
  const left = declaredLuminizeSettlementSchema32.safeParse(current)
  const right = declaredLuminizeSettlementSchema32.safeParse(candidate)
  if (!left.success || !right.success) return { status: 'unsupported' as const }
  const context = (input: DeclaredLuminizeSettlement32) => ({
    source: input.sourceIdentityHash,
    eventId: input.eventId,
    targetId: input.targetId,
    atSeconds: input.atSeconds,
    members: input.memberAgentIds,
    skill: input.skill,
    prismaticDefenseIgnoreWindow: input.remielle.prismaticDefenseIgnoreWindow,
    target: input.target,
    voidflares: input.voidflares.map(({ id, ownerAgentId, attribute, snapshotAtSeconds }) => ({
      id,
      ownerAgentId,
      attribute,
      snapshotAtSeconds,
    })),
  })
  if (contentHash(context(left.data)) !== contentHash(context(right.data)))
    return { status: 'unsupported' as const }
  const before = evaluateReviewedLuminizeSettlement32(left.data)
  const after = evaluateReviewedLuminizeSettlement32(right.data)
  if (before.status !== 'declared_arithmetic' || after.status !== 'declared_arithmetic')
    return { status: 'unsupported' as const }
  return {
    status: 'declared_comparison' as const,
    currentDamage: before.totalDamage,
    candidateDamage: after.totalDamage,
    delta: after.totalDamage - before.totalDamage,
    boundary: declaredLuminizeBoundary32,
    formalCycleReady: false as const,
  }
}
