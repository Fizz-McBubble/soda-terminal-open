import type { AccountDecisionRun } from './calculationQueryContract'
import type {
  DevelopmentCurrentRecord,
  DevelopmentWorkbenchRoutePresentation,
  DevelopmentWorkbenchRouteSelection,
} from './publicDevelopmentWorkbenchRoute'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { projectDevelopmentWorkbenchEquipment } from './developmentWorkbenchPresentationProjection'
import { projectDevelopmentWorkbenchReadProjection } from './developmentWorkbenchReadProjection'

/** Private route producer: check an issued default loadout or freshly solve the same captured run. */
export function projectDevelopmentWorkbenchRoute(
  run: AccountDecisionRun,
  selection: DevelopmentWorkbenchRouteSelection,
  currentRecord?: DevelopmentCurrentRecord,
  issuedLoadout?: ReturnType<
    typeof projectDevelopmentCandidateAlternatives
  >['candidates'][number]['loadouts'][number],
): DevelopmentWorkbenchRoutePresentation {
  const base = {
    contract: 'soda-development-workbench-route/v1' as const,
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    selection,
  }
  return projectDevelopmentWorkbenchReadProjection({
    input: run.input,
    base,
    currentRecord,
    equipment: (agent) => projectDevelopmentWorkbenchEquipment(run, selection.agentId, agent),
    resolveCandidate: () =>
      issuedLoadout ??
      projectDevelopmentCandidateAlternatives(run.input, selection.agentId).candidates[
        selection.candidateRank! - 1
      ]?.loadouts[0],
  })
}
