import { stableContentHash } from '../gameDataPacks/types'
import { auditLegalFormationNumericOperands } from '../teamEngine/current31LegalCandidateUniverse'
import {
  createCalculationContext,
  type CalculationContext,
  type CalculationContextInput,
} from './calculationContext'
import {
  compileFormationPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  compilePlanningInteractionContracts,
  type PlanningInteractionContract,
  type PlanningInteractionOperator,
} from './planningInteractionOperators'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import type { PlanningAccountSnapshot, PlanningBaseline } from './planningDpsContract'

export type PlanningContextMemberAsset = {
  agentId: string
  level: number
  mindscape: number
  potential: number | null
  skillLevels: Record<string, number>
  wEngine: {
    copyId: string
    engineId: string
    level: number
    refinement: number
  }
  discs: Array<{
    id: string
    slot: number
    setId: string
    level: number
    statsHash: string
  }>
  finalStatsHash: string
  evidenceRefs: string[]
}

export type PlanningEventUsage = {
  ownerAgentId: string
  eventId: string
  skillLevel: number
  occurrenceCount: number
  evidenceRefs: string[]
}

export type PlanningEffectDisposition = {
  effectKey: string
  disposition: 'included' | 'excluded' | 'excluded_unknown'
  activeSeconds: number
  targetAgentId: string | null
  reason: string
  evidenceRefs: string[]
}

export type PlanningCalculationContextCompilerInput = {
  contextId: string
  gameVersion: string
  canonical: CalculationContextInput['canonical']
  accountSnapshot: PlanningAccountSnapshot
  baseline: PlanningBaseline
  memberIds: [string, string, string]
  bangboo: { id: string; level: number; coreLevel: number } | null
  assets: PlanningContextMemberAsset[]
  eventUsages: PlanningEventUsage[]
  effectDispositions: PlanningEffectDisposition[]
  interactionContracts?: PlanningInteractionContract[]
  requiredInteractionOperators?: PlanningInteractionOperator[]
  interactionAuthorityRequirement?:
    | 'source_backed_only'
    | 'allow_semantic_fixture'
    | 'structural_only'
  scenarioId: string
  constraintsHash: string
  equipmentBindingMode?: 'account_inventory' | 'scheme_parameters'
}

export type PlanningCalculationContextCompilation =
  | {
      status: 'supported'
      context: CalculationContext
      eventScheduleHash: string
      effectStateHash: string
      assetBindingHash: string
      effectBlueprintHash: string
      interactionStateHash: string
      interactionOperatorCoverage: PlanningInteractionOperator[]
    }
  | { status: 'unsupported'; blockers: string[]; inputHash: string }

function validPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function expectedTargetAgentId(
  blueprint: CurrentAgentPlanningEffectBlueprint,
  disposition: PlanningEffectDisposition,
  memberIds: readonly string[],
) {
  if (!blueprint.targetKinds.includes('active_agent')) return disposition.targetAgentId === null
  return (
    disposition.disposition !== 'included' ||
    (disposition.targetAgentId !== null && memberIds.includes(disposition.targetAgentId))
  )
}

/**
 * Compiles one explicit fixed-event team model into the existing CalculationContext.
 * It deliberately does not choose a rotation, equipment or effect state. Those
 * facts must be provided by the same Decision Run and become part of the hashes.
 */
export function compilePlanningCalculationContext(
  input: PlanningCalculationContextCompilerInput,
): PlanningCalculationContextCompilation {
  const blockers: string[] = []
  const equipmentBindingMode = input.equipmentBindingMode ?? 'account_inventory'
  const inputHash = stableContentHash(input)
  const legalFormation = auditLegalFormationNumericOperands(
    input.memberIds,
    input.bangboo?.id ?? null,
  )
  if (legalFormation.status === 'unsupported') blockers.push(...legalFormation.blockers)

  if (input.gameVersion !== input.baseline.gameVersion)
    blockers.push('PlanningBaseline 与 CalculationContext 游戏版本不一致。')
  if (input.canonical.gameVersion !== input.gameVersion)
    blockers.push('Canonical package 与 CalculationContext 游戏版本不一致。')
  if (input.accountSnapshot.stale) blockers.push('账户资产快照已过期。')
  input.memberIds.forEach((agentId) => {
    if (!input.accountSnapshot.ownedAgentIds.includes(agentId))
      blockers.push(`账户快照不拥有计算成员：${agentId}`)
  })
  if (
    equipmentBindingMode === 'account_inventory' &&
    input.bangboo &&
    !input.accountSnapshot.ownedBangbooIds.includes(input.bangboo.id)
  )
    blockers.push(`账户快照不拥有计算邦布：${input.bangboo.id}`)

  const assetByAgent = new Map(input.assets.map((asset) => [asset.agentId, asset]))
  if (assetByAgent.size !== input.assets.length) blockers.push('成员资产绑定存在重复代理人。')
  input.memberIds.forEach((agentId) => {
    const asset = assetByAgent.get(agentId)
    if (!asset) {
      blockers.push(`成员缺少实体装备与 finalStats：${agentId}`)
      return
    }
    if (!validPositiveInteger(asset.level)) blockers.push(`成员等级无效：${agentId}`)
    if (!Number.isInteger(asset.mindscape) || asset.mindscape < 0 || asset.mindscape > 6)
      blockers.push(`成员影画等级无效：${agentId}`)
    if (
      !validPositiveInteger(asset.wEngine.level) ||
      !validPositiveInteger(asset.wEngine.refinement)
    )
      blockers.push(`成员音擎等级或精炼无效：${agentId}`)
    if (asset.discs.length !== 6 || new Set(asset.discs.map((disc) => disc.id)).size !== 6)
      blockers.push(`成员没有六张不同实体驱动盘：${agentId}`)
    if (new Set(asset.discs.map((disc) => disc.slot)).size !== 6)
      blockers.push(`成员驱动盘位不完整：${agentId}`)
    if (!asset.finalStatsHash || asset.evidenceRefs.length === 0)
      blockers.push(`成员 finalStats 缺少 hash 或账户证据：${agentId}`)
  })
  const allDiscIds = input.assets.flatMap((asset) => asset.discs.map((disc) => disc.id))
  if (new Set(allDiscIds).size !== allDiscIds.length)
    blockers.push('同一实体驱动盘不能由多个队伍成员共用。')
  const copyIds = input.assets.map((asset) => asset.wEngine.copyId)
  if (equipmentBindingMode === 'account_inventory' && new Set(copyIds).size !== copyIds.length)
    blockers.push('同一实体音擎副本不能由多个队伍成员共用。')

  const eventKeys = input.eventUsages.map((usage) => `${usage.ownerAgentId}:${usage.eventId}`)
  if (new Set(eventKeys).size !== eventKeys.length) blockers.push('固定事件集存在重复事件。')
  input.eventUsages.forEach((usage) => {
    const contract = getCurrentAgentEventContract(usage.ownerAgentId)
    const event = contract?.eventContract.events.find((item) => item.eventId === usage.eventId)
    const asset = assetByAgent.get(usage.ownerAgentId)
    if (!input.memberIds.includes(usage.ownerAgentId))
      blockers.push(`事件 owner 不属于计算队伍：${usage.ownerAgentId}`)
    if (!event) blockers.push(`固定事件不存在：${usage.ownerAgentId}:${usage.eventId}`)
    if (!validPositiveInteger(usage.occurrenceCount))
      blockers.push(`事件次数必须是正整数：${usage.ownerAgentId}:${usage.eventId}`)
    if (!validPositiveInteger(usage.skillLevel))
      blockers.push(`事件技能等级无效：${usage.ownerAgentId}:${usage.eventId}`)
    if (event && asset?.skillLevels[event.skill] !== usage.skillLevel)
      blockers.push(`事件技能等级与成员资产快照不一致：${usage.ownerAgentId}:${event.skill}`)
    if (usage.evidenceRefs.length === 0)
      blockers.push(`事件次数缺少 PlanningBaseline 证据：${usage.ownerAgentId}:${usage.eventId}`)
  })
  input.memberIds.forEach((agentId) => {
    if (!input.eventUsages.some((usage) => usage.ownerAgentId === agentId))
      blockers.push(`固定事件集未包含成员事件：${agentId}`)
  })

  const effectBlueprintResult = compileFormationPlanningEffectBlueprints(input.memberIds)
  if (effectBlueprintResult.status === 'unsupported')
    blockers.push(...effectBlueprintResult.blockers)
  const effectBlueprints =
    effectBlueprintResult.status === 'supported' ? effectBlueprintResult.entries : []
  const dispositionByKey = new Map(
    input.effectDispositions.map((disposition) => [disposition.effectKey, disposition]),
  )
  if (dispositionByKey.size !== input.effectDispositions.length)
    blockers.push('队伍效果 disposition 存在重复 effectKey。')
  effectBlueprints.forEach((blueprint) => {
    const disposition = dispositionByKey.get(blueprint.effectKey)
    if (!disposition) {
      blockers.push(`队伍效果未声明 included/excluded：${blueprint.effectKey}`)
      return
    }
    if (disposition.evidenceRefs.length === 0 || !disposition.reason)
      blockers.push(`队伍效果 disposition 缺少依据：${blueprint.effectKey}`)
    if (
      !Number.isFinite(disposition.activeSeconds) ||
      disposition.activeSeconds < 0 ||
      disposition.activeSeconds > input.baseline.declaredDurationSeconds
    )
      blockers.push(`队伍效果覆盖时长无效：${blueprint.effectKey}`)
    if (disposition.disposition === 'included' && disposition.activeSeconds <= 0)
      blockers.push(`已计入队伍效果必须声明正覆盖时长：${blueprint.effectKey}`)
    if (disposition.disposition !== 'included' && disposition.activeSeconds !== 0)
      blockers.push(`未计入队伍效果的覆盖时长必须为 0：${blueprint.effectKey}`)
    if (!expectedTargetAgentId(blueprint, disposition, input.memberIds))
      blockers.push(`队伍效果 active-agent target 无效：${blueprint.effectKey}`)
  })
  input.effectDispositions
    .filter(
      (disposition) => !effectBlueprints.some((item) => item.effectKey === disposition.effectKey),
    )
    .forEach((disposition) => blockers.push(`队伍效果不属于当前成员：${disposition.effectKey}`))

  const sourceBackedOnly =
    (input.interactionAuthorityRequirement ?? 'source_backed_only') === 'source_backed_only'
  const interactionCompilation = sourceBackedOnly
    ? compileSourceBackedPlanningInteractionContracts({
        memberIds: input.memberIds,
        contracts: input.interactionContracts ?? [],
        requiredOperators: input.requiredInteractionOperators,
      })
    : compilePlanningInteractionContracts({
        contracts: input.interactionContracts ?? [],
        requiredOperators: input.requiredInteractionOperators,
      })
  if (interactionCompilation.status === 'unsupported')
    blockers.push(...interactionCompilation.blockers)
  for (const contract of input.interactionContracts ?? []) {
    if (sourceBackedOnly && contract.authority !== 'source_backed')
      blockers.push(`生产 CalculationContext 不接受 semantic fixture：${contract.contractId}`)
    const participantIds =
      contract.operator === 'timed_event_schedule'
        ? contract.events.map((event) => event.ownerAgentId)
        : contract.operator === 'resource_state_transition'
          ? contract.transitions.map((transition) => transition.ownerAgentId)
          : contract.operator === 'team_effect_resolution'
            ? [contract.ownerAgentId, ...contract.recipientAgentIds]
            : contract.operator === 'field_time_opportunity_cost'
              ? contract.allocations.map((allocation) => allocation.agentId)
              : contract.operator === 'off_field_shared_damage'
                ? contract.events.map((event) => event.ownerAgentId)
                : []
    participantIds
      .filter((agentId) => !input.memberIds.includes(agentId))
      .forEach((agentId) => blockers.push(`队伍交互参与者不属于 CalculationContext：${agentId}`))
    if (
      ('durationSeconds' in contract &&
        contract.durationSeconds !== input.baseline.declaredDurationSeconds) ||
      (contract.operator === 'resource_state_transition' &&
        contract.transitions.some(
          (transition) => transition.atSeconds > input.baseline.declaredDurationSeconds,
        ))
    )
      blockers.push(`队伍交互时间轴与 PlanningBaseline 不一致：${contract.contractId}`)
  }

  if (blockers.length) return { status: 'unsupported', blockers: unique(blockers), inputHash }

  const eventScheduleHash = stableContentHash(input.eventUsages)
  const effectStateHash = stableContentHash(input.effectDispositions)
  const assetBindingHash = stableContentHash(input.assets)
  const interactionStateHash = stableContentHash({
    contracts: input.interactionContracts ?? [],
    requiredOperators: input.requiredInteractionOperators ?? [],
  })
  const effectBlueprintHash =
    effectBlueprintResult.status === 'supported' ? effectBlueprintResult.blueprintHash : ''
  const requiredFor = ['formal_event_set_ready', 'formal_loadout_ready', 'formal_dps'] as const
  const evidenceStatus = input.canonical.status
  const context = createCalculationContext({
    schemaVersion: 'calculation-context-v2',
    contextId: input.contextId,
    gameVersion: input.gameVersion,
    canonical: input.canonical,
    accountSnapshot: {
      accountId: input.accountSnapshot.accountId,
      rosterHash: input.accountSnapshot.rosterHash,
      warehouseHash: input.accountSnapshot.warehouseHash,
      planningHash: input.accountSnapshot.planningHash,
      capturedAt: input.accountSnapshot.capturedAt,
      stale: input.accountSnapshot.stale,
    },
    scope: { kind: 'team', agentIds: input.memberIds },
    actors: input.memberIds.map((agentId) => {
      const asset = assetByAgent.get(agentId)!
      return {
        agentId,
        level: asset.level,
        mindscape: asset.mindscape,
        potential: asset.potential,
        skillLevels: asset.skillLevels,
        wEngine: {
          id: asset.wEngine.engineId,
          level: asset.wEngine.level,
          refinement: asset.wEngine.refinement,
        },
        discs: asset.discs,
        finalStatsHash: asset.finalStatsHash,
      }
    }),
    bangboo: input.bangboo,
    scenario: {
      playModeId: 'planning-static-event-bundle',
      scenarioId: input.scenarioId,
      scenarioHash: stableContentHash({ baseline: input.baseline, scenarioId: input.scenarioId }),
      enemy: {
        id: input.baseline.enemy.id,
        level: null,
        defense: input.baseline.enemy.defense,
        resistance: input.baseline.enemy.resistance,
        stunMultiplier: input.baseline.enemy.stunMultiplier,
        vulnerability: input.baseline.enemy.vulnerability,
      },
    },
    cycle: {
      id: `${input.baseline.baselineId}:fixed-event-set`,
      durationSeconds: input.baseline.declaredDurationSeconds,
      actionSequenceHash: eventScheduleHash,
      hitCount: input.eventUsages.reduce((sum, usage) => sum + usage.occurrenceCount, 0),
      buffWindowHash: effectStateHash,
      complete: true,
    },
    objective: 'formal_dps',
    constraintsHash: stableContentHash({
      constraintsHash: input.constraintsHash,
      equipmentBindingMode,
      assetBindingHash,
      eventScheduleHash,
      effectStateHash,
      effectBlueprintHash,
      interactionStateHash,
    }),
    evidence: [
      {
        fieldId: `planning-baseline:${input.baseline.baselineId}`,
        status: evidenceStatus,
        applicability: 'verified_current',
        sourceRefs: [input.baseline.formulaHash, input.baseline.sourcePackHash],
        sourceVersion: input.baseline.gameVersion,
        requiredFor: [...requiredFor],
        conflict: false,
        stale: false,
        reason: '具名 PlanningBaseline 冻结敌人、时长、公式与来源包。',
      },
      ...input.assets.map((asset) => ({
        fieldId: `asset-binding:${asset.agentId}`,
        status: evidenceStatus,
        applicability: 'verified_current' as const,
        sourceRefs: asset.evidenceRefs,
        sourceVersion: input.gameVersion,
        requiredFor: [...requiredFor],
        conflict: false,
        stale: false,
        reason:
          equipmentBindingMode === 'account_inventory'
            ? '当前 Decision Run 的实体音擎、六盘与 finalStats 绑定。'
            : '当前 Decision Run 的方案级音擎参数、六张实体盘与 finalStats 绑定；音擎不声明实体副本。',
      })),
      ...input.eventUsages.map((usage) => {
        const contract = getCurrentAgentEventContract(usage.ownerAgentId)!
        return {
          fieldId: `event-usage:${usage.ownerAgentId}:${usage.eventId}`,
          status: evidenceStatus,
          applicability: 'verified_current' as const,
          sourceRefs: unique([
            ...usage.evidenceRefs,
            `${contract.source.formulaPath}#${contract.source.formulaSha256}`,
          ]),
          sourceVersion: input.gameVersion,
          requiredFor: [...requiredFor],
          conflict: false,
          stale: false,
          reason: '固定事件 owner、技能等级与发生次数进入同一 PlanningBaseline。',
        }
      }),
      ...input.effectDispositions.map((disposition) => ({
        fieldId: `effect-disposition:${disposition.effectKey}`,
        status: evidenceStatus,
        applicability: 'verified_current' as const,
        sourceRefs: disposition.evidenceRefs,
        sourceVersion: input.gameVersion,
        requiredFor: [...requiredFor],
        conflict: false,
        stale: false,
        reason: disposition.reason,
      })),
      ...(input.interactionContracts ?? []).map((contract) => ({
        fieldId: `interaction-contract:${contract.contractId}`,
        status: evidenceStatus,
        applicability: 'verified_current' as const,
        sourceRefs: contract.sourceRefs,
        sourceVersion: input.gameVersion,
        requiredFor: [...requiredFor],
        conflict: false,
        stale: false,
        reason:
          contract.authority === 'source_backed'
            ? `来源化队伍交互通过共享 operator：${contract.operator}。`
            : `语义 fixture 仅验证共享 operator：${contract.operator}；不得进入生产数值。`,
      })),
    ],
  })
  return {
    status: 'supported',
    context,
    eventScheduleHash,
    effectStateHash,
    assetBindingHash,
    effectBlueprintHash,
    interactionStateHash,
    interactionOperatorCoverage:
      interactionCompilation.status === 'supported'
        ? (('coveredOperators' in interactionCompilation
            ? interactionCompilation.coveredOperators
            : interactionCompilation.compilation.coveredOperators) as PlanningInteractionOperator[])
        : [],
  }
}
