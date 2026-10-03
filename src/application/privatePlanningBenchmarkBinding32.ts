import type { CoreWarehouse } from '../accounts/coreFlow'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  currentPlanningConditionCatalogIdentity32,
  projectCurrentPlanningConditionCatalog32,
} from '../calculation/currentPlanningConditionCatalog32'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { planningEffectResolutionIdentity32 } from '../calculation/currentPlanningEffectResolutionIdentity32'
import { getPlanningDamageEventSemantics } from '../calculation/currentPlanningTeamDpsRuntime'
import { accountSkillLevel } from '../decision/normalizedPlanningCandidateEvaluator'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import type { TargetTeamWarehouseFit } from '../decision/targetTeamWarehouseFit'
import type { TargetTeamEquipmentParameterSelection } from '../decision/targetTeamAccountBoundBenchmark'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { defaultAscensionForLevel } from '../gameDataPacks/panel/wEngineGrowth'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import { stableContentHash } from '../gameDataPacks/types'
import { reviewedPlanningEventSetIdentity32 } from '../gameDataPacks/reviewedPlanningEventSetIdentity32'
import {
  planningEventDeclarations32Contract,
  planningEventDeclarationsMetadataFingerprint32,
  type PlanningEventDeclarationsMetadata32,
} from './publicPlanningEventDeclarations32'

export type PlanningBenchmarkBinding32 = {
  runId: string
  candidateId: string
  accountFingerprint: string
  capturedAt: string
  warehouse: CoreWarehouse
  fit: Pick<TargetTeamWarehouseFit, 'status' | 'uniqueDiscCount' | 'memberIds' | 'fingerprint'> & {
    loadouts: ReadonlyArray<Pick<TargetTeamWarehouseFit['loadouts'][number], 'agentId' | 'discIds'>>
  }
  selectedEquipment?:
    | (Pick<TargetTeamEquipmentParameterSelection, 'wEngines' | 'potentialByAgentId'> & {
        source?: 'source_defaults' | 'player_confirmed'
      })
    | null
}

/** Reuse the accepted 30-second declared benchmark environment. Event times
 * are supplied separately; this policy does not estimate animation lengths. */
export const planningBenchmarkBaseline32 = {
  ...currentNormalizedPlanningBaseline,
  baselineId: `${currentNormalizedPlanningBaseline.baselineId}:declared-events32`,
  gameVersion: '3.2',
  formulaHash: stableContentHash(planningEffectResolutionIdentity32),
  sourcePackHash: stableContentHash(currentPlanningConditionCatalogIdentity32),
}
export const planningBenchmarkContextPolicy32 = Object.freeze({
  enemyLevel: 70,
  rounding: { stage: 'display', precision: 2, mode: 'half_away_from_zero', preserveRawSum: true },
})
const incrementalEngines = new Set([
  'wengine-14161',
  'wengine-14162',
  'wengine-13021',
  'wengine-13017',
  'wengine-12016',
])

export function preparePlanningBenchmark32(input: PlanningBenchmarkBinding32) {
  const gaps: string[] = []
  if (incremental32RecoveryPolicy.enabled) gaps.push(incremental32RecoveryReason)
  if (input.fit.status !== 'ready' || input.fit.uniqueDiscCount !== 18)
    gaps.push('请先生成三名成员各六张、合计18张不同实体盘的配装。')
  const memberIds = input.fit.memberIds
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    gaps.push('队伍成员必须为三名不同代理人。')
  const selection = input.selectedEquipment
  if (
    selection &&
    (selection.wEngines.length !== memberIds.length ||
      new Set(selection.wEngines.map((row) => row.agentId)).size !== memberIds.length ||
      selection.wEngines.some((row) => !memberIds.includes(row.agentId)))
  )
    gaps.push('方案音擎参数必须逐一对应实际三名队伍成员。')
  if (
    selection?.potentialByAgentId &&
    Object.entries(selection.potentialByAgentId).some(
      ([id, value]) =>
        !memberIds.includes(id) ||
        !supportsPotentialImage(id) ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 6,
    )
  )
    gaps.push('方案潜能参数必须属于实际支持潜能的成员，且在0到6之间。')
  const members: PlanningEffectRuntimeMember[] = []
  const parameters: Array<{
    agentId: string
    engineId: string
    level: number
    refinement: number
  }> = []
  const loadouts: Array<{ agentId: string; discs: Array<{ setId: string }> }> = []
  const actorBindings: Array<{
    agentId: string
    level: number
    mindscape: number
    potential: number | null
    skillLevels: Record<string, number>
    wEngine: { id: string; level: number; refinement: number }
    discs: Array<{ id: string; slot: number; setId: string; level: number; statsHash: string }>
    finalStatsHash: string
  }> = []
  const usedIds = new Set<string>()
  for (const agentId of memberIds) {
    const recordedAgent = input.warehouse.roster.agents.find(
      (row) => row.agentId === agentId && row.owned,
    )
    const selected = selection?.wEngines.find((row) => row.agentId === agentId)
    const recordedEngine = recordedAgent?.wEngineDetails
    // A hypothetical identity/refinement is a plan operand. It never edits the
    // owned instance. Absent explicit progression, preserve the recorded level
    // and ascension; an explicit level uses the shared promotion policy.
    const engine = recordedAgent && {
      ...recordedEngine,
      id: selected?.engineId ?? recordedEngine?.id ?? null,
      name: recordedEngine?.name ?? null,
      refinement: selected?.refinement ?? recordedEngine?.refinement ?? null,
      level: selected?.level ?? recordedEngine?.level ?? null,
      ascension:
        selected?.ascension ??
        (selected?.level === undefined
          ? (recordedEngine?.ascension ?? null)
          : defaultAscensionForLevel(selected.level)),
    }
    const agent = recordedAgent &&
      engine && {
        ...recordedAgent,
        wEngineDetails: engine,
        ...(selection?.potentialByAgentId?.[agentId] === undefined
          ? {}
          : {
              potentialImage: selection.potentialByAgentId[agentId],
            }),
      }
    const loadout = input.fit.loadouts.find((row) => row.agentId === agentId)
    const discs =
      loadout?.discIds.map((id) => input.warehouse.discs.find((row) => row.id === id)) ?? []
    if (
      !agent ||
      !engine?.id ||
      typeof engine.level !== 'number' ||
      !Number.isInteger(engine.level) ||
      engine.level < 1 ||
      engine.level > 60 ||
      typeof engine.refinement !== 'number' ||
      !Number.isInteger(engine.refinement) ||
      engine.refinement < 1 ||
      engine.refinement > 5
    ) {
      gaps.push(`${agentId}缺少实际已拥有状态、音擎身份、等级或精炼记录；不会使用60级替代。`)
      continue
    }
    if (
      discs.length !== 6 ||
      discs.some((disc) => !disc) ||
      discs.some((disc) => disc && usedIds.has(disc.id))
    ) {
      gaps.push(`${agentId}的六张盘缺失或与队友共用同一实体盘。`)
      continue
    }
    const actualDiscs = discs.filter((disc): disc is NonNullable<typeof disc> => Boolean(disc))
    actualDiscs.forEach((disc) => usedIds.add(disc.id))
    const projection = projectNormalizedAccountFinalStatsDetailed({
      agent,
      engineId: engine.id,
      discs: actualDiscs,
    })
    if (projection.status !== 'supported') {
      gaps.push(...projection.reasons.map((reason) => `${agentId}：${reason}`))
      continue
    }
    const skillLevels = Object.fromEntries(
      ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
        skill,
        accountSkillLevel(agent, skill),
      ]),
    )
    const potential = agent.potentialImage ?? null
    const member = {
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential,
      coreLevel: Math.min(7, skillLevels.core!),
      skillLevels,
      initialStats: projection.stats.initialStats,
      finalStats: projection.stats.finalStats,
    }
    members.push(member)
    parameters.push({
      agentId,
      engineId: engine.id,
      level: engine.level,
      refinement: engine.refinement,
    })
    loadouts.push({ agentId, discs: actualDiscs })
    actorBindings.push({
      agentId,
      level: agent.level,
      mindscape: agent.mindscape,
      potential,
      skillLevels,
      wEngine: { id: engine.id, level: engine.level, refinement: engine.refinement },
      discs: actualDiscs.map((disc) => ({
        id: disc.id,
        slot: disc.slot,
        setId: disc.setId,
        level: disc.level,
        statsHash: stableContentHash(disc),
      })),
      finalStatsHash: stableContentHash({ agent, discs: actualDiscs, stats: projection.stats }),
    })
  }
  const equippedWEngines = parameters
    .filter((row) => {
      const specialty = getCurrentAgentEventContract(row.agentId)?.identity.specialty
      return (
        incrementalEngines.has(row.engineId) &&
        getCurrentWEngineStaticData(row.engineId)?.specialty ===
          (specialty === 'attack' ? 'damage' : specialty)
      )
    })
    .map((row) => ({ providerAgentId: row.agentId, engineId: row.engineId }))
  const projections = new Map(
    memberIds.map((subjectAgentId) => [
      subjectAgentId,
      projectCurrentPlanningConditionCatalog32({
        subjectAgentId,
        memberIds,
        equippedWEngines,
        equippedDriveDiscs: loadouts.flatMap((loadout) => {
          const counts = new Map<string, number>()
          for (const disc of loadout.discs)
            counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
          return [...counts].map(([setId, pieces]) => ({
            providerAgentId: loadout.agentId,
            setId,
            pieces,
          }))
        }),
      }),
    ]),
  )
  gaps.push(...[...projections.values()].flatMap((row) => row.blockers))
  const events: PlanningEventDeclarationsMetadata32['events'] = []
  const hasWind = memberIds.some(
    (id) => getCurrentAgentEventContract(id)?.identity.attribute === 'wind',
  )
  for (const member of members) {
    const contract = getCurrentAgentEventContract(member.agentId)
    const projection = projections.get(member.agentId)!
    if (!contract || contract.source.commit !== currentPlanningConditionCatalogIdentity32.commit) {
      gaps.push(`${member.agentId}的事件不属于已锁定的3.2来源。`)
      continue
    }
    for (const event of contract.eventContract.events) {
      if (!getPlanningDamageEventSemantics(event)) continue
      const skillLevel = member.skillLevels[event.skill]
      if (!skillLevel) continue
      events.push({
        ownerAgentId: member.agentId,
        eventId: event.eventId,
        skillLevel,
        requiresWindsweptObservation: hasWind,
        sourceRefs: [
          `${contract.source.repository}@${contract.source.commit}`,
          `${contract.source.formulaPath}#sha256=${contract.source.formulaSha256}`,
          `${contract.source.statsPath}#sha256=${contract.source.statsSha256}`,
        ],
        conditions: projection.defs.filter((def) => def.referenceKey !== 'windswept'),
      })
    }
  }
  const vocabulary = {
    contract: planningEventDeclarations32Contract,
    gameVersion: '3.2' as const,
    phaseId: 'phase_ii' as const,
    declaredDurationSeconds: planningBenchmarkBaseline32.declaredDurationSeconds,
    memberIds: [...memberIds],
    events,
  }
  const metadata: PlanningEventDeclarationsMetadata32 | null =
    gaps.length || !events.length
      ? null
      : {
          ...vocabulary,
          sourceFingerprint: planningEventDeclarationsMetadataFingerprint32(vocabulary),
        }
  const sourceBindingFingerprint = stableContentHash({
    accountFingerprint: input.accountFingerprint,
    fitFingerprint: input.fit.fingerprint,
    actorBindings,
    metadata,
    conditionSource: currentPlanningConditionCatalogIdentity32,
    formulaSource: planningEffectResolutionIdentity32,
    selection: selection ?? null,
    equipmentProgressionPolicy: 'explicit_plan_progression_or_recorded_level_and_ascension',
    baseline: planningBenchmarkBaseline32,
    contextPolicy: planningBenchmarkContextPolicy32,
    modelQualification: reviewedPlanningEventSetIdentity32,
  })
  return {
    gaps: [...new Set(gaps)],
    members,
    parameters,
    loadouts,
    actorBindings,
    projections,
    metadata,
    sourceBindingFingerprint,
  }
}
