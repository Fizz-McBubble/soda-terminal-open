import type {
  AccountDecisionRun,
  CalculationQueryClient,
  TargetTeamWarehouseFitQuery,
} from './calculationQueryContract'
import { prepareTargetTeamStandardReference32 } from './targetTeamStandardReference32'

type FitResult = Awaited<ReturnType<CalculationQueryClient['calculateTargetTeamWarehouseFit']>>

export function applyCachedStandardReferenceUpdate32({
  query,
  run,
  teamFits,
  standardInputs,
}: {
  query: TargetTeamWarehouseFitQuery
  run: AccountDecisionRun
  teamFits: Map<string, Map<string, FitResult>>
  standardInputs: WeakMap<object, Parameters<typeof prepareTargetTeamStandardReference32>[0]>
}): FitResult {
  const cached = teamFits.get(run.runId)?.get(query.candidateId)
  const input = cached && standardInputs.get(cached)
  if (
    !cached ||
    !input ||
    cached.fingerprint !== query.standardReferenceFitFingerprint32 ||
    !query.standardReference32 ||
    query.equipmentParameters ||
    query.scenarioSelection ||
    query.eventConditionDeclarationsByAgentId ||
    query.declaredEventComparison32 ||
    query.playerBangbooSelection
  )
    throw new Error('当前配装或比较条件已变化，请重新打开标准培养参考。')
  const standard = prepareTargetTeamStandardReference32(input, query.standardReference32)
  const result: FitResult = {
    ...cached,
    standardReference32: standard.result,
    standardReferenceRequest32: structuredClone(query.standardReference32),
    standardReferenceUpdate32: {
      fitFingerprint: cached.fingerprint,
      accountEquipmentPreserved: true as const,
    },
  }
  standardInputs.set(result, input)
  if (standard.result.status !== 'unsupported')
    teamFits.get(run.runId)!.set(query.candidateId, result)
  return result
}
