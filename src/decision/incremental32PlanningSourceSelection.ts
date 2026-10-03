import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { stableContentHash } from '../gameDataPacks/types'
import { developmentSourceAction32 } from './developmentSourceAction32'
import { reviewedPreparedTeamConditions32 } from '../calculation/reviewedPreparedTeamBenchmark32'

/** One selection for existing personal/team consumers. It replaces the new
 * actors' heuristic repeated action with the already reviewed source packet;
 * it does not combine those packets into a certified combat rotation. */
export function compileIncremental32PlanningSourceSelection(input: {
  members: readonly PlanningEffectRuntimeMember[]
  eventUsages: readonly PlanningEventUsage[]
}) {
  const blockers: string[] = []
  const preparedTrio = ['agent-claret', 'agent-roxy', 'agent-koleda'].every((id) =>
    input.members.some((member) => member.agentId === id),
  )
  const selections = input.members.flatMap((member) => {
    // Keep older team event policies intact. Koleda's new personal model joins
    // this one explicitly prepared trio; it is not a global legacy rewrite.
    if (member.agentId === 'agent-koleda' && !preparedTrio) return []
    const selected = developmentSourceAction32(member)
    if (!selected) return []
    if (selected.status !== 'supported') {
      blockers.push(...selected.blockers)
      return []
    }
    return [{ agentId: member.agentId, selected }]
  })
  const selectedIds = new Set(selections.map((row) => row.agentId))
  const eventUsages = [
    ...input.eventUsages.filter((row) => !selectedIds.has(row.ownerAgentId)),
    ...selections.flatMap((row) => row.selected.eventUsages),
  ]
  const referencesByAgentId: Record<string, Readonly<Record<string, unknown>>> = {}
  const runtimeByAgentId: Record<string, CurrentWEngineFormulaRuntime> = {}
  for (const { agentId, selected } of selections) {
    if ('baselineReferences' in selected.runtimeInput && selected.runtimeInput.baselineReferences)
      referencesByAgentId[agentId] = selected.runtimeInput.baselineReferences
    if (selected.equipmentRuntime) runtimeByAgentId[agentId] = selected.equipmentRuntime
  }
  if (preparedTrio) {
    // Prior Maim preparation supplies this 40s self/team window. It is not
    // retroactively inferred from the first Maim in the counted event set.
    referencesByAgentId['agent-claret'] = {
      ...referencesByAgentId['agent-claret'],
      remnantEdge: true,
    }
    // This static direct-event model excludes anomaly settlements and assumes
    // no active Wind/Contamination window. Do not infer a proc from field time.
    referencesByAgentId['agent-roxy'] = {
      ...referencesByAgentId['agent-roxy'],
      roxyPreparedHeld32: 'claret_roxy_koleda',
      contamination: false,
      windswept: false,
      exSpecialUsed: true,
    }
  }
  const sourcePackets = selections.map(({ agentId, selected }) => ({
    agentId,
    policyId: selected.policyId,
    identity: selected.identity,
    boundary: selected.boundary,
    resourceLegality: selected.resourceLegality,
  }))
  const value = {
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    blockers,
    eventUsages,
    referencesByAgentId,
    runtimeByAgentId,
    sourcePackets,
    preparedTeamConditions: preparedTrio ? reviewedPreparedTeamConditions32 : null,
    formalCyclePromotion: false as const,
  }
  return { ...value, fingerprint: stableContentHash(value) }
}
