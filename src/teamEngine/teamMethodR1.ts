import { bangbooStarForId } from './contracts'
import { requiredAgentResources } from './teamResourceRequirements'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import type {
  AgentRule,
  BangbooStar,
  BangbooStarsById,
  BangbooSelection,
  BangbooTeamObjective,
  BangbooRule,
  PairSynergyKernel,
  TeamEngineFailure,
  TeamEngineTraceStep,
  TeamPredicate,
} from './contracts'

export const TEAM_METHOD_R1_CONTRACT = 'soda-team-method/r1' as const

export type TeamMethodR1KernelDefinition = {
  currentVersion: string
  identity: Pick<PairSynergyKernel, 'kernelId' | 'familyId' | 'label'>
  formation: Pick<
    PairSynergyKernel,
    'coreAgentIds' | 'eligibleThirdAgentIds' | 'allowedInactiveAdditionalAbilityAgentIds'
  >
  mechanismClosure: Pick<PairSynergyKernel, 'requiredTeamPredicates' | 'requiredProducedTags'>
  effectCoverage: Pick<PairSynergyKernel, 'requiredEffectTags'>
  scenarios: Pick<PairSynergyKernel, 'scenarioTags'>
  currentStrength: PairSynergyKernel['strengthEvidence']
}

export type TeamMethodR1FormationResult = {
  contract: typeof TEAM_METHOD_R1_CONTRACT
  status: 'closed' | 'limited' | 'blocked'
  bangboo: BangbooRule | null
  bangbooStar: BangbooStar | null
  bangbooSelection: BangbooSelection
  bangbooTeamObjective: BangbooTeamObjective
  allowedInactiveAdditionalAbilityAgentIds: string[]
  failures: TeamEngineFailure[]
  trace: TeamEngineTraceStep[]
}

export type TeamContext = {
  agents: AgentRule[]
  producedTags: Set<string>
  agentStateById: Record<string, { mindscape?: number; potentialImage?: number | null }>
}

export function evaluateTeamPredicate(predicate: TeamPredicate, context: TeamContext): boolean {
  switch (predicate.kind) {
    case 'agent_present':
      return context.agents.some((agent) => agent.agentId === predicate.agentId)
    case 'specialty_count':
      return (
        context.agents.filter((agent) => agent.specialty === predicate.specialty).length >=
        predicate.minimum
      )
    case 'faction_count':
      return (
        context.agents.filter((agent) => agent.faction === predicate.faction).length >=
        predicate.minimum
      )
    case 'attribute_count':
      return (
        context.agents.filter((agent) => agent.attribute === predicate.attribute).length >=
        predicate.minimum
      )
    case 'distinct_attribute_count':
      return new Set(context.agents.map((agent) => agent.attribute)).size >= predicate.minimum
    case 'produced_tag':
      return context.producedTags.has(predicate.tag)
    case 'potential_minimum':
      return (
        (resolvePotentialImage(
          predicate.agentId,
          context.agentStateById[predicate.agentId]?.potentialImage,
        ) ?? 0) >= predicate.minimum
      )
    case 'category_sum_minimum': {
      const categoryContribution = new Set(
        context.agents
          .filter(
            (agent) =>
              agent.agentId !== predicate.agentId &&
              predicate.terms.some((term) => agent[term.kind] === term.value),
          )
          .map((agent) => agent.agentId),
      ).size
      if (categoryContribution >= predicate.minimum) return true
      const dynamicContribution = predicate.dynamicTerms.reduce((total, term) => {
        if (term.kind === 'self_state_minimum') {
          const value = context.agentStateById[predicate.agentId]?.[term.field]
          return typeof value === 'number' && value >= term.minimum
            ? total + term.contribution
            : total
        }
        const matched = context.agents.some(
          (agent) =>
            agent.agentId !== predicate.agentId && agent.capabilities?.includes(term.capability),
        )
        return matched ? total + term.contribution : total
      }, 0)
      return categoryContribution + dynamicContribution >= predicate.minimum
    }
    case 'all':
      return predicate.predicates.every((child) => evaluateTeamPredicate(child, context))
    case 'any':
      return predicate.predicates.some((child) => evaluateTeamPredicate(child, context))
  }
}

function selectBangboo(
  rules: BangbooRule[],
  candidateBangbooIds: ReadonlySet<string>,
  bangbooStarsById: BangbooStarsById | undefined,
  context: TeamContext,
  kernel: PairSynergyKernel,
) {
  const releasedCandidates = rules.filter(
    (rule) => rule.releaseState === 'released' && candidateBangbooIds.has(rule.bangbooId),
  )
  const activationUnknown = releasedCandidates.filter(
    (rule) => rule.activation.status === 'unknown',
  )
  const activated = releasedCandidates.filter((rule) => {
    const activation = rule.activation
    if (activation.status !== 'modeled') return false
    const predicate = effectiveBangbooActivationPredicate(
      rule.bangbooId,
      activation,
      bangbooStarForId(bangbooStarsById, rule.bangbooId),
    )
    return evaluateTeamPredicate(predicate, context)
  })
  if (!activated.length)
    return {
      rule: null,
      bangbooStar: null,
      selection: activationUnknown.length
        ? ({
            status: 'activation_unknown',
            bangbooIds: activationUnknown.map((rule) => rule.bangbooId),
          } satisfies BangbooSelection)
        : ({
            status: 'no_activation_match',
            bangbooIds: releasedCandidates.map((rule) => rule.bangbooId),
          } satisfies BangbooSelection),
    }

  const authoritative = activated
    .flatMap((rule) => {
      const suitability = rule.suitability
      if (suitability.status !== 'modeled') return []
      return [
        {
          rule,
          bangbooStar: bangbooStarForId(bangbooStarsById, rule.bangbooId),
          familyMatch: suitability.familyIds.includes(kernel.familyId) ? 1 : 0,
          scenarioMatch: suitability.scenarioTags.filter((tag) => kernel.scenarioTags.includes(tag))
            .length,
        },
      ]
    })
    .filter(({ familyMatch, scenarioMatch }) => familyMatch > 0 || scenarioMatch > 0)
  const unresolvedSuitability = activated.filter((rule) => rule.suitability.status === 'unknown')
  if (!authoritative.length && unresolvedSuitability.length === 1)
    return {
      rule: unresolvedSuitability[0]!,
      bangbooStar: bangbooStarForId(bangbooStarsById, unresolvedSuitability[0]!.bangbooId),
      selection: {
        status: 'compatible_fallback',
        bangbooId: unresolvedSuitability[0]!.bangbooId,
        bangbooStar: bangbooStarForId(bangbooStarsById, unresolvedSuitability[0]!.bangbooId),
        bangbooIds: [unresolvedSuitability[0]!.bangbooId],
      } satisfies BangbooSelection,
    }
  if (!authoritative.length)
    return {
      rule: null,
      bangbooStar: null,
      selection: {
        status: 'no_authoritative_recommendation',
        bangbooIds: activated.map((rule) => rule.bangbooId),
      } satisfies BangbooSelection,
    }
  const bestFamilyMatch = Math.max(...authoritative.map((item) => item.familyMatch))
  const familyBest = authoritative.filter((item) => item.familyMatch === bestFamilyMatch)
  const bestScenarioMatch = Math.max(...familyBest.map((item) => item.scenarioMatch))
  const best = familyBest.filter((item) => item.scenarioMatch === bestScenarioMatch)
  if (best.length !== 1)
    return {
      rule: null,
      bangbooStar: null,
      selection: {
        status: 'no_authoritative_recommendation',
        bangbooIds: best.map((item) => item.rule.bangbooId),
      } satisfies BangbooSelection,
    }
  const alternativeBangbooIds = authoritative
    .map((item) => item.rule.bangbooId)
    .filter((bangbooId) => bangbooId !== best[0]!.rule.bangbooId)
  return {
    rule: best[0]!.rule,
    bangbooStar: best[0]!.bangbooStar,
    selection: {
      status: 'selected',
      bangbooId: best[0]!.rule.bangbooId,
      bangbooStar: best[0]!.bangbooStar,
      ...(alternativeBangbooIds.length ? { alternativeBangbooIds } : {}),
    } satisfies BangbooSelection,
  }
}

export function effectiveBangbooActivationPredicate(
  bangbooId: string,
  activation: Extract<BangbooRule['activation'], { status: 'modeled' }>,
  bangbooStar: BangbooStar,
) {
  const thresholds = activation.factionCountMinimumByStar
  if (!thresholds) return activation.predicate
  if (activation.predicate.kind !== 'faction_count')
    throw new Error(
      `${bangbooId}: factionCountMinimumByStar 只能用于 reviewed faction_count activation。`,
    )
  const minimum =
    ([5, 4, 3, 2, 1] as const).find(
      (star) => star <= bangbooStar && thresholds[star] !== undefined,
    ) ?? null
  if (minimum === null)
    throw new Error(`${bangbooId}: factionCountMinimumByStar 必须覆盖 S1 基线。`)
  return { ...activation.predicate, minimum: thresholds[minimum]! }
}

function projectBangbooTeamObjective(
  selection: BangbooSelection,
  candidateBangbooIds: ReadonlySet<string>,
  rules: readonly BangbooRule[],
): BangbooTeamObjective {
  const primaryBangbooId =
    selection.status === 'selected' || selection.status === 'compatible_fallback'
      ? selection.bangbooId
      : null
  const alternatives =
    selection.status === 'selected'
      ? (selection.alternativeBangbooIds ?? [])
      : 'bangbooIds' in selection
        ? selection.bangbooIds.filter((bangbooId) => bangbooId !== primaryBangbooId)
        : []
  const status =
    selection.status === 'selected'
      ? 'supported'
      : selection.status === 'not_evaluated'
        ? 'unsupported'
        : 'partial'
  const primaryRule = primaryBangbooId
    ? rules.find((rule) => rule.bangbooId === primaryBangbooId)
    : null
  return {
    contract: 'soda-bangboo-team-objective/v2',
    status,
    basis: ['game_mechanic', 'activation', 'team_composition', 'effect_recipient_fit'],
    evidenceConfidence:
      primaryRule?.suitability.status === 'modeled' &&
      (primaryRule.suitability.validationEvidence?.length ?? 0) > 0
        ? 'mechanic_plus_external_validation'
        : primaryBangbooId || alternatives.length
          ? 'mechanic_derived'
          : 'insufficient',
    validationRole: 'confidence_only',
    primaryBangbooId,
    alternativeBangbooIds: alternatives,
    evaluatedBangbooIds: [...candidateBangbooIds].sort((left, right) => left.localeCompare(right)),
    explanation:
      status === 'supported'
        ? '按游戏机制、额外能力激活、队伍组成与效果承接选择主选和替代项；外部阵容证据只增强置信度。'
        : '现有机制推导只能保留候选方向，不能形成唯一主选；不以伤害或攻略打破并列。',
    boundary:
      '该目标不读取账户拥有状态，不使用邦布直接伤害，也不把具名攻略/社区阵容作为 suitability 的成立门；外部证据只提升 Evidence Confidence。',
  }
}

/**
 * Converts structured family facts into the existing Team Engine kernel contract.
 * It rejects definitions that try to establish current strength from limited-only evidence.
 */
export function defineTeamMethodKernel(
  definition: TeamMethodR1KernelDefinition,
): PairSynergyKernel {
  const { identity, formation, mechanismClosure, effectCoverage, scenarios, currentStrength } =
    definition
  if (new Set(formation.coreAgentIds).size !== 2)
    throw new Error(`${identity.kernelId}: Team Method requires two distinct core agents`)
  if (!formation.eligibleThirdAgentIds.length)
    throw new Error(`${identity.kernelId}: Team Method requires at least one eligible third agent`)
  if (
    !currentStrength.refs.some(
      (ref) =>
        ref.gameVersion === definition.currentVersion &&
        (ref.status === 'candidate' || ref.status === 'formal') &&
        ref.sourceId.length > 0 &&
        ref.locator.length > 0,
    )
  )
    throw new Error(
      `${identity.kernelId}: current strength requires current candidate/formal evidence`,
    )
  return {
    ...identity,
    ...formation,
    ...mechanismClosure,
    ...effectCoverage,
    ...scenarios,
    strengthEvidence: currentStrength,
  }
}

/** Shared mechanism/ability/rotation/effect/Bangboo gate used by every family. */
export function evaluateTeamMethodFormation(input: {
  kernel: PairSynergyKernel
  agents: [AgentRule, AgentRule, AgentRule]
  bangbooRules: BangbooRule[]
  bangbooCandidateIds?: ReadonlySet<string>
  bangbooStarsById?: BangbooStarsById
  /** @deprecated Compatibility input; use bangbooCandidateIds. */
  ownedBangbooIds?: ReadonlySet<string>
  fieldTimeBudget: number
  agentStateById?: Record<string, { mindscape?: number; potentialImage?: number | null }>
}): TeamMethodR1FormationResult {
  const { kernel, agents } = input
  const producedTags = new Set(agents.flatMap((agent) => agent.produces))
  const context = { agents, producedTags, agentStateById: input.agentStateById ?? {} }
  const failures: TeamEngineFailure[] = []
  const allowedInactiveAdditionalAbilityAgentIds: string[] = []
  const trace: TeamEngineTraceStep[] = [
    { stage: 'core', status: 'pass', detail: `已识别核心：${kernel.coreAgentIds.join(' + ')}。` },
    { stage: 'pair_synergy', status: 'pass', detail: kernel.strengthEvidence.claim },
  ]

  for (const agent of agents) {
    if (agent.releaseState !== 'released')
      failures.push({
        code: 'unreleased_agent',
        agentId: agent.agentId,
        detail: `${agent.name}尚未发布。`,
      })
    if (agent.additionalAbility.status === 'not_modeled') {
      failures.push({
        code: 'additional_ability_unverified',
        agentId: agent.agentId,
        detail: `${agent.name}追加能力尚未建模：${agent.additionalAbility.description}`,
      })
    } else if (
      agent.additionalAbility.status === 'modeled' &&
      !evaluateTeamPredicate(agent.additionalAbility.predicate, context)
    ) {
      // An inactive optional member benefit lowers the formation result but
      // does not make a source-backed three-person team illegal.
      allowedInactiveAdditionalAbilityAgentIds.push(agent.agentId)
    }
  }
  const hasAbilityFailure = failures.some(
    (failure) => failure.code === 'additional_ability_unverified',
  )
  trace.push({
    stage: 'additional_ability',
    status: hasAbilityFailure
      ? 'fail'
      : allowedInactiveAdditionalAbilityAgentIds.length
        ? 'limited'
        : 'pass',
    detail: hasAbilityFailure
      ? '存在尚未建模、无法核对的追加能力。'
      : allowedInactiveAdditionalAbilityAgentIds.length
        ? `下列成员追加能力未激活，队伍保留为有限结果：${allowedInactiveAdditionalAbilityAgentIds.join('、')}。`
        : '三名代理人的已建模追加能力均已激活。',
  })

  for (const predicate of kernel.requiredTeamPredicates) {
    if (!evaluateTeamPredicate(predicate, context))
      failures.push({ code: 'team_predicate_failed', detail: '双人核心的第三人闭环条件未满足。' })
  }
  for (const tag of kernel.requiredProducedTags) {
    if (!producedTags.has(tag))
      failures.push({ code: 'resource_loop_open', tag, detail: `缺少机制/资源产出：${tag}。` })
  }
  for (const agent of agents) {
    for (const tag of requiredAgentResources(agent.consumes)) {
      if (!producedTags.has(tag))
        failures.push({
          code: 'resource_loop_open',
          agentId: agent.agentId,
          tag,
          detail: `${agent.name}缺少所需资源：${tag}。`,
        })
    }
  }
  trace.push({
    stage: 'resource_loop',
    status: failures.some(
      (failure) =>
        failure.code === 'resource_loop_open' || failure.code === 'team_predicate_failed',
    )
      ? 'fail'
      : 'pass',
    detail: '已校验队伍触发器、产出与消费链。',
  })

  const effectTags = new Set(agents.flatMap((agent) => agent.effects.map((effect) => effect.tag)))
  for (const tag of kernel.requiredEffectTags) {
    if (!effectTags.has(tag))
      failures.push({
        code: 'effect_coverage_missing',
        tag,
        detail: `缺少必要 Buff/Debuff 覆盖：${tag}。`,
      })
  }
  trace.push({
    stage: 'effect_coverage',
    status: failures.some((failure) => failure.code === 'effect_coverage_missing')
      ? 'fail'
      : 'pass',
    detail: '已校验核心所需 Buff/Debuff 的可达性。',
  })

  const fieldTime = agents.reduce((sum, agent) => sum + agent.fieldTimeDemand, 0)
  if (fieldTime > input.fieldTimeBudget)
    failures.push({
      code: 'field_time_conflict',
      detail: `站场需求 ${fieldTime.toFixed(2)} 超过循环预算 ${input.fieldTimeBudget.toFixed(2)}。`,
    })
  trace.push({
    stage: 'rotation',
    status: fieldTime > input.fieldTimeBudget ? 'fail' : 'pass',
    detail: `站场需求 ${fieldTime.toFixed(2)} / 预算 ${input.fieldTimeBudget.toFixed(2)}。`,
  })

  const candidateBangbooIds =
    input.bangbooCandidateIds ?? input.ownedBangbooIds ?? new Set<string>()
  const bangbooResult = selectBangboo(
    input.bangbooRules,
    candidateBangbooIds,
    input.bangbooStarsById,
    context,
    kernel,
  )
  const bangboo = bangbooResult.rule
  const bangbooTeamObjective = projectBangbooTeamObjective(
    bangbooResult.selection,
    new Set(
      input.bangbooRules
        .filter(
          (rule) => rule.releaseState === 'released' && candidateBangbooIds.has(rule.bangbooId),
        )
        .map((rule) => rule.bangbooId),
    ),
    input.bangbooRules,
  )
  trace.push({
    stage: 'bangboo',
    status: bangbooResult.selection.status === 'selected' ? 'pass' : 'limited',
    detail:
      bangbooResult.selection.status === 'selected'
        ? `已依据游戏机制、队伍组成与效果承接选择邦布：${bangboo!.name}。`
        : bangbooResult.selection.status === 'compatible_fallback'
          ? `当前仅有 ${bangboo!.name} 满足激活条件，可作为兼容回退；效果承接关系仍待闭合。`
          : bangbooResult.selection.status === 'activation_unknown'
            ? '候选池中邦布的额外能力触发资料尚未建模，保留队伍方向。'
            : bangbooResult.selection.status === 'no_authoritative_recommendation'
              ? '候选池中有邦布可激活，但没有足够适配证据决定推荐，保留队伍方向。'
              : '默认候选池中没有满足队伍激活条件的邦布，保留队伍方向。',
  })

  return {
    contract: TEAM_METHOD_R1_CONTRACT,
    status:
      failures.length > 0
        ? 'blocked'
        : allowedInactiveAdditionalAbilityAgentIds.length > 0
          ? 'limited'
          : bangbooResult.selection.status === 'selected'
            ? 'closed'
            : 'limited',
    bangboo,
    bangbooStar: bangbooResult.bangbooStar,
    bangbooSelection: bangbooResult.selection,
    bangbooTeamObjective,
    allowedInactiveAdditionalAbilityAgentIds,
    failures,
    trace,
  }
}
