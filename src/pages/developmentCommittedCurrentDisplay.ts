import type { RosterAgent } from '../assault/types'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'
import { createAgentDevelopmentPanelFacts } from './agentDevelopmentDecisionGuide'
import { developmentPanelSummary } from './agentDevelopmentPublicDisplay'

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
      summary: '当前面板更新失败；请重新编辑当前状态后保存。',
    },
  }
}
