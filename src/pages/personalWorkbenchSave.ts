import type { CalculationQueryClient } from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { saveCurrentAgentBuild } from '../accounts/planningDrafts'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import { contentHash } from '../application/contentHash'
import { isCurrentPersonalDevelopmentCapture } from './personalDevelopmentSessionStore'
import {
  createPersonalSavedBuild,
  refreshPersonalAfterSave,
} from './personalDevelopmentComparisonActions'
import type { Props } from './agentDevelopmentWorkbenchViewState'
import type { useNavigate } from 'react-router-dom'

export function createPersonalWorkbenchSave(
  options: Pick<
    Props,
    | 'personalCapture'
    | 'candidateSnapshotStale'
    | 'savingThisAgent'
    | 'retainingDuringSave'
    | 'accountId'
    | 'agentId'
    | 'workbenchData'
    | 'setSaveRefresh'
    | 'setAnalysisVersion'
  > & {
    personalClient: CalculationQueryClient | null
    capturePageScope: () => () => boolean
    navigate: ReturnType<typeof useNavigate>
  },
) {
  const {
    personalCapture,
    personalClient,
    candidateSnapshotStale,
    savingThisAgent,
    retainingDuringSave,
    accountId,
    agentId,
    workbenchData,
    setSaveRefresh,
    setAnalysisVersion,
    capturePageScope,
    navigate,
  } = options
  const savePersonalPlan =
    personalCapture &&
    personalClient &&
    !candidateSnapshotStale &&
    !savingThisAgent &&
    !retainingDuringSave
      ? async (rank: number) => {
          const isCurrent = capturePageScope()
          const latest = await loadPersonalDevelopmentInput()
          if (
            !isCurrent() ||
            !personalClient.hasPersonalDevelopmentSession?.(personalCapture.session.sessionId) ||
            !isCurrentPersonalDevelopmentCapture(personalCapture, latest)
          )
            throw new Error('仓库或账户资料已更新，请先重新匹配；尚未保存。')
          const loadout = personalCapture.result.candidates[rank - 1]?.loadouts[0]
          if (!loadout || loadout.discs.length !== 6)
            throw new Error('所选仓库方案不可用，请重新匹配后再保存。')
          if (!personalClient.queryPersonalDevelopmentCandidates)
            throw new Error('个人搭配服务不可用。')
          const verified = await personalClient.queryPersonalDevelopmentCandidates({
            contractVersion: calculationQueryContractVersion,
            kind: 'personal_development_candidates',
            operationId: crypto.randomUUID(),
            sessionId: personalCapture.session.sessionId,
            accountId,
            inputFingerprint: personalCapture.session.inputFingerprint,
            agentId,
            mode: 'generate',
            candidateParametersByRank: personalCapture.generationParameters,
            scenarioSelection: personalCapture.result.scenarioSelection,
            eventConditionDeclarationsByAgentId:
              personalCapture.result.eventConditionDeclarationsByAgentId,
            resourceGrantDeclaration32: personalCapture.result.resourceGrantDeclaration32,
          })
          if (
            !isCurrent() ||
            verified.generationIdentity !== personalCapture.result.generationIdentity ||
            contentHash(verified.candidates[rank - 1]?.loadouts[0]) !== contentHash(loadout)
          )
            throw new Error('个人搭配来源或六盘已变化，请重新搭配；尚未保存。')
          const latestBeforeSave = await loadPersonalDevelopmentInput()
          if (
            !isCurrent() ||
            !isCurrentPersonalDevelopmentCapture(personalCapture, latestBeforeSave)
          )
            throw new Error('仓库或账户资料已更新，请先重新匹配；尚未保存。')
          setSaveRefresh({ accountId, agentId, presentation: workbenchData })
          let saved
          try {
            saved = await saveCurrentAgentBuild(
              accountId,
              createPersonalSavedBuild(agentId, rank, personalCapture),
            )
          } catch (error) {
            if (isCurrent()) setSaveRefresh(null)
            throw error
          }
          if (!isCurrent()) return
          try {
            const refreshed = await refreshPersonalAfterSave({
              client: personalClient,
              capture: personalCapture,
              rank,
              discIds: loadout.discs.map((row) => row.disc.id),
              isCurrent,
            })
            if (!isCurrent()) return
            setSaveRefresh(null)
            if (!refreshed) return { savedPlanId: saved.id, refreshPending: true as const }
            setAnalysisVersion((version) => version + 1)
            navigate(`/development/${agentId}?candidate=${refreshed.rank}`, {
              replace: true,
              state: { preserveWorkbenchPosition: true },
            })
          } catch {
            if (isCurrent()) setSaveRefresh(null)
            return { savedPlanId: saved.id, refreshPending: true as const }
          }
        }
      : undefined
  return savePersonalPlan
}
