import type { RosterAgent } from '../assault/types'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import { createAgentDevelopmentPanelFacts } from './agentDevelopmentDecisionGuide'
import { developmentPanelSummary } from './agentDevelopmentPublicDisplay'
import type { WarehouseRefresh } from './agentDevelopmentWorkbenchViewState'
import type { DevelopmentWorkbenchFactsRequest } from '../application/publicDevelopmentWorkbenchFacts'

/** Display saved account facts; recommendations remain those of the captured run until refresh. */
export function developmentCommittedCurrentDisplay(
  before: GoldenWorkbenchData,
  agent: RosterAgent,
  panel?: DevelopmentWorkbenchRoutePresentation,
): GoldenWorkbenchData {
  const fields = ['basic', 'dodge', 'assist', 'special', 'chain', 'core'] as const
  return {
    ...before,
    level: agent.level,
    mindscape: agent.mindscape,
    potential: agent.potentialImage ?? undefined,
    skills: before.skills.map((skill, index) => ({
      ...skill,
      value: agent.skillLevels[fields[index]],
    })),
    engine: {
      ...before.engine,
      name: agent.wEngineDetails.name ?? '未记录音擎',
      currentId: agent.wEngineDetails.id,
      visual:
        agent.wEngineDetails.id && agent.wEngineDetails.name
          ? { entityId: agent.wEngineDetails.id, name: agent.wEngineDetails.name }
          : undefined,
      level: agent.wEngineDetails.level,
      refinement: agent.wEngineDetails.refinement,
    },
    panelFacts: panel
      ? createAgentDevelopmentPanelFacts(
          panel.workbench?.slices.currentPanel.facts ?? [],
          before.graduation.panel,
        )
      : before.panelFacts,
    currentPanel: {
      ...before.currentPanel,
      availability: panel
        ? (panel.workbench?.slices.currentPanel.availability ?? 'unavailable')
        : before.currentPanel.availability,
      refreshState: panel ? undefined : 'updating',
      refreshPlaceholderSummary: panel
        ? undefined
        : (before.currentPanel.refreshPlaceholderSummary ?? before.currentPanel.summary),
      summary: panel ? developmentPanelSummary(panel.panel) : '正在更新当前面板…',
    },
  }
}

export function developmentCommittedCurrentDisplayFailure(
  presentation: GoldenWorkbenchData,
): GoldenWorkbenchData {
  if (presentation.currentPanel.refreshState !== 'updating') return presentation
  return {
    ...presentation,
    currentPanel: {
      ...presentation.currentPanel,
      refreshState: 'failed',
      refreshPlaceholderSummary:
        presentation.currentPanel.refreshPlaceholderSummary ?? presentation.currentPanel.summary,
      summary: '当前面板更新未完成，请重试。',
    },
  }
}

export function developmentAnalysisRecoveryDisplay(
  presentation: GoldenWorkbenchData,
  phase: 'updating' | 'failed',
): GoldenWorkbenchData {
  return {
    ...presentation,
    currentPanel: {
      ...presentation.currentPanel,
      refreshState: phase,
      refreshPlaceholderSummary:
        presentation.currentPanel.refreshPlaceholderSummary ?? presentation.currentPanel.summary,
      summary:
        phase === 'updating' ? '正在按最新账户资料更新当前面板…' : '当前面板更新未完成，请重试。',
    },
  }
}

export function warehouseRefreshFor(
  capture: WarehouseRefresh | null,
  facts: { loading: boolean; request: DevelopmentWorkbenchFactsRequest | null },
  account: { id: string },
  agentId: string,
  decision: { liveFingerprint: string | null },
) {
  if (capture?.accountId !== account.id || capture.agentId !== agentId) return null
  if (capture.inFlight) return { presentation: capture.presentation, pending: false }
  const pending = capture.retainUntilFacts
  if (pending)
    return facts.loading && pending === facts.request
      ? {
          presentation: developmentAnalysisRecoveryDisplay(capture.presentation, 'updating'),
          pending: true,
        }
      : null
  return capture.inputFingerprint === decision.liveFingerprint
    ? { presentation: capture.presentation, pending: false }
    : null
}
