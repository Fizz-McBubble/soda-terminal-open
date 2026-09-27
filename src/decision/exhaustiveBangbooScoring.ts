import type { AccountRoster } from '../assault/types'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import {
  getCurrentBangbooContractRequirements,
  resolveCurrentBangbooMechanicContract,
} from '../calculation/currentBangbooMechanicContracts'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { currentBangbooAgentCompositionKey } from '../calculation/currentBangbooCompositionIdentity'
import { projectCurrentBangbooStats } from '../gameDataPacks/currentBangbooNumericCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { bangbooFactionCompositionKey } from './bangbooCompositionIdentity'

export type BangbooEvaluationAudit = {
  bangbooId: string
  level: number | null
  stars: number | null
  skillLevel: number | null
  additionalAbilityLevel: number | null
  baseBlockers: string[]
  compositionKeys: string[]
  sourceContractHash: string
  fingerprintWord: number
}

export type BangbooDamageBucket = {
  bangbooId: string
  totalDamage: number
  activeMultiplier: number
  chainMultiplier: number
  activeUseCount: number
  chainUseCount: number
  sourceRefs: string[]
  nonDamageOutputs: Array<{ operator: string; action: string | null }>
}

export const FNV_OFFSET = 2166136261

export const FNV_PRIME = 16777619

export function hashWord(value: unknown) {
  return Number.parseInt(stableContentHash(value).slice('fnv1a-'.length), 16) >>> 0
}

export function absorbFingerprintWord(state: number, word: number) {
  return Math.imul((state ^ word) >>> 0, FNV_PRIME) >>> 0
}

export function fingerprintFromWord(word: number) {
  return `fnv1a-${word.toString(16)}`
}

export function createBangbooEvaluationAudits(roster: AccountRoster): BangbooEvaluationAudit[] {
  return roster.bangboos
    .filter((bangboo) => bangboo.owned)
    .map((bangboo) => {
      const requirements = getCurrentBangbooContractRequirements(bangboo.bangbooId)
      const missingAccountFacts =
        bangboo.level === null ||
        bangboo.stars === null ||
        bangboo.skillLevel === null ||
        bangboo.additionalAbilityLevel === null
      const baseBlockers = [
        ...(requirements ? [] : [`邦布“${bangboo.bangbooId}”没有 current Mechanic Contract。`]),
        ...(missingAccountFacts
          ? ['账户快照未提供邦布等级、星级、active-skill 或附加能力等级；不能从默认值推断。']
          : []),
      ]
      const sourceContractHash = stableContentHash({
        bangbooId: bangboo.bangbooId,
        level: bangboo.level,
        stars: bangboo.stars,
        skillLevel: bangboo.skillLevel,
        additionalAbilityLevel: bangboo.additionalAbilityLevel,
        requirements,
        baseBlockers,
      })
      return {
        bangbooId: bangboo.bangbooId,
        level: bangboo.level,
        stars: bangboo.stars,
        skillLevel: bangboo.skillLevel,
        additionalAbilityLevel: bangboo.additionalAbilityLevel,
        baseBlockers: [...new Set(baseBlockers)],
        compositionKeys: requirements?.compositionKeys ?? [],
        sourceContractHash,
        fingerprintWord: hashWord({
          bangbooId: bangboo.bangbooId,
          sourceContractHash,
        }),
      }
    })
}

export function projectCurrentBangbooComposition(memberIds: readonly string[]) {
  const composition: Record<string, number> = {}
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    if (!identity) return null
    for (const key of [
      currentBangbooAgentCompositionKey(agentId),
      `attribute:${identity.attribute}`,
      `specialty:${identity.specialty}`,
      bangbooFactionCompositionKey(identity.faction),
    ])
      composition[key] = (composition[key] ?? 0) + 1
  }
  return composition
}

export function compositionCacheKey(
  audit: BangbooEvaluationAudit,
  composition: Record<string, number> | null,
) {
  // Only contract-declared keys affect resolver activation. This keeps the
  // source-backed resolver cache bounded by composition classes rather than
  // allocating a JSON hash for every formation × Bangboo candidate.
  let key = audit.sourceContractHash
  for (const compositionKey of audit.compositionKeys)
    key += `:${composition?.[compositionKey] ?? 0}`
  return key
}

export function bangbooAscensionLevelCap(level: number): 10 | 20 | 30 | 40 | 50 | 60 {
  if (level <= 10) return 10
  if (level <= 20) return 20
  if (level <= 30) return 30
  if (level <= 40) return 40
  if (level <= 50) return 50
  return 60
}

export function evaluateBangbooFixedEvent(input: {
  audit: BangbooEvaluationAudit
  composition: Record<string, number> | null
}) {
  const { audit } = input
  if (audit.baseBlockers.length)
    return { status: 'unsupported' as const, blockers: audit.baseBlockers }
  if (!input.composition)
    return {
      status: 'unsupported' as const,
      blockers: ['队伍成员缺少 current identity composition。'],
    }
  const resolved = resolveCurrentBangbooMechanicContract({
    stableId: audit.bangbooId,
    skillLevel: audit.skillLevel,
    additionalAbilityLevel: audit.additionalAbilityLevel,
    bangbooLevel: audit.level,
    composition: input.composition,
    flags: {},
    accumulators: {},
  })
  if (resolved.status === 'unsupported') return resolved
  const stats = projectCurrentBangbooStats({
    stableId: audit.bangbooId,
    level: audit.level!,
    ascensionLevelCap: bangbooAscensionLevelCap(audit.level!),
  })
  if (stats.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [`邦布“${audit.bangbooId}”缺少可用等级数值。`],
    }
  const observation = currentNormalizedPlanningBaseline.bangbooFixedEventObservation
  if (!observation)
    return {
      status: 'unsupported' as const,
      blockers: ['当前 PlanningBaseline 未提供邦布 fixed-event observation。'],
    }
  const damageEvents = resolved.outputs.filter((output) => output.operator === 'damage_event_emit')
  const activeMultiplier = damageEvents
    .filter((output) => output.action === 'active')
    .reduce((sum, output) => sum + output.multiplier, 0)
  const chainMultiplier = damageEvents
    .filter((output) => output.action === 'chain')
    .reduce((sum, output) => sum + output.multiplier, 0)
  const multiplier =
    activeMultiplier * observation.activeUseCount + chainMultiplier * observation.chainUseCount
  const totalDamage =
    stats.attack *
    multiplier *
    (1 + stats.critRate * stats.critDamage) *
    (1 + stats.penetrationRatio) *
    (160 / (160 + currentNormalizedPlanningBaseline.enemy.defense)) *
    (1 - currentNormalizedPlanningBaseline.enemy.resistance) *
    currentNormalizedPlanningBaseline.enemy.stunMultiplier *
    (1 + currentNormalizedPlanningBaseline.enemy.vulnerability)
  if (!Number.isFinite(totalDamage))
    return {
      status: 'unsupported' as const,
      blockers: [`邦布“${audit.bangbooId}”fixed-event 伤害不可求值。`],
    }
  const bucket: BangbooDamageBucket = {
    bangbooId: audit.bangbooId,
    totalDamage,
    activeMultiplier,
    chainMultiplier,
    activeUseCount: observation.activeUseCount,
    chainUseCount: observation.chainUseCount,
    sourceRefs: [
      ...new Set([
        ...observation.sourceRefs,
        `bangboo-source:${resolved.source.sha256}:${resolved.source.url}`,
      ]),
    ],
    nonDamageOutputs: resolved.outputs
      .filter((output) => output.operator !== 'damage_event_emit')
      .map((output) => ({
        operator: output.operator,
        action: 'action' in output && typeof output.action === 'string' ? output.action : null,
      })),
  }
  return {
    status: 'supported' as const,
    totalDamage,
    bucket,
    evaluationHash: stableContentHash({
      audit,
      composition: input.composition,
      stats,
      resolved,
      bucket,
    }),
  }
}
