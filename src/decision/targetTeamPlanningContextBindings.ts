import type { PlanningBaseline } from '../calculation/planningDpsContract'
import { candidateCalculationPackage } from '../gameDataPacks/currentCalculationCandidate'
import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'

/** Bind captured account facts and the selected baseline's canonical identity without calculation. */
export function targetTeamPlanningContextBindings(
  input: TargetTeamPlanningContextInput,
  baseline: PlanningBaseline,
) {
  return {
    accountSnapshot: {
      accountId: input.warehouse.accountId ?? 'legacy-local',
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      ownedAgentIds: input.warehouse.roster.agents
        .filter((agent) => agent.owned)
        .map((agent) => agent.agentId),
      // Compatibility field in the planning contract. Scheme-parameter calculations do not
      // fingerprint or validate a Bangboo entity inventory.
      ownedBangbooIds: [],
      capturedAt: input.capturedAt,
      stale: false,
    },
    canonical: {
      packageId: candidateCalculationPackage.packageId,
      packageVersion: candidateCalculationPackage.packageVersion,
      gameVersion: baseline.gameVersion,
      contentHash: baseline.sourcePackHash,
      status: 'candidate' as const,
      rollbackPackageId: candidateCalculationPackage.rollbackPackageId,
    },
  }
}
