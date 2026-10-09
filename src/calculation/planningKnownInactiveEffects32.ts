import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { evaluateCurrentAgentTeamActivation } from './currentAgentMechanicContracts'
import {
  bindPlanningEffectRuntimePotentialReference,
  planningCharacterReferences32,
  teamCounts,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
import { reviewedInlineAbilityEffectSources } from '../gameDataPacks/reviewedTeammateActivationMinimum'
import { requiredReferences } from './currentPlanningEffectExpressions'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

/** Only factual growth, team activation and explicitly declared action conditions
 * may close a branch. Missing observations are deliberately absent, never zero.
 * No panel inputs are bound: a currently capped conversion is not an inactive effect. */
export function reduceObservedPlanningEffect32(
  entry: CurrentAgentPlanningEffectBlueprint,
  member: PlanningEffectRuntimeMember,
  observations: Readonly<Record<string, unknown>> = {},
  memberIds: readonly string[] = [member.agentId],
) {
  if (entry.numericExpression.sourceStatus !== 'upstream_expression_available') return null
  const contract = getCurrentAgentDecisionMechanicContract(member.agentId)
  const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
  if (!contract || extracted.status !== 'supported') return null
  const sourceReferences = contract.effectContract.runtimeDefaults.references as Readonly<
    Record<string, unknown>
  >
  const activation = evaluateCurrentAgentTeamActivation({
    stableId: member.agentId,
    memberIds,
    agentState: { mindscape: member.mindscape, potentialImage: member.potential },
  })
  if (
    reviewedInlineAbilityEffectSources[entry.effectKey] &&
    activation.status === 'supported' &&
    !activation.active
  )
    return { expression: { kind: 'literal', value: 0 } as UpstreamExpressionIR, inactive: true }
  const references = bindPlanningEffectRuntimePotentialReference({
    agentId: member.agentId,
    potential: member.potential,
    references: {
      ...Object.fromEntries(
        requiredReferences(extracted.value as UpstreamExpressionIR)
          .filter((key) => key.startsWith('dm.') && Object.hasOwn(sourceReferences, key))
          .map((key) => [key, sourceReferences[key]]),
      ),
      ...observations,
      'team.common.count': {},
      ...Object.fromEntries(
        Object.entries(teamCounts(memberIds).attribute).map(([key, value]) => [
          `team.common.count.${key}`,
          value,
        ]),
      ),
      ...planningCharacterReferences32(member),
    },
  })
  const gates: Record<string, boolean | undefined> = {
    abilityCheck: activation.status === 'supported' ? activation.active : undefined,
    ability_check: activation.status === 'supported' ? activation.active : undefined,
    directStrikeCheck:
      typeof observations.directStrike === 'boolean' ? observations.directStrike : undefined,
    besiege: typeof observations.besiege === 'boolean' ? observations.besiege : undefined,
    besiegeDisplay:
      typeof observations.besiegeDisplay === 'boolean' ? observations.besiegeDisplay : undefined,
  }
  const runtime = createPlanningExpressionDomainRuntime({
    references,
    teamCounts: teamCounts(memberIds),
  })
  runtime.operators = {
    ...runtime.operators,
    ...Object.fromEntries(
      Object.entries(gates).map(([key, value]) => [
        key,
        ({ arguments: args }: { receiver: unknown; arguments: unknown[] }) => {
          if (value === undefined) throw new Error('unknown_effect_gate')
          return value ? args[0] : (args[1] ?? 0)
        },
      ]),
    ),
  }
  const literalZero: UpstreamExpressionIR = { kind: 'literal', value: 0 }
  const read = (node: UpstreamExpressionIR) => {
    try {
      return evaluateUpstreamExpressionIr(node, runtime)
    } catch {
      return { status: 'unsupported' as const, blockers: ['unknown_effect_gate'] }
    }
  }
  const reduce = (node: UpstreamExpressionIR): UpstreamExpressionIR => {
    if (node.kind !== 'call') return node
    const args = node.arguments
    let enabled: boolean | undefined
    let offset = 0
    if (Object.hasOwn(gates, node.operator)) enabled = gates[node.operator]
    else if (['ifOn', 'ifOff'].includes(node.operator) && node.receiver) {
      const receiver = read(reduce(node.receiver))
      if (receiver.status === 'supported')
        enabled = node.operator === 'ifOn' ? Boolean(receiver.value) : !receiver.value
    } else if (/^cmp(GE|GT|LT|Eq|NE)$/.test(node.operator) && args.length >= 3) {
      const condition = read({
        ...node,
        arguments: [
          reduce(args[0]!),
          reduce(args[1]!),
          { kind: 'literal', value: true },
          { kind: 'literal', value: false },
        ],
      })
      if (condition.status === 'supported' && typeof condition.value === 'boolean')
        enabled = condition.value
      offset = 2
    }
    if (enabled !== undefined) return reduce(args[offset + (enabled ? 0 : 1)] ?? literalZero)
    return {
      ...node,
      ...(node.receiver ? { receiver: reduce(node.receiver) } : {}),
      arguments: args.map(reduce),
    }
  }
  const expression = reduce(extracted.value as UpstreamExpressionIR)
  const result = read(expression)
  return { expression, inactive: result.status === 'supported' && result.value === 0 }
}

export function knownInactivePlanningEffect32(
  ...input: Parameters<typeof reduceObservedPlanningEffect32>
): boolean {
  return reduceObservedPlanningEffect32(...input)?.inactive ?? false
}
