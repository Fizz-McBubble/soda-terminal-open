import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { AccountDecisionFingerprint } from './accountDecisionFingerprint'
import { assembleCunningHaresP0DecisionEvaluation } from './cunningHaresP0DecisionAssembler'
import { evaluateNormalizedPlanningCandidate } from './normalizedPlanningCandidateEvaluator'
import type { TeamExecution } from './teamExecutionProjection'

/** Keep supplied, declared P0 and normalized account evidence in their original priority. */
export function projectAccountPlanningEvaluations(input: {
  accountId: string
  fingerprint: AccountDecisionFingerprint
  roster: CoreWarehouse['roster']
  discs: CoreWarehouse['discs']
  capturedAt: string
  candidates: readonly TeamEngineCandidate[]
  executions: readonly TeamExecution[]
  suppliedEvaluations: readonly unknown[]
}) {
  const { accountId, fingerprint, roster, discs, capturedAt, candidates, executions } = input
  const evidenceBinding = {
    accountId,
    rosterHash: fingerprint.components.rosterHash,
    warehouseHash: fingerprint.components.warehouseHash,
    planningHash: fingerprint.components.planningHash,
    capturedAt,
  }
  const p0Evaluations = candidates.flatMap((candidate) => {
    const evaluation = assembleCunningHaresP0DecisionEvaluation({
      ...evidenceBinding,
      candidate,
      execution: executions.find((item) => item.candidateId === candidate.candidateId),
      roster,
      discs,
    })
    return evaluation ? [evaluation] : []
  })
  const suppliedEvaluationIds = new Set(
    input.suppliedEvaluations.flatMap((evaluation) =>
      typeof evaluation === 'object' &&
      evaluation !== null &&
      'candidateId' in evaluation &&
      typeof evaluation.candidateId === 'string'
        ? [evaluation.candidateId]
        : [],
    ),
  )
  const p0EvaluationIds = new Set(p0Evaluations.map((evaluation) => evaluation.candidateId))
  const normalizedBangbooBlockers: Record<string, string[]> = {}
  const normalizedEvaluations = candidates.flatMap((candidate) => {
    if (
      suppliedEvaluationIds.has(candidate.candidateId) ||
      p0EvaluationIds.has(candidate.candidateId)
    )
      return []
    const evaluation = evaluateNormalizedPlanningCandidate({
      ...evidenceBinding,
      candidate,
      execution: executions.find((item) => item.candidateId === candidate.candidateId),
      roster,
      discs,
      onUnsupportedBangboo: (blockers) => {
        normalizedBangbooBlockers[candidate.candidateId] = blockers
      },
    })
    return evaluation ? [evaluation] : []
  })
  return {
    evaluations: [...input.suppliedEvaluations, ...p0Evaluations, ...normalizedEvaluations],
    normalizedBangbooBlockers,
  }
}
