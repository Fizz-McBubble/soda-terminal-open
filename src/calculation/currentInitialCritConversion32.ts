import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

/** Evaluate only the pinned unconditional initial conversion; never mutate a panel. */
export function evaluateInitialCritConversion32(input: {
  agentId: string
  initialStats: { crit_dmg_: number } & Readonly<Record<string, unknown>>
}) {
  if (input.agentId !== 'agent-claret')
    return { status: 'supported' as const, critRate: 0, sourceRefs: [] as string[] }
  const blueprint = getCurrentAgentPlanningEffectBlueprint('agent-claret:core_initial_crit_')
  const contract = getCurrentAgentDecisionMechanicContract(input.agentId)
  if (!blueprint || !contract)
    return {
      status: 'unsupported' as const,
      blockers: ['Claret initial crit conversion source missing'],
    }
  const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
  if (extracted.status === 'unsupported') return extracted
  const evaluated = evaluateUpstreamExpressionIr(
    extracted.value as UpstreamExpressionIR,
    createPlanningExpressionDomainRuntime({
      references: {
        ...contract.effectContract.runtimeDefaults.references,
        ...Object.fromEntries(
          Object.entries(input.initialStats).map(([key, value]) => [`own.initial.${key}`, value]),
        ),
      },
      teamCounts: { specialty: {}, faction: {} },
      gates: {},
    }),
  )
  if (evaluated.status === 'unsupported') return evaluated
  if (typeof evaluated.value !== 'number' || !Number.isFinite(evaluated.value))
    return {
      status: 'unsupported' as const,
      blockers: ['Claret initial crit conversion must be finite'],
    }
  return {
    status: 'supported' as const,
    critRate: evaluated.value,
    sourceRefs: blueprint.sourceRefs,
  }
}
