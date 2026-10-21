import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { contentHash } from '../application/contentHash'
import { defaultPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { TargetTeamStandardReferenceRequest32 } from '../application/targetTeamStandardReference32'

/** Repeating an exact team's calculation must not discard its independent standard goal.
 * A changed scenario or refreshed account run needs fresh producer metadata before selection.
 * Preserve the explicit potential branch, but never transplant the old signed declarations.
 */
export function standardReferenceContinuation32(
  fit:
    | Pick<
        TargetTeamWarehouseFitQueryResult,
        | 'candidateId'
        | 'standardReferenceRequest32'
        | 'scenarioSelection'
        | 'effectiveEquipmentParameters'
      >
    | undefined,
  candidateId: string,
  options: {
    scenarioSelection?: CurrentPlanningScenarioSelection32
    refreshMetadata?: boolean
    equipmentParameters?: TargetTeamEquipmentParameterSelection
  } = {},
): TargetTeamStandardReferenceRequest32 | undefined {
  if (fit?.candidateId !== candidateId) return undefined
  const request = fit.standardReferenceRequest32
  if (!request) return undefined
  const previous = fit.scenarioSelection ?? defaultPlanningScenarioSelection32
  const next = options.scenarioSelection ?? previous
  // Account W-Engines and potential do not define the independent standard build.
  // These shared choices do participate in its prepared identity.
  const basis = (parameters: TargetTeamEquipmentParameterSelection | null | undefined) => [
    parameters?.bangbooId,
    parameters?.bangbooStars,
    parameters?.luminizeComparison32 ?? null,
  ]
  const equipmentChanged =
    options.equipmentParameters !== undefined &&
    contentHash(basis(options.equipmentParameters)) !==
      contentHash(basis(fit.effectiveEquipmentParameters))
  if (
    !options.refreshMetadata &&
    !equipmentChanged &&
    previous.id === next.id &&
    previous.schemaVersion === next.schemaVersion
  )
    return structuredClone(request)
  return {
    stage: 'prepare',
    ...(request.potentialByAgentId
      ? { potentialByAgentId: structuredClone(request.potentialByAgentId) }
      : {}),
  }
}
