import { type StandardTeamReferenceSelection } from '../calculation/standardTeamReferenceEquipment'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import { type TargetTeamObjectiveContextInput } from './targetTeamAssignmentObjective'
import { resolveTargetTeamWEngineRuntime } from './targetTeamPlanningContextInput'
import type { PreparedTargetTeamStandardReferenceEquipment } from './standardTeamReferenceEquipment'
type ObjectiveInput = Omit<TargetTeamObjectiveContextInput, 'fit' | 'modifierProjection'>

export function materializeStandardTeamReferenceSelection(
  prepared: Omit<PreparedTargetTeamStandardReferenceEquipment, 'referenceInput'> & {
    referenceInput: ObjectiveInput
  },
  selections: readonly StandardTeamReferenceSelection[],
): TargetTeamObjectiveContextInput | null {
  const input = prepared.referenceInput
  if (selections.length !== 3 || new Set(selections.map((row) => row.agentId)).size !== 3)
    return null
  const runtimeDeclarations = selections.flatMap((row) => {
    const declaration = prepared.runtimeDeclarationsByAgentId?.[row.agentId]?.[row.engineId]
    return declaration ? [declaration] : []
  })
  const parameters = {
    ...input.parameters,
    wEngines: selections.map((row) => ({
      agentId: row.agentId,
      engineId: row.engineId,
      refinement: row.refinement,
      level: 60,
      ascension: 5,
    })),
  }
  const runtime = resolveTargetTeamWEngineRuntime({
    memberIds: input.candidate.memberIds,
    parameters,
    declarations: runtimeDeclarations,
  })
  if (runtime.status !== 'supported') return null
  for (const row of selections) {
    const member = prepared.members.find((member) => member.agentId === row.agentId)
    const branch = member?.branches.find((branch) => branch.identity === row.branchIdentity)
    if (
      !member ||
      member.referenceStateIdentity !== row.referenceStateIdentity ||
      !branch ||
      row.discs.some(
        (disc) =>
          !branch.discs.some(
            (template) =>
              template.slot === disc.slot &&
              template.mainStat === disc.mainStat &&
              template.setId === disc.setId,
          ),
      ) ||
      !member.engines.some(
        (engine) =>
          engine.engineId === row.engineId &&
          engine.refinement === row.refinement &&
          engine.sourceIdentity === row.sourceIdentity,
      )
    )
      return null
    const build = createTeamStrengthEquippedReferenceMember({
      agentId: row.agentId,
      memberIds: input.candidate.memberIds,
      referenceConditions: prepared.referenceConditions,
      standardEquipmentSelection: {
        engineId: row.engineId,
        refinement: row.refinement,
        discs: row.discs,
        objectiveIdentity: prepared.identity,
        identity: stableContentHash(row),
      },
    })
    if (build.status !== 'ready') return null
  }
  const discs = selections.flatMap((row) => row.discs)
  if (new Set(discs.map((disc) => disc.id)).size !== 18) return null
  const selectedIds = new Set(discs.map((disc) => disc.id))
  const roster = {
    ...input.warehouse.roster,
    agents: input.warehouse.roster.agents.map((agent) => {
      const selection = selections.find((row) => row.agentId === agent.agentId)
      return selection
        ? {
            ...agent,
            equippedDiscIds: selection.discs.map((disc) => disc.id),
            wEngineDetails: {
              id: selection.engineId,
              name: null,
              level: 60,
              ascension: 5,
              refinement: selection.refinement,
            },
          }
        : agent
    }),
  }
  const warehouse = {
    ...input.warehouse,
    roster,
    discs: [
      ...input.warehouse.discs.filter((disc) => !selectedIds.has(disc.id)),
      ...structuredClone(discs),
    ],
  }
  const loadouts = selections.map((row) => ({
    agentId: row.agentId,
    discIds: row.discs.map((disc) => disc.id),
  }))
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  return {
    ...input,
    warehouse,
    parameters,
    wEngineRuntimeDeclarations: runtimeDeclarations,
    rosterHash: stableContentHash(roster),
    warehouseHash: stableContentHash(warehouse.discs),
    modifierProjection: projectTargetTeamEquipmentModifiers({
      baseline: scenario.baseline,
      memberIds: input.candidate.memberIds,
      parameters,
      runtimeByAgentId: runtime.runtimeByAgentId,
    }),
    fit: {
      status: 'ready',
      memberIds: input.candidate.memberIds,
      loadouts,
      uniqueDiscCount: 18,
      fingerprint: stableContentHash({ loadouts, discs }),
    },
  }
}
