import { buildAccountDecisionInputFingerprint } from '../decision/accountDecisionService'
import type { AccountDecisionRun, AccountDecisionQueryInput } from './calculationQueryContract'
import {
  projectedSavedTeamInputHash,
  savedTeamSolutionComponentsContract,
  type SavedTeamSolutionComponents,
} from './publicSavedTeamSolutionComponents'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

export function projectPrivateSavedTeamSolutionComponents(
  run: AccountDecisionRun,
  currentInput: AccountDecisionQueryInput,
): SavedTeamSolutionComponents {
  if (
    !run.input.warehouse.accountId ||
    currentInput.warehouse.accountId !== run.input.warehouse.accountId
  )
    throw new Error('当前账户与队伍分析不一致，请重新分析。')
  // The same projection is used for local and remote clients so personal labels never enter
  // this producer's fingerprint or the remote request.
  const projectedInput = projectRemoteAccountDecisionInput(currentInput)
  const nonPlanningComponents = Object.fromEntries(
    Object.entries(buildAccountDecisionInputFingerprint(projectedInput).components).filter(
      ([key]) => key !== 'planningHash',
    ),
  )
  return {
    contract: savedTeamSolutionComponentsContract,
    runId: run.runId,
    accountId: run.input.warehouse.accountId,
    capturedInputFingerprint: run.snapshot.fingerprint.inputHash,
    projectedInputHash: projectedSavedTeamInputHash(currentInput),
    nonPlanningComponents,
  }
}
