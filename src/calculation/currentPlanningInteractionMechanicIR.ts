import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentDecisionMechanicContracts } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  compilePlanningInteractionContracts,
  type PlanningInteractionContract,
  type PlanningInteractionOperator,
} from './planningInteractionOperators'

export type PlanningInteractionMechanicReadiness =
  | 'source_fact_ready'
  | 'mechanic_contract_pending'
  | 'baseline_observation_required'
  | 'not_applicable'

type OperatorCapability = {
  operator: PlanningInteractionOperator
  readiness: PlanningInteractionMechanicReadiness
  sourceRefs: string[]
  resourceKeys?: string[]
  effectKeys?: string[]
  fieldTimeMode?: string
  conversionKinds?: string[]
  blockers: string[]
}

export type CurrentPlanningInteractionMechanicIR = {
  agentId: string
  capabilities: OperatorCapability[]
  requiredOperatorPattern: PlanningInteractionOperator[]
  patternId: string
  mechanicIrHash: string
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function hasBaselineObservationRef(sourceRefs: readonly string[]) {
  return sourceRefs.some(
    (sourceRef) =>
      sourceRef.startsWith('planning-baseline:') || sourceRef.startsWith('empirical-timeline:'),
  )
}

function sourceRefsForAgent(agentId: string) {
  const contract = currentAgentDecisionMechanicContracts.find((item) => item.agentId === agentId)
  if (!contract) throw new Error(`缺少 Decision Mechanic 合同：${agentId}`)
  const effectSource = contract.effectContract.source
  const resourceSource = contract.resourceContract?.source
  const fieldTimeSource = contract.fieldTimeContract?.source
  const specialInteractionSource = contract.specialInteractionContract?.source
  return {
    event: (() => {
      const eventContract = getCurrentAgentEventContract(agentId)
      return eventContract
        ? [
            `${eventContract.source.repository}@${eventContract.source.commit}`,
            `${eventContract.source.formulaPath}#${eventContract.source.formulaSha256}`,
          ]
        : []
    })(),
    effect: [
      `${effectSource.repository}@${effectSource.commit}`,
      `${effectSource.formulaPath}#${effectSource.formulaSha256}`,
    ],
    resource: resourceSource
      ? [
          `${resourceSource.packageId}:${resourceSource.profileId}`,
          `profile-hash:${resourceSource.profileHash}`,
          contract.resourceContract?.resourceFlow.evidenceLocator,
        ].flatMap((value) => (typeof value === 'string' && value.length > 0 ? [value] : []))
      : [],
    fieldTime: fieldTimeSource
      ? [fieldTimeSource.sourceId, fieldTimeSource.url, fieldTimeSource.locator].flatMap((value) =>
          typeof value === 'string' && value.length > 0 ? [value] : [],
        )
      : [],
    specialInteraction: specialInteractionSource
      ? [specialInteractionSource.sourceId, specialInteractionSource.locator].flatMap((value) =>
          typeof value === 'string' && value.length > 0 ? [value] : [],
        )
      : [],
  }
}

function compileAgentMechanicIR(agentId: string): CurrentPlanningInteractionMechanicIR {
  const contract = currentAgentDecisionMechanicContracts.find((item) => item.agentId === agentId)
  if (!contract) throw new Error(`缺少 Decision Mechanic 合同：${agentId}`)
  const refs = sourceRefsForAgent(agentId)
  const eventContract = getCurrentAgentEventContract(agentId)
  const resources = (contract.resourceContract?.resourceFlow.resources ?? []) as readonly {
    resource: string
  }[]
  const resourceKeys = resources.map((resource) => resource.resource)
  const effectKeys = contract.effectContract.effects.map(
    (effect) => `${agentId}:${effect.effectId}`,
  )
  const fieldTimeMode = contract.fieldTimeContract?.mode
  const resourceFlowStatus = contract.resourceContract?.resourceFlow.status
  const resourceParameterClassification =
    contract.resourceContract?.resourceFlow.parameterClassification
  const specialInteraction = contract.specialInteractionContract

  const capabilities: OperatorCapability[] = [
    {
      operator: 'timed_event_schedule',
      readiness: eventContract ? 'baseline_observation_required' : 'mechanic_contract_pending',
      sourceRefs: refs.event,
      blockers: eventContract
        ? ['缺本次 PlanningBaseline 的事件次数、时点与活跃时长。']
        : ['缺事件合同。'],
    },
    {
      operator: 'resource_state_transition',
      readiness:
        resourceKeys.length > 0 && resourceFlowStatus === 'compiled'
          ? 'baseline_observation_required'
          : resourceKeys.length > 0
            ? 'mechanic_contract_pending'
            : resourceParameterClassification === 'resource_candidate_incomplete'
              ? 'mechanic_contract_pending'
              : 'not_applicable',
      sourceRefs: refs.resource,
      resourceKeys,
      blockers:
        resourceKeys.length > 0 && resourceFlowStatus === 'compiled'
          ? ['缺本次 PlanningBaseline 的资源初值、增减时点与原因。']
          : resourceKeys.length > 0
            ? ['资源/状态名称与局部边界已归一，但 producer/consumer 转换仍不完整。']
            : resourceParameterClassification === 'resource_candidate_incomplete'
              ? ['已有资源信号但上下界或产消转换不足，尚不能归一为具名 resource contract。']
              : [],
    },
    {
      operator: 'team_effect_resolution',
      readiness: effectKeys.length > 0 ? 'baseline_observation_required' : 'not_applicable',
      sourceRefs: refs.effect,
      effectKeys,
      blockers:
        effectKeys.length > 0
          ? ['缺本次 PlanningBaseline 的激活、数值、持续时间、作用对象与窗口。']
          : [],
    },
    {
      operator: 'field_time_opportunity_cost',
      readiness: 'baseline_observation_required',
      sourceRefs: refs.fieldTime,
      fieldTimeMode,
      blockers: [
        fieldTimeMode
          ? '已有攻略 field-time mode 仅作规划启发；仍缺本次 PlanningBaseline 的秒数分配与切换成本。'
          : '旧 Team Engine field-time 权重不是实测秒数；仍缺本次 PlanningBaseline observation。',
      ],
    },
    {
      operator: 'off_field_shared_damage',
      readiness:
        fieldTimeMode === 'background' ? 'baseline_observation_required' : 'not_applicable',
      sourceRefs: refs.fieldTime,
      fieldTimeMode,
      blockers:
        fieldTimeMode === 'background'
          ? ['缺本次 PlanningBaseline 的后台触发次数、单次伤害与 own/shared 归属。']
          : [],
    },
    {
      operator: 'chain_ultimate_conversion',
      readiness: specialInteraction ? 'baseline_observation_required' : 'not_applicable',
      sourceRefs: refs.specialInteraction,
      conversionKinds: specialInteraction?.conversionKinds,
      blockers: specialInteraction
        ? ['已有来源化转换 capability；仍缺本次 PlanningBaseline 的初始事件数与实际转换次数。']
        : [],
    },
  ]
  const requiredOperatorPattern = capabilities
    .filter((capability) => capability.readiness !== 'not_applicable')
    .map((capability) => capability.operator)
    .sort()
  const patternId = `mechanic-pattern:${requiredOperatorPattern.join('+')}`
  return {
    agentId,
    capabilities,
    requiredOperatorPattern,
    patternId,
    mechanicIrHash: stableContentHash({ agentId, capabilities, requiredOperatorPattern }),
  }
}

export const currentPlanningInteractionMechanicIR = Object.freeze(
  currentAgentDecisionMechanicContracts.map((contract) => compileAgentMechanicIR(contract.agentId)),
)

const irByAgentId = new Map(
  currentPlanningInteractionMechanicIR.map((item) => [item.agentId, item]),
)

export function getCurrentPlanningInteractionMechanicIR(agentId: string) {
  return irByAgentId.get(agentId) ?? null
}

export function compileSourceBackedPlanningInteractionContracts(input: {
  memberIds: readonly string[]
  contracts: readonly PlanningInteractionContract[]
  requiredOperators?: readonly PlanningInteractionOperator[]
}) {
  const blockers: string[] = []
  const memberIR = input.memberIds.map((agentId) =>
    getCurrentPlanningInteractionMechanicIR(agentId),
  )
  input.memberIds.forEach((agentId, index) => {
    if (!memberIR[index]) blockers.push(`缺少 interaction Mechanic IR：${agentId}`)
  })
  for (const contract of input.contracts) {
    if (contract.authority !== 'source_backed')
      blockers.push(`Mechanic IR 编译器只接受 source-backed 合同：${contract.contractId}`)
    if (contract.sourceRefs.length === 0)
      blockers.push(`source-backed 合同缺来源引用：${contract.contractId}`)
    if (
      contract.operator !== 'chain_ultimate_conversion' &&
      !hasBaselineObservationRef(contract.sourceRefs)
    )
      blockers.push(`合同缺 PlanningBaseline observation 证据：${contract.contractId}`)
    if (contract.operator === 'timed_event_schedule') {
      for (const event of contract.events) {
        const eventContract = getCurrentAgentEventContract(event.ownerAgentId)
        if (!eventContract) {
          blockers.push(`事件 owner 缺机制合同：${event.ownerAgentId}`)
          continue
        }
        const eventId = event.eventKey.includes(':')
          ? event.eventKey.slice(event.eventKey.lastIndexOf(':') + 1)
          : event.eventKey
        if (!eventContract.eventContract.events.some((item) => item.eventId === eventId))
          blockers.push(`事件未由实体合同声明：${event.ownerAgentId}:${event.eventKey}`)
        const sourceRefs = getCurrentPlanningInteractionMechanicIR(
          event.ownerAgentId,
        )?.capabilities.find((item) => item.operator === contract.operator)?.sourceRefs
        if (!sourceRefs?.some((sourceRef) => contract.sourceRefs.includes(sourceRef)))
          blockers.push(`事件合同未引用 owner 的权威来源：${event.ownerAgentId}`)
      }
    }
    if (contract.operator === 'resource_state_transition') {
      if (contract.transitions.length === 0)
        blockers.push(`资源合同必须声明本次基线的增减时点：${contract.resourceKey}`)
      const owners = unique(contract.transitions.map((transition) => transition.ownerAgentId))
      const ownerCapabilities = owners.map((ownerAgentId) =>
        getCurrentPlanningInteractionMechanicIR(ownerAgentId)?.capabilities.find(
          (capability) => capability.operator === 'resource_state_transition',
        ),
      )
      const allowed = ownerCapabilities.some(
        (capability) =>
          capability?.resourceKeys?.includes(contract.resourceKey) &&
          capability.readiness === 'baseline_observation_required',
      )
      if (!allowed) blockers.push(`资源未由实体 Mechanic IR 声明：${contract.resourceKey}`)
      if (
        allowed &&
        !ownerCapabilities.some((capability) =>
          capability?.sourceRefs.some((sourceRef) => contract.sourceRefs.includes(sourceRef)),
        )
      )
        blockers.push(`资源合同未引用实体权威来源：${contract.resourceKey}`)
    }
    if (contract.operator === 'team_effect_resolution') {
      const capability = getCurrentPlanningInteractionMechanicIR(
        contract.ownerAgentId,
      )?.capabilities.find((item) => item.operator === 'team_effect_resolution')
      const allowed = capability?.effectKeys?.includes(contract.effectKey)
      if (!allowed) blockers.push(`队伍效果未由实体 Mechanic IR 声明：${contract.effectKey}`)
      if (
        allowed &&
        !capability?.sourceRefs.some((sourceRef) => contract.sourceRefs.includes(sourceRef))
      )
        blockers.push(`队伍效果未引用实体权威来源：${contract.effectKey}`)
    }
    if (contract.operator === 'field_time_opportunity_cost') {
      const allocationIds = unique(contract.allocations.map((allocation) => allocation.agentId))
      input.memberIds
        .filter((agentId) => !allocationIds.includes(agentId))
        .forEach((agentId) => blockers.push(`场上时间合同缺少队伍成员：${agentId}`))
      contract.allocations.forEach((allocation) => {
        const capability = getCurrentPlanningInteractionMechanicIR(
          allocation.agentId,
        )?.capabilities.find((item) => item.operator === 'field_time_opportunity_cost')
        if (!capability) blockers.push(`角色缺 field-time capability：${allocation.agentId}`)
      })
    }
    if (contract.operator === 'off_field_shared_damage') {
      contract.events.forEach((event) => {
        const capability = getCurrentPlanningInteractionMechanicIR(
          event.ownerAgentId,
        )?.capabilities.find((item) => item.operator === 'off_field_shared_damage')
        if (!capability || capability.readiness === 'not_applicable')
          blockers.push(`后台伤害 owner 未声明 background capability：${event.ownerAgentId}`)
        else if (
          !capability.sourceRefs.some((sourceRef) => contract.sourceRefs.includes(sourceRef))
        )
          blockers.push(`后台伤害合同未引用实体权威来源：${event.ownerAgentId}`)
      })
    }
    if (contract.operator === 'chain_ultimate_conversion') {
      const capabilities = memberIR.flatMap(
        (item) =>
          item?.capabilities.filter(
            (capability) =>
              capability.operator === 'chain_ultimate_conversion' &&
              capability.readiness === 'baseline_observation_required',
          ) ?? [],
      )
      if (capabilities.length === 0)
        blockers.push(`连携/终结技转换尚缺来源化实体 capability：${contract.contractId}`)
      else if (
        !capabilities.some((capability) =>
          capability.sourceRefs.some((sourceRef) => contract.sourceRefs.includes(sourceRef)),
        )
      )
        blockers.push(`连携/终结技转换未引用实体权威来源：${contract.contractId}`)
      if (!hasBaselineObservationRef(contract.sourceRefs))
        blockers.push(`转换合同缺 PlanningBaseline observation 证据：${contract.contractId}`)
    }
  }
  const inferredRequiredOperators = unique(
    memberIR.flatMap((item) => item?.requiredOperatorPattern ?? []),
  ) as PlanningInteractionOperator[]
  // A fixed-event PlanningBaseline declares which mechanics are actually selected.
  // When the caller supplies that applicability set, entity-level capabilities
  // remain available for validation but do not force unrelated mechanics into
  // the event bundle. Omitting the set preserves the conservative full-entity gate.
  const requiredOperators = input.requiredOperators
    ? unique(input.requiredOperators)
    : inferredRequiredOperators
  const compilation = compilePlanningInteractionContracts({
    contracts: [...input.contracts],
    requiredOperators: requiredOperators as PlanningInteractionOperator[],
  })
  if (compilation.status === 'unsupported') blockers.push(...compilation.blockers)
  return blockers.length
    ? { status: 'unsupported' as const, blockers: unique(blockers) }
    : {
        status: 'supported' as const,
        contracts: [...input.contracts],
        compilation,
        mechanicIrHash: stableContentHash(memberIR),
      }
}

const patternGroups = new Map<string, string[]>()
for (const item of currentPlanningInteractionMechanicIR) {
  const group = patternGroups.get(item.patternId) ?? []
  group.push(item.agentId)
  patternGroups.set(item.patternId, group)
}

const representativeTeams = [
  ['agent-remielle', 'agent-velina', 'agent-aria'],
  ['agent-yixuan', 'agent-lucia', 'agent-dialyn'],
  ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
  ['agent-pyrois', 'agent-norma', 'agent-sunna'],
] as const

export const currentPlanningInteractionMechanicIRAudit = Object.freeze({
  contract: 'soda-current-planning-interaction-mechanic-ir-audit/v1',
  entityCount: currentPlanningInteractionMechanicIR.length,
  sharedMechanicPatternCount: patternGroups.size,
  patterns: [...patternGroups].map(([patternId, agentIds]) => ({ patternId, agentIds })),
  sourceHardGapCount: 0,
  namedResourceEntityCount: currentPlanningInteractionMechanicIR.filter((item) =>
    item.capabilities.some(
      (capability) =>
        capability.operator === 'resource_state_transition' &&
        (capability.resourceKeys?.length ?? 0) > 0,
    ),
  ).length,
  resourceCalculationReadyEntityCount: currentAgentDecisionMechanicContracts.filter(
    (item) =>
      item.resourceContract?.resourceFlow.parameterClassification === 'named_resource_or_state' &&
      item.resourceContract.resourceFlow.status === 'compiled',
  ).length,
  partialResourceTransitionEntityCount: currentAgentDecisionMechanicContracts.filter(
    (item) =>
      item.resourceContract?.resourceFlow.parameterClassification === 'named_resource_or_state' &&
      item.resourceContract.resourceFlow.status !== 'compiled',
  ).length,
  incompleteResourceCandidateEntityCount: currentAgentDecisionMechanicContracts.filter(
    (item) =>
      item.resourceContract?.resourceFlow.parameterClassification ===
      'resource_candidate_incomplete',
  ).length,
  effectOrStateParameterOnlyEntityCount: currentAgentDecisionMechanicContracts.filter(
    (item) =>
      item.resourceContract?.resourceFlow.parameterClassification ===
      'effect_or_state_parameters_only',
  ).length,
  fieldTimeHeuristicSourceEntityCount: currentPlanningInteractionMechanicIR.filter((item) =>
    item.capabilities.some(
      (capability) =>
        capability.operator === 'field_time_opportunity_cost' && Boolean(capability.fieldTimeMode),
    ),
  ).length,
  fieldTimeBaselineObservationRequiredEntityCount: currentPlanningInteractionMechanicIR.length,
  specialInteractionCapabilityEntityCount: currentPlanningInteractionMechanicIR.filter((item) =>
    item.capabilities.some(
      (capability) =>
        capability.operator === 'chain_ultimate_conversion' &&
        capability.readiness === 'baseline_observation_required',
    ),
  ).length,
  representativeTeams: representativeTeams.map((memberIds) => ({
    memberIds,
    mechanicIrHashes: memberIds.map(
      (agentId) => getCurrentPlanningInteractionMechanicIR(agentId)?.mechanicIrHash ?? null,
    ),
    calculationReady: false,
    blockerKinds: [
      'baseline_event_bundle_pending',
      'effect_window_bundle_pending',
      'field_time_baseline_observation_pending',
    ],
  })),
  productionNumericReadyFormationCount: 0,
  dedicatedAdapterCount: 0,
  boundary:
    'Source Fact hard gap remains zero. Static facts compile into shared Mechanic IR patterns; guide/Team Engine field-time weights remain heuristics and never substitute for baseline seconds. Missing event timing, effect windows, partial resource transitions and baseline observations are calculation/engineering backlog, not data completeness. No per-entity or per-team adapter is introduced.',
})
