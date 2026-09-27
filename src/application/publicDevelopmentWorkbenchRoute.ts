import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DriveDisc } from '../domain/schemas'
import type { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import type { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import type { createAgentDevelopmentWorkbenchViewModel } from '../pages/agentDevelopmentWorkbenchViewModel'

export type DevelopmentWorkbenchRouteSelection = {
  agentId: string
  requestedPlanId: string | null
  candidateRank: number | null
  /** Assert an exact loadout from the separately captured candidate Query response. */
  candidateLoadoutFingerprint: string | null
}

export type DevelopmentWorkbenchRoutePresentation = {
  contract: 'soda-development-workbench-route/v1'
  runId: string
  accountId: string
  inputFingerprint: string
  selection: DevelopmentWorkbenchRouteSelection
  status: 'ready' | 'missing' | 'references_changed' | 'candidate_mismatch'
  selectedDiscFingerprint: string | null
  source: '仓库候选' | '当前方案' | '当前已装备' | '未关联实体盘' | null
  panel: Pick<ReturnType<typeof createAgentDevelopmentPanelProjection>, 'source' | 'result'> | null
  setRecommendations: GoldenWorkbenchData['graduation']['discs']['sets']
  recordedEvaluation: ReturnType<typeof evaluateDevelopmentRecordedDiscs>
  discFacts: GoldenWorkbenchData['discs']
  workbench: ReturnType<typeof createAgentDevelopmentWorkbenchViewModel> | null
  graduationPanel: GoldenWorkbenchData['graduation']['panel']
}

export function isCurrentDevelopmentWorkbenchRoute(
  value: DevelopmentWorkbenchRoutePresentation | undefined,
  expected: {
    runId: string
    accountId: string
    inputFingerprint: string
    selection: DevelopmentWorkbenchRouteSelection
    selectedDiscs: DriveDisc[]
  },
  fingerprint: (discs: DriveDisc[]) => string,
) {
  return Boolean(
    value?.contract === 'soda-development-workbench-route/v1' &&
    value.runId === expected.runId &&
    value.accountId === expected.accountId &&
    value.inputFingerprint === expected.inputFingerprint &&
    value.selection.agentId === expected.selection.agentId &&
    value.selection.requestedPlanId === expected.selection.requestedPlanId &&
    value.selection.candidateRank === expected.selection.candidateRank &&
    value.selection.candidateLoadoutFingerprint ===
      expected.selection.candidateLoadoutFingerprint &&
    value.status === 'ready' &&
    value.selectedDiscFingerprint === fingerprint(expected.selectedDiscs) &&
    Array.isArray(value.setRecommendations) &&
    Array.isArray(value.discFacts) &&
    Array.isArray(value.workbench?.slices.currentPanel.facts) &&
    Array.isArray(value.graduationPanel),
  )
}
