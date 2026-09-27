import { stableContentHash } from '../gameDataPacks/types'
import { reviewedInlineAbilityEffectSources } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from './currentAgentMechanicContracts'
import { compileFormationPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import {
  reviewedPotentialEffectBlueprints,
  reviewedPotentialParameterBlueprints,
} from './reviewedPotentialEffectBlueprints'
import { compileCurrentPlanningBaselineTimelineContracts } from './currentPlanningBaselineObservations'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type { PlanningEffectDisposition } from './planningCalculationContextCompiler'
import type { PlanningInteractionContract } from './planningInteractionOperators'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

// Legacy reviewed expressions retain their source values, but only the shared
// per-event potential binding may activate them. A level is not action proof.
const potentialValueOnlyKeys = new Set(
  reviewedPotentialEffectBlueprints.map((entry) => entry.effectKey),
)

export type PlanningEffectRuntimeStats = {
  atk: number
  def: number
  hp: number
  crit_: number
  crit_dmg_: number
  anomMas: number
  anomProf: number
  impact: number
  pen_: number
  /** Flat penetration; pen_ is the separate fractional penetration ratio. */
  pen?: number
  /** Static damage bonus for this member's event attribute, as a fraction. */
  damageBonus?: number
  actionDamageBonuses?: Array<{ actionTypes: readonly string[]; value: number }>
  enerRegen: number
}

export type PlanningEffectRuntimeMember = {
  agentId: string
  mindscape: number
  /** Account potential image in its source 0..6 domain, when available. */
  potential?: number | null
  coreLevel: number
  skillLevels: Readonly<Record<string, number>>
  initialStats: PlanningEffectRuntimeStats
  finalStats: PlanningEffectRuntimeStats
}

/**
 * Binds the account's potential image for an expression runtime without
 * deriving a skill index or any effect value. The shared account helper only
 * supplies 6 for agents eligible for the image; other missing values are the
 * neutral 0 expression input.
 */
export function bindPlanningEffectRuntimePotentialReference(input: {
  agentId: string
  potential: number | null | undefined
  references: Readonly<Record<string, unknown>>
}): Record<string, unknown> {
  return {
    ...input.references,
    // This deliberate final binding prevents named baseline fixtures from
    // replacing an observed account value.
    'char.potential': resolvePotentialImage(input.agentId, input.potential) ?? 0,
  }
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function collectReferences(node: UpstreamExpressionIR, references: Set<string>) {
  if (node.kind === 'reference') references.add(node.path)
  else if (node.kind === 'call') {
    node.arguments.forEach((argument) => collectReferences(argument, references))
    if (node.receiver) collectReferences(node.receiver, references)
  } else if (node.kind === 'array')
    node.items.forEach((item) => collectReferences(item, references))
  else if (node.kind === 'object')
    node.entries.forEach((entry) => collectReferences(entry.value, references))
  else if (node.kind === 'property') collectReferences(node.receiver, references)
  else if (node.kind === 'element') {
    collectReferences(node.receiver, references)
    collectReferences(node.index, references)
  }
}

const requiredReferencesByExpression = new WeakMap<UpstreamExpressionIR, readonly string[]>()

function requiredReferences(expression: UpstreamExpressionIR) {
  const cached = requiredReferencesByExpression.get(expression)
  if (cached) return cached
  const references = new Set<string>()
  collectReferences(expression, references)
  const result = [...references]
  requiredReferencesByExpression.set(expression, result)
  return result
}

function effectReceiverMetadata(expression: UpstreamExpressionIR) {
  if (
    expression.kind !== 'call' ||
    !['add', 'addWithDmgType'].includes(expression.operator) ||
    expression.receiver?.kind !== 'reference'
  )
    return { receiverPath: null, damageType: null }
  const damageType =
    expression.operator === 'addWithDmgType' && expression.arguments[0]?.kind === 'literal'
      ? expression.arguments[0].value
      : null
  return {
    receiverPath: expression.receiver.path,
    damageType: typeof damageType === 'string' ? damageType : null,
  }
}

function teamCounts(memberIds: readonly string[]) {
  const specialty: Record<string, number> = {}
  const faction: Record<string, number> = {}
  const attribute: Record<string, number> = {}
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    if (!identity) continue
    specialty[identity.specialty] = (specialty[identity.specialty] ?? 0) + 1
    faction[identity.faction] = (faction[identity.faction] ?? 0) + 1
    attribute[identity.attribute] = (attribute[identity.attribute] ?? 0) + 1
  }
  return { specialty, faction, attribute }
}

function statReferences(
  prefix: 'own.initial' | 'own.final' | 'target.final',
  stats: PlanningEffectRuntimeStats,
) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [`${prefix}.${key}`, value]),
  )
}

function effectRuntimeReferences(input: {
  target: PlanningEffectRuntimeMember
  baseReferences: Readonly<Record<string, unknown>>
  requiredReferences: readonly string[]
}) {
  const references: Record<string, unknown> = {
    ...input.baseReferences,
    ...statReferences('target.final', input.target.finalStats),
  }
  // A named neutral PlanningBaseline explicitly leaves non-selected event and
  // state triggers off. Numeric conditions therefore resolve to 0; callers can
  // override any selected condition with baselineReferences.
  for (const reference of input.requiredReferences)
    if (!Object.hasOwn(references, reference) && !reference.startsWith('dm.'))
      references[reference] = 0
  return references
}

export function evaluateCurrentPlanningFormationEffects(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  return evaluateFormationEffects(input, compileFormationPlanningEffectBlueprints(input.memberIds))
}

function evaluateFormationEffects(
  input: Parameters<typeof evaluateCurrentPlanningFormationEffects>[0],
  blueprints: ReturnType<typeof compileFormationPlanningEffectBlueprints>,
) {
  const blockers: string[] = []
  for (const member of input.members) {
    if (
      member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6)
    )
      blockers.push(`潜能等级须为0至6的整数：${member.agentId}`)
  }
  const memberById = new Map(input.members.map((member) => [member.agentId, member]))
  if (memberById.size !== input.members.length) blockers.push('效果运行时成员重复。')
  input.memberIds.forEach((agentId) => {
    if (!memberById.has(agentId)) blockers.push(`效果运行时缺少成员：${agentId}`)
  })
  if (blueprints.status === 'unsupported') blockers.push(...blueprints.blockers)
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }

  const counts = teamCounts(input.memberIds)
  const parameters = reviewedPotentialParameterBlueprints.filter((entry) =>
    input.memberIds.includes(entry.providerAgentId),
  )
  const parameterKeys = new Set(parameters.map((entry) => entry.effectKey))
  const entries = [...(blueprints.status === 'supported' ? blueprints.entries : []), ...parameters]
  const providerRuntimeByAgentId = new Map(
    input.memberIds.flatMap((agentId) => {
      const provider = memberById.get(agentId)!
      const contract = getCurrentAgentDecisionMechanicContract(agentId)
      if (!contract) return []
      const activation = evaluateCurrentAgentTeamActivation({
        stableId: agentId,
        memberIds: input.memberIds,
        agentState: { mindscape: provider.mindscape },
      })
      return [
        [
          agentId,
          {
            activation,
            baseReferences: bindPlanningEffectRuntimePotentialReference({
              agentId,
              potential: provider.potential,
              references: {
                ...contract.effectContract.runtimeDefaults.references,
                'char.mindscape': provider.mindscape,
                'char.core': Math.max(0, provider.coreLevel - 1),
                'char.basic': Math.max(0, (provider.skillLevels.basic ?? 1) - 1),
                'char.dodge': Math.max(0, (provider.skillLevels.dodge ?? 1) - 1),
                'char.assist': Math.max(0, (provider.skillLevels.assist ?? 1) - 1),
                'char.special': Math.max(0, (provider.skillLevels.special ?? 1) - 1),
                'char.chain': Math.max(0, (provider.skillLevels.chain ?? 1) - 1),
                'team.common.count': {},
                ...Object.fromEntries(
                  Object.entries(counts.attribute).map(([key, value]) => [
                    `team.common.count.${key}`,
                    value,
                  ]),
                ),
                ...statReferences('own.initial', provider.initialStats),
                ...statReferences('own.final', provider.finalStats),
                ...(input.baselineReferencesByAgentId?.[agentId] ?? {}),
              },
            }),
          },
        ] as const,
      ]
    }),
  )
  const evaluatedEntries = entries.map((blueprint) => {
    const provider = memberById.get(blueprint.providerAgentId)!
    const target =
      input.members.find((member) => member.agentId !== blueprint.providerAgentId) ?? provider
    const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
    if (extracted.status === 'unsupported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: extracted.blockers,
      }
    const expression = extracted.value as UpstreamExpressionIR
    const metadata = effectReceiverMetadata(blueprint.numericExpression.expressionIr)
    const isUnboundGenericPlaceholder =
      blueprint.numericExpression.sourceStatus === 'declarative_baseline_input' &&
      !parameterKeys.has(blueprint.effectKey) &&
      !potentialValueOnlyKeys.has(blueprint.effectKey)
    if (isUnboundGenericPlaceholder) {
      const provided = input.baselineReferencesByAgentId?.[blueprint.providerAgentId] ?? {}
      const required = new Set(requiredReferences(expression))
      const selectedReferences = Object.keys(provided).filter((reference) =>
        required.has(reference),
      )
      if (selectedReferences.length > 0)
        return {
          effectKey: blueprint.effectKey,
          status: 'unsupported' as const,
          blockers: [`通用占位效果缺少具体来源事实，不能选择：${selectedReferences.join(', ')}`],
        }
      return {
        effectKey: blueprint.effectKey,
        providerAgentId: blueprint.providerAgentId,
        targetKinds: blueprint.targetKinds,
        receiverPath: metadata.receiverPath,
        damageType: metadata.damageType,
        status: 'excluded_unknown' as const,
        active: false as const,
        todoBoundary: blueprint.numericExpression.todoBoundary,
        sourceRefs: blueprint.sourceRefs,
      }
    }
    const providerRuntime = providerRuntimeByAgentId.get(blueprint.providerAgentId)
    if (!providerRuntime)
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: [`效果运行时缺少机制合同：${provider.agentId}`],
      }
    const references = effectRuntimeReferences({
      target,
      baseReferences: providerRuntime.baseReferences,
      requiredReferences: requiredReferences(expression),
    })
    const reviewedAbilitySource = reviewedInlineAbilityEffectSources[blueprint.effectKey]
    const blockedByReviewedAbility =
      reviewedAbilitySource &&
      providerRuntime.activation.status === 'supported' &&
      !providerRuntime.activation.active
    const evaluated = evaluateUpstreamExpressionIr(
      blockedByReviewedAbility ? { kind: 'literal', value: 0 } : expression,
      createPlanningExpressionDomainRuntime({
        references,
        teamCounts: { specialty: counts.specialty, faction: counts.faction },
        gates: {
          ability:
            providerRuntime.activation.status === 'supported' && providerRuntime.activation.active,
          directStrike: Boolean(references.directStrike),
          besiege: Boolean(references.besiege),
          besiegeDisplay: Boolean(references.besiegeDisplay),
        },
      }),
    )
    if (evaluated.status === 'unsupported')
      return {
        effectKey: blueprint.effectKey,
        status: 'unsupported' as const,
        blockers: evaluated.blockers,
      }
    return {
      effectKey: blueprint.effectKey,
      providerAgentId: blueprint.providerAgentId,
      targetKinds: blueprint.targetKinds,
      receiverPath: metadata.receiverPath,
      damageType: metadata.damageType,
      status: 'supported' as const,
      value: evaluated.value,
      active:
        !potentialValueOnlyKeys.has(blueprint.effectKey) &&
        typeof evaluated.value === 'number' &&
        evaluated.value !== 0,
      todoBoundary: blueprint.numericExpression.todoBoundary,
      sourceRefs: reviewedAbilitySource
        ? [...blueprint.sourceRefs, reviewedAbilitySource]
        : blueprint.sourceRefs,
    }
  })
  // Numeric source parameters are visible to shared consumers but cannot
  // enter effect windows or ordinary damage until their semantics are bound.
  const potentialParameters = evaluatedEntries.filter((entry) => parameterKeys.has(entry.effectKey))
  const results = evaluatedEntries.filter((entry) => !parameterKeys.has(entry.effectKey))
  const runtimeBlockers = evaluatedEntries.flatMap((result) =>
    result.status === 'unsupported'
      ? result.blockers.map((blocker) => `${result.effectKey}: ${blocker}`)
      : [],
  )
  return runtimeBlockers.length
    ? { status: 'unsupported' as const, blockers: unique(runtimeBlockers), results }
    : {
        status: 'supported' as const,
        results,
        potentialParameters,
        runtimeHash: stableContentHash({
          memberIds: input.memberIds,
          results,
          potentialParameters,
        }),
      }
}

export function createLevel60NeutralEffectRuntimeMember(
  agentId: string,
): PlanningEffectRuntimeMember {
  const contract = getCurrentAgentEventContract(agentId)
  if (!contract) throw new Error(`缺少角色事件合同：${agentId}`)
  const base = contract.baseStats
  const stats: PlanningEffectRuntimeStats = {
    atk: base.atk_base + base.atk_growth * 59,
    def: base.def_base + base.def_growth * 59,
    hp: base.hp_base + base.hp_growth * 59,
    crit_: 0.05,
    crit_dmg_: 0.5,
    anomMas: base.anomMas,
    anomProf: base.anomProf,
    impact: base.impact,
    pen_: 0,
    enerRegen: base.enerRegen,
  }
  return {
    agentId,
    mindscape: 0,
    // Frozen neutral fixtures must not inherit the eligible-agent default.
    potential: 0,
    coreLevel: 1,
    skillLevels: { basic: 1, dodge: 1, assist: 1, special: 1, chain: 1, core: 1 },
    initialStats: stats,
    finalStats: stats,
  }
}

export function compileCurrentPlanningFormationEffectObservations(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  const blueprints = compileFormationPlanningEffectBlueprints(input.memberIds)
  const runtime = evaluateFormationEffects(input, blueprints)
  if (runtime.status === 'unsupported') return runtime
  const timeline = compileCurrentPlanningBaselineTimelineContracts(input.memberIds)
  if (timeline.status === 'unsupported') return timeline
  if (blueprints.status === 'unsupported') return blueprints
  const blueprintByKey = new Map(blueprints.entries.map((entry) => [entry.effectKey, entry]))
  const fieldTime = timeline.contracts.find(
    (contract) => contract.operator === 'field_time_opportunity_cost',
  )
  if (fieldTime?.operator !== 'field_time_opportunity_cost')
    return { status: 'unsupported' as const, blockers: ['PlanningBaseline 缺 field-time 合同。'] }
  const activeAgentId = fieldTime.allocations.toSorted(
    (left, right) => right.activeSeconds - left.activeSeconds,
  )[0]!.agentId
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:effects`
  const dispositions: PlanningEffectDisposition[] = []
  const contracts: PlanningInteractionContract[] = []
  const blockers: string[] = []
  for (const result of runtime.results) {
    if (result.status === 'unsupported') {
      blockers.push(...result.blockers.map((blocker) => `${result.effectKey}: ${blocker}`))
      continue
    }
    const blueprint = blueprintByKey.get(result.effectKey)!
    if (result.status === 'excluded_unknown') {
      dispositions.push({
        effectKey: result.effectKey,
        disposition: 'excluded_unknown',
        activeSeconds: 0,
        targetAgentId: null,
        reason:
          'The upstream generic conditional has no reviewed source-bound selection, so its value is unknown and excluded from this comparison.',
        evidenceRefs: unique([...result.sourceRefs, baselineRef]),
      })
      continue
    }
    if (result.active && result.todoBoundary) {
      blockers.push(
        `${result.effectKey}: 上游 TODO 条件被选中，必须显式补齐 declarative contract。`,
      )
      continue
    }
    const targetAgentId = blueprint.targetKinds.includes('active_agent') ? activeAgentId : null
    const evidenceRefs = unique([...result.sourceRefs, baselineRef])
    dispositions.push({
      effectKey: result.effectKey,
      disposition: result.active ? 'included' : 'excluded',
      activeSeconds: result.active ? currentNormalizedPlanningBaseline.declaredDurationSeconds : 0,
      targetAgentId,
      reason: result.active
        ? 'The neutral fixed-event baseline resolves this source expression to a non-zero value for the full declared comparison window.'
        : 'The neutral fixed-event baseline leaves this condition inactive or the account gate evaluates to zero.',
      evidenceRefs,
    })
    if (!result.active) continue
    const recipientAgentIds = blueprint.targetKinds.includes('self')
      ? [result.providerAgentId]
      : blueprint.targetKinds.includes('active_agent')
        ? [activeAgentId]
        : [...input.memberIds]
    contracts.push({
      contractId: `${currentNormalizedPlanningBaseline.baselineId}:${result.effectKey}`,
      operator: 'team_effect_resolution',
      authority: 'source_backed',
      sourceRefs: evidenceRefs,
      effectKey: result.effectKey,
      ownerAgentId: result.providerAgentId,
      recipientAgentIds: unique(recipientAgentIds),
      snapshotPolicy: 'recompute_per_event',
      value: result.value as number,
      durationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      windows: [
        {
          startSeconds: 0,
          endSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
        },
      ],
    })
  }
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const requiredOperators = contracts.length > 0 ? (['team_effect_resolution'] as const) : []
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds: input.memberIds,
    contracts,
    requiredOperators,
  })
  if (compilation.status === 'unsupported') return compilation
  return {
    status: 'supported' as const,
    dispositions,
    contracts,
    sourceCompilation: compilation,
    effectObservationHash: stableContentHash({ dispositions, contracts }),
  }
}
