import { useEffect, useState } from 'react'
import {
  calculationQueryContractVersion,
  type CalculationQueryClient,
} from '../../application/calculationQueryContract'
import { acceptTeamOverviewPresentation } from '../teamLoadoutPresentationDto'
import type { TeamAnalysisResult } from '../teamAnalysisSession'

export function useBoxOverviewSelection(
  client: CalculationQueryClient | null,
  result: TeamAnalysisResult,
  enabled: boolean,
) {
  const [selection, setSelection] = useState(() => ({
    text: result.overviewUiState?.recommendedQuery.trim() ?? '',
    includeReference: result.overviewUiState?.includeReferenceDirections ?? false,
  }))
  const [expanded, setExpanded] = useState<{
    key: string
    model: TeamAnalysisResult['overviewModel']
  } | null>(null)
  const key = JSON.stringify([result.analysisRunId, result.inputFingerprint, selection])
  useEffect(() => {
    if (!client || !enabled || (!selection.text && !selection.includeReference)) return
    let active = true
    const timer = setTimeout(() => {
      const context = result.presentationContext ?? { agentId: null, planId: null, discId: null }
      const accountId = result.warehouse.accountId
      if (!accountId) return
      void client
        .queryTeamOverviewPresentation({
          contractVersion: calculationQueryContractVersion,
          kind: 'team_overview_presentation',
          runId: result.analysisRunId,
          sourceRunId: result.sourceRunId,
          reservedPlanIds: result.reservations?.map(({ planId }) => planId),
          fitCandidateIds: Object.values(result.targetTeamFits).map(
            ({ candidateId }) => candidateId,
          ),
          context,
          selection,
        })
        .then((view) => {
          const accepted = acceptTeamOverviewPresentation(view, {
            ...context,
            runId: result.analysisRunId,
            accountId,
            inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
          })
          if (active && accepted) setExpanded({ key, model: accepted.overviewModel })
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [client, enabled, key, result, selection])

  return {
    selectedModel: enabled && expanded?.key === key ? expanded.model : null,
    setOverviewSelection(text: string, includeReference: boolean) {
      setSelection((previous) =>
        previous.text === text.trim() && previous.includeReference === includeReference
          ? previous
          : { text: text.trim(), includeReference },
      )
    },
  }
}
