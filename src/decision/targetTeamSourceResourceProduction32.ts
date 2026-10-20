import { summarizeSourceResourceProduction32 } from '../calculation/sourceResourceProduction32'
import {
  summarizeSourceMechanismResourceGrants32,
  type SourceResourceGrantDeclaration32,
} from '../calculation/sourceMechanismResourceGrants32'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'

export function compileTargetTeamSourceResourceProduction32(
  members: readonly PlanningEffectRuntimeMember[],
  eventUsages: readonly PlanningEventUsage[],
  declaration?: SourceResourceGrantDeclaration32,
) {
  const mechanismGrants32 = summarizeSourceMechanismResourceGrants32({ members, declaration })
  return members.map((member) =>
    summarizeSourceResourceProduction32({
      agentId: member.agentId,
      eventUsages,
      mechanismGrants32,
    }),
  )
}
