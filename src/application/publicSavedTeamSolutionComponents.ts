import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { contentHash } from './contentHash'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

export const savedTeamSolutionComponentsContract = 'soda-saved-team-solution-components/v1' as const

export function projectedSavedTeamInputHash(input: AccountDecisionQueryInput) {
  return contentHash(projectRemoteAccountDecisionInput(input))
}

export type SavedTeamSolutionComponents = {
  contract: typeof savedTeamSolutionComponentsContract
  runId: string
  accountId: string
  capturedInputFingerprint: string
  projectedInputHash: string
  nonPlanningComponents: Readonly<Record<string, string>>
}

const requiredComponentKeys = [
  'dataAuthorityHash',
  'accountHash',
  'warehouseHash',
  'rosterHash',
  'preferenceHash',
  'profilesHash',
  'optimizerOptionsHash',
  'teamEnginePackHash',
  'planningEvaluationHash',
  'planningAuthorityHash',
  'decisionModelHash',
] as const

export function acceptSavedTeamSolutionComponents(
  value: SavedTeamSolutionComponents | null | undefined,
  expected: Pick<
    SavedTeamSolutionComponents,
    'runId' | 'accountId' | 'capturedInputFingerprint' | 'projectedInputHash'
  >,
): SavedTeamSolutionComponents | null {
  if (
    value?.contract !== savedTeamSolutionComponentsContract ||
    value.runId !== expected.runId ||
    value.accountId !== expected.accountId ||
    value.capturedInputFingerprint !== expected.capturedInputFingerprint ||
    value.projectedInputHash !== expected.projectedInputHash ||
    !value.nonPlanningComponents ||
    Object.keys(value.nonPlanningComponents).length !== requiredComponentKeys.length ||
    requiredComponentKeys.some(
      (key) => !/^sha256:[a-f0-9]{64}$/.test(value.nonPlanningComponents[key] ?? ''),
    )
  )
    return null
  return value
}
