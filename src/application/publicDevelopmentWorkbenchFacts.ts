import type { AccountDecisionQueryInput } from './calculationQueryContract'
import type { DriveDisc } from '../domain/schemas'
import { contentHash } from './contentHash'
import { rosterFingerprintFacts } from './publicRosterFingerprintFacts'
import { developmentPanelDiscFingerprint } from './publicDevelopmentComparisonPanels'
import {
  developmentCurrentRecordBinding,
  type DevelopmentCurrentRecord,
  type DevelopmentWorkbenchRoutePresentation,
  type DevelopmentWorkbenchRouteSelection,
} from './publicDevelopmentWorkbenchRoute'

/** Real local read inputs only; preference and account-wide decision authority are not inputs. */
export type DevelopmentWorkbenchFactsInput = Pick<
  AccountDecisionQueryInput,
  'warehouse' | 'drafts' | 'activePlanIds' | 'developmentPriorityAgentIds'
>
export type DevelopmentWorkbenchFactsRequest = {
  input: DevelopmentWorkbenchFactsInput
  selection: DevelopmentWorkbenchRouteSelection
  currentRecord?: DevelopmentCurrentRecord
}
export type DevelopmentWorkbenchFactsPresentation = Omit<
  DevelopmentWorkbenchRoutePresentation,
  'contract' | 'runId'
> & {
  contract: 'soda-development-workbench-facts/v1'
  /** No account-wide decision or team authority was evaluated by this producer. */
  authority: 'not_evaluated'
}

export class DevelopmentWorkbenchFactsIdentityMismatch extends Error {}

export function developmentWorkbenchFactsFingerprint(request: DevelopmentWorkbenchFactsRequest) {
  const { warehouse, drafts, activePlanIds, developmentPriorityAgentIds } = request.input
  return contentHash([
    {
      warehouse: { ...warehouse, roster: rosterFingerprintFacts(warehouse.roster) },
      drafts,
      activePlanIds,
      developmentPriorityAgentIds,
    },
    request.selection,
    request.currentRecord ?? null,
  ])
}

/** Validate the exact account, source facts, selection and physical disc facts before display. */
export function isCurrentDevelopmentWorkbenchFacts(
  value: DevelopmentWorkbenchFactsPresentation | null | undefined,
  request: DevelopmentWorkbenchFactsRequest,
  selectedDiscs: DriveDisc[],
) {
  const selection = request.selection
  return Boolean(
    value?.contract === 'soda-development-workbench-facts/v1' &&
    value.authority === 'not_evaluated' &&
    value.status === 'ready' &&
    selection.candidateRank === null &&
    selection.candidateLoadoutFingerprint === null &&
    value.accountId === request.input.warehouse.accountId &&
    value.inputFingerprint === developmentWorkbenchFactsFingerprint(request) &&
    contentHash(value.selection) === contentHash(selection) &&
    value.selectedDiscFingerprint === developmentPanelDiscFingerprint(selectedDiscs) &&
    value.currentRecordBinding ===
      (request.currentRecord
        ? developmentCurrentRecordBinding(request.currentRecord)
        : undefined) &&
    (!selection.requestedPlanId || value.comparisonTarget?.source === 'saved_plan') &&
    Array.isArray(value.setRecommendations) &&
    Array.isArray(value.discFacts) &&
    Array.isArray(value.workbench?.slices.currentPanel.facts) &&
    Array.isArray(value.graduationPanel),
  )
}
