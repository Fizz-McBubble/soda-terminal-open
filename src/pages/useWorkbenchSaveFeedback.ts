import { useState } from 'react'
import { contentHash } from '../application/contentHash'
import { readDevelopmentCandidateSnapshot } from './agentDevelopmentCandidateSession'
import { createDevelopmentPlanSaveHandler } from './developmentPlanSaveHandler'
import { resolveSavedPlanScenarioSelection } from './savedPlanIdentity'

type SaveInput = Parameters<typeof createDevelopmentPlanSaveHandler>[0]
type Options = Omit<SaveInput, 'equipment'> & {
  equipment: SaveInput['equipment'] | null | undefined
  requestedPlanId: string | null
  savingThisAgent: boolean
  retainingDuringSave: boolean
}

export function useWorkbenchSaveFeedback({
  requestedPlanId,
  accountId,
  agentId,
  agentName,
  candidateSnapshotStale,
  decisionWorld,
  candidates,
  candidateSnapshot,
  equipment,
  workbenchData,
  setSaveRefresh,
  setRouteRead,
  setLastRouteProjection,
  setAnalysisVersion,
  queryDevelopmentCandidateAlternatives,
  queryDevelopmentWorkbenchRoute,
  capturePageScope,
  navigate,
  savingThisAgent,
  retainingDuringSave,
}: Options) {
  const [saveRefreshScope, setSaveRefreshScope] = useState<{
    next: string
    previous: string
  } | null>(null)
  const rawSaveScope = contentHash([requestedPlanId, candidateSnapshot])
  const displayedSaveScope =
    saveRefreshScope?.next === rawSaveScope ? saveRefreshScope.previous : rawSaveScope
  const onSavePlan =
    candidateSnapshotStale || savingThisAgent || retainingDuringSave || !equipment
      ? undefined
      : async (rank: number) => {
          const isCurrent = capturePageScope()
          const result = await createDevelopmentPlanSaveHandler({
            accountId,
            agentId,
            agentName,
            candidateSnapshotStale,
            decisionWorld,
            candidates,
            candidateSnapshot,
            equipment,
            workbenchData,
            setSaveRefresh,
            setRouteRead,
            setLastRouteProjection,
            setAnalysisVersion,
            queryDevelopmentCandidateAlternatives,
            queryDevelopmentWorkbenchRoute,
            capturePageScope,
            navigate,
          })(rank)
          if (!result && isCurrent()) {
            const refreshed = readDevelopmentCandidateSnapshot(accountId, agentId)
            const selectedRank = rank ?? workbenchData.selectedCandidateRank
            const selectedIds = candidateSnapshot?.candidates[
              (selectedRank ?? 0) - 1
            ]?.loadouts[0]?.discs
              .map((item) => item.disc.id)
              .toSorted()
            const refreshedRank =
              selectedIds &&
              refreshed?.candidates.findIndex(
                (candidate) =>
                  contentHash(
                    candidate.loadouts[0]?.discs.map((item) => item.disc.id).toSorted(),
                  ) === contentHash(selectedIds),
              )
            if (
              candidateSnapshot &&
              refreshed &&
              refreshedRank !== undefined &&
              refreshedRank >= 0 &&
              contentHash([
                candidateSnapshot.candidateParametersByRank?.[selectedRank ?? 0],
                resolveSavedPlanScenarioSelection(candidateSnapshot.scenarioSelection),
                candidateSnapshot.eventConditionDeclarationsByAgentId,
                candidateSnapshot.resourceGrantDeclaration32,
              ]) ===
                contentHash([
                  refreshed.candidateParametersByRank?.[refreshedRank + 1],
                  resolveSavedPlanScenarioSelection(refreshed.scenarioSelection),
                  refreshed.eventConditionDeclarationsByAgentId,
                  refreshed.resourceGrantDeclaration32,
                ])
            )
              setSaveRefreshScope({
                next: contentHash([requestedPlanId, refreshed]),
                previous: displayedSaveScope,
              })
          }
          return result
        }
  return { displayedSaveScope, onSavePlan }
}
