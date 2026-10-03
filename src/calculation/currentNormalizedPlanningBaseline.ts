import {
  currentFormulaBaseStats,
  currentFormulaBaseStatsSource,
} from '../gameDataPacks/currentFormulaBaseStats'
import {
  currentBangbooNumericCatalog,
  projectCurrentBangbooStats,
} from '../gameDataPacks/currentBangbooNumericCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { isSourceRateEvent32, sourceEventQuantityIdentity32 } from './sourceEventQuantity32'
import { current31LegalAgentFormations } from '../teamEngine/current31LegalCandidateUniverse'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  currentAgentEventContracts,
  currentAgentMechanicIdentity,
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import {
  compileFormationPlanningEffectBlueprints,
  currentAgentPlanningEffectBlueprintCoverage,
} from './currentAgentPlanningEffectBlueprint'
import type {
  PlanningEffectDisposition,
  PlanningEventUsage,
} from './planningCalculationContextCompiler'
import { directDamageCoreVersion } from './directDamageCore'
import { damageFormula32Identity } from './sharpDamageCore'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentWEngineStaticCatalog } from '../gameDataPacks/currentWEngineStaticCatalog'
import { driveDiscData } from '../data/gameData'
import { currentFormulaMechanicContractHash } from './currentFormulaMechanicContracts'

export const currentNormalizedPlanningModelBoundary =
  '同一30秒固定事件比较基线；已审核的3.2来源动作优先，其余沿用具名代表动作。每秒倍率按声明秒数计量；只有明确准备态或事件条件进入效果公式，未观测条件显式排除，不等同实战循环。'

const normalizedBaselineId = `soda-${currentAgentMechanicIdentity.gameVersion}-normalized-fixed-event-r1`

export const currentBangbooFixedEventObservation = Object.freeze({
  activeUseCount: 1 as const,
  chainUseCount: 1 as const,
  durationSeconds: 30 as const,
  authority: 'declared_candidate_fixed_event_comparison' as const,
  sourceRefs: [`planning-baseline:${normalizedBaselineId}:bangboo-active-chain-once`],
})

const normalizedSourcePackHash = stableContentHash({
  agents: currentAgentEventContracts.map((item) => [item.stableId, item.source.formulaSha256]),
  formulaBaseStats: { values: currentFormulaBaseStats, source: currentFormulaBaseStatsSource },
  agentStaticStats: currentAgentEventContracts.map((item) => [item.stableId, item.baseStats]),
  wEngineStaticCatalog: currentWEngineStaticCatalog.contentHash,
  driveDiscFormulaCatalog: currentDriveDiscFormulaCatalog.contentHash,
  driveDiscStatRules: driveDiscData?.rules ?? null,
  bangboos: currentBangbooNumericCatalog.contentHash,
})

export const currentNormalizedPlanningBaseline = Object.freeze({
  schemaVersion: 'planning-baseline-v1' as const,
  baselineId: normalizedBaselineId,
  gameVersion: currentAgentMechanicIdentity.gameVersion,
  phaseId: 'normalized-fixed-event-comparison',
  declaredDurationSeconds: 30,
  bangbooFixedEventObservation: currentBangbooFixedEventObservation,
  enemy: {
    id: 'normalized-level-70-neutral',
    defense: 700,
    resistance: 0.2,
    stunMultiplier: 1,
    vulnerability: 0,
  },
  rounding: 'nearest-0.01' as const,
  sourcePackHash: normalizedSourcePackHash,
  formulaHash: stableContentHash({
    family: 'normalized_fixed_event_direct_potential',
    sourcePackHash: normalizedSourcePackHash,
    directDamageCoreVersion,
    typedDamageFormula32: damageFormula32Identity,
    staticProjection: 'actual-level-typed-base-full-initial-static-v3',
    penetration: 'ratio-and-flat-in-defense-factor',
    receiverSemantics: 'separate-attack-flat-and-percent-v2',
    eventSelection: 'reviewed-32-source-packets-else-existing-field-time-skill-priority-r1',
    coefficientUnits: sourceEventQuantityIdentity32,
    occurrenceByFieldTimeMode: {
      dominant_field: 6,
      primary_field: 5,
      shared_rotation: 4,
      burst_swap: 3,
      background: 2,
    },
    conditionalEffects: 'source-prepared-state-or-observed-else-explicitly-excluded',
    driveDiscFourPiecePolicy: 'disc-fixed-event-passives-r1',
    equipmentFormulaContract: currentFormulaMechanicContractHash,
    bangbooFixedEventObservation: currentBangbooFixedEventObservation,
  }),
})

const occurrenceByFieldTimeMode: Readonly<Record<string, number>> = Object.freeze({
  dominant_field: 6,
  primary_field: 5,
  shared_rotation: 4,
  burst_swap: 3,
  background: 2,
})

const preferredSkillByFieldTimeMode: Readonly<Record<string, readonly string[]>> = Object.freeze({
  dominant_field: ['basic', 'special', 'dodge', 'assist', 'chain'],
  primary_field: ['basic', 'special', 'dodge', 'assist', 'chain'],
  shared_rotation: ['special', 'assist', 'basic', 'chain', 'dodge'],
  burst_swap: ['special', 'assist', 'chain', 'basic', 'dodge'],
  background: ['assist', 'special', 'chain', 'basic', 'dodge'],
})

function skillLevelFor(skill: string, levels?: Readonly<Record<string, number | null>>) {
  const level = levels?.[skill]
  return Number.isInteger(level) && Number(level) > 0 ? Number(level) : 11
}

function representativeAction(agentId: string, levels?: Readonly<Record<string, number | null>>) {
  const eventContract = getCurrentAgentEventContract(agentId)
  const decision = getCurrentAgentDecisionMechanicContract(agentId)
  if (!eventContract || !decision) return null
  const fallbackMode = ['support'].includes(eventContract.identity.specialty)
    ? 'background'
    : ['stun', 'defense'].includes(eventContract.identity.specialty)
      ? 'shared_rotation'
      : 'primary_field'
  const mode = decision.fieldTimeContract?.mode ?? fallbackMode
  const preference = preferredSkillByFieldTimeMode[mode] ?? [
    'basic',
    'special',
    'assist',
    'chain',
    'dodge',
  ]
  for (const skill of preference) {
    const actions = new Map<string, typeof eventContract.eventContract.events>()
    for (const event of eventContract.eventContract.events.filter(
      (item) => item.skill === skill && item.formulaProjection !== 'raw_only',
    )) {
      const list = actions.get(event.actionId) ?? []
      actions.set(event.actionId, [...list, event])
    }
    const evaluated = [...actions].flatMap(([actionId, events]) => {
      const level = skillLevelFor(skill, levels)
      const resolved = events.map((event) =>
        resolveCurrentAgentEvent({ stableId: agentId, eventId: event.eventId, skillLevel: level }),
      )
      if (resolved.some((item) => item.status !== 'supported')) return []
      return [
        {
          actionId,
          skill,
          skillLevel: level,
          events,
          multiplier: resolved.reduce(
            (sum, item) => sum + (item.status === 'supported' ? item.damageMultiplier : 0),
            0,
          ),
        },
      ]
    })
    evaluated.sort(
      (left, right) =>
        right.multiplier - left.multiplier || left.actionId.localeCompare(right.actionId),
    )
    if (evaluated[0]) return evaluated[0]
  }
  return null
}

export function compileNormalizedAgentEventSchedule(input: {
  agentId: string
  skillLevels?: Readonly<Record<string, number | null>>
}) {
  const decision = getCurrentAgentDecisionMechanicContract(input.agentId)
  const action = representativeAction(input.agentId, input.skillLevels)
  const eventContract = getCurrentAgentEventContract(input.agentId)
  if (!decision || !eventContract || !action)
    return { status: 'unsupported' as const, blockers: [`缺少固定事件策略输入：${input.agentId}`] }
  const fieldTimeMode =
    decision.fieldTimeContract?.mode ??
    (eventContract.identity.specialty === 'support'
      ? 'background'
      : ['stun', 'defense'].includes(eventContract.identity.specialty)
        ? 'shared_rotation'
        : 'primary_field')
  const occurrenceCount = occurrenceByFieldTimeMode[fieldTimeMode]
  if (!occurrenceCount)
    return { status: 'unsupported' as const, blockers: [`未知场上时间模式：${fieldTimeMode}`] }
  const evidenceRefs = [
    decision.fieldTimeContract?.source.sourceId ??
      `${currentNormalizedPlanningBaseline.baselineId}:specialty-fallback`,
    `${getCurrentAgentEventContract(input.agentId)!.source.formulaPath}#${getCurrentAgentEventContract(input.agentId)!.source.formulaSha256}`,
    currentNormalizedPlanningBaseline.baselineId,
  ]
  const eventUsages: PlanningEventUsage[] = action.events.map((event) => ({
    ownerAgentId: input.agentId,
    eventId: event.eventId,
    skillLevel: action.skillLevel,
    occurrenceCount,
    ...(isSourceRateEvent32(input.agentId, event.eventId)
      ? { durationSeconds: occurrenceCount }
      : {}),
    evidenceRefs,
  }))
  return {
    status: 'supported' as const,
    fieldTimeMode,
    actionId: action.actionId,
    skill: action.skill,
    skillLevel: action.skillLevel,
    occurrenceCount,
    eventUsages,
    normalizedDamageMultiplier: action.multiplier * occurrenceCount,
  }
}

export function compileNormalizedFormationEffectDispositions(memberIds: readonly string[]) {
  const blueprints = compileFormationPlanningEffectBlueprints(memberIds)
  if (blueprints.status === 'unsupported') return blueprints
  const activationByProvider = new Map(
    memberIds.map((agentId) => [
      agentId,
      evaluateCurrentAgentTeamActivation({
        stableId: agentId,
        memberIds,
        agentState: { mindscape: 0 },
      }),
    ]),
  )
  const entries: PlanningEffectDisposition[] = blueprints.entries.map((blueprint) => {
    const activation = activationByProvider.get(blueprint.providerAgentId)
    const activationLabel =
      activation?.status === 'supported'
        ? activation.active
          ? 'identity predicate active'
          : 'identity predicate inactive'
        : 'activation not expressed by upstream formula'
    return {
      effectKey: blueprint.effectKey,
      disposition: 'excluded',
      activeSeconds: 0,
      targetAgentId: null,
      reason: `${activationLabel}; normalized R1 excludes conditional effect value instead of inventing a numeric modifier.`,
      evidenceRefs: [...blueprint.sourceRefs, currentNormalizedPlanningBaseline.baselineId],
    }
  })
  return {
    status: 'supported' as const,
    entries,
    dispositionHash: stableContentHash(entries),
  }
}

const normalizedAgentScore = new Map(
  currentAgentEventContracts.map((contract) => {
    const schedule = compileNormalizedAgentEventSchedule({ agentId: contract.stableId })
    if (schedule.status === 'unsupported') throw new Error(schedule.blockers.join(' '))
    const level60BaseAttack = contract.baseStats.atk_base + contract.baseStats.atk_growth * 59
    const level60BaseDefense = contract.baseStats.def_base + contract.baseStats.def_growth * 59
    const score = schedule.eventUsages.reduce((sum, usage) => {
      const event = resolveCurrentAgentEvent({
        stableId: contract.stableId,
        eventId: usage.eventId,
        skillLevel: usage.skillLevel,
      })
      if (event.status !== 'supported')
        throw new Error(`候选事件不可求值：${contract.stableId}:${usage.eventId}`)
      // The legacy rupture decision proxy remains explicitly a candidate score.
      // A reviewed DEF event must use its actual source DEF, never an ATK substitute.
      const sourceBase = event.scalingAttribute === 'def' ? level60BaseDefense : level60BaseAttack
      return sum + sourceBase * event.damageMultiplier * usage.occurrenceCount
    }, 0)
    return [contract.stableId, score] as const
  }),
)

const normalizedBangbooScore = new Map(
  currentBangbooNumericCatalog.items.map((item) => {
    const stats = projectCurrentBangbooStats({
      stableId: item.stableId,
      level: 60,
      ascensionLevelCap: 60,
    })
    if (stats.status === 'unsupported') throw new Error(`邦布数值目录不可求值：${item.stableId}`)
    const damageLikeMultiplier = item.skillProps.reduce(
      (sum, skill) =>
        sum + (skill.properties.find((property) => property.key === '1001')?.main ?? 0) / 10000,
      0,
    )
    return [item.stableId, stats.attack * damageLikeMultiplier] as const
  }),
)

export function getNormalizedAgentDecisionScore(agentId: string) {
  return normalizedAgentScore.get(agentId) ?? null
}

export function getNormalizedBangbooDecisionScore(bangbooId: string) {
  return normalizedBangbooScore.get(bangbooId) ?? null
}

const allAgentProfilesFinite = [...normalizedAgentScore.values()].every(Number.isFinite)
const scoredFormationCount =
  normalizedAgentScore.size === currentAgentMechanicIdentity.agentCount && allAgentProfilesFinite
    ? current31LegalAgentFormations.length
    : 0

export const currentNormalizedDecisionScoreAudit = Object.freeze({
  contract: 'soda-normalized-decision-score-audit/v1',
  scalingAuthority: 'source_event_def_or_legacy_attack_candidate_proxy',
  baselineId: currentNormalizedPlanningBaseline.baselineId,
  agentProfilesReady: normalizedAgentScore.size,
  bangbooProfilesReady: normalizedBangbooScore.size,
  scoredFormationCount,
  requiredFormationCount: current31LegalAgentFormations.length,
  scoredFormationBangbooCandidateCount: scoredFormationCount * (normalizedBangbooScore.size + 1),
  requiredFormationBangbooCandidateCount:
    current31LegalAgentFormations.length * (normalizedBangbooScore.size + 1),
  decisionScoreCoveragePercent:
    scoredFormationCount === current31LegalAgentFormations.length &&
    normalizedBangbooScore.size === currentBangbooNumericCatalog.items.length
      ? 100
      : 0,
  effectDispositionCount:
    (currentAgentPlanningEffectBlueprintCoverage.effectCount *
      (currentAgentMechanicIdentity.agentCount - 1) *
      (currentAgentMechanicIdentity.agentCount - 2)) /
    2,
  boundary: currentNormalizedPlanningModelBoundary,
})
