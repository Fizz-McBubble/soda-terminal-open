import { getCandidateWEngineLabels } from '../application/publicCandidateLabels'
import { getAgentName, getBangbooName } from '../application/publicRosterNames'
import type { TeamExecutionPortfolio } from '../decision/teamExecutionProjection'

export const incompleteTeamLoadoutMessage =
  '尚未找到三名成员可以同时使用的完整配装，可重新搭配后再查看。'

export type TeamExecutionPortfolioStatus = 'direct' | 'confirm' | 'build'

/**
 * Blocker text names stable ids in player copy. The desktop build passes its own W-Engine
 * directory so its wording is unchanged; the public build uses the published display labels.
 */
export type TeamExecutionBlockerNaming = {
  wEngineName: (engineId: string) => string
}

const publicBlockerNaming: TeamExecutionBlockerNaming = {
  wEngineName: (engineId) => getCandidateWEngineLabels([engineId])[0]!,
}

export function isIncompleteTeamDiscReason(value: string) {
  const normalized = value.replace(/\s+/gu, '')
  return (
    normalized.includes('未闭合六张不同实体盘') ||
    normalized.includes('候选实体盘已被更高优先级或先分配角色占用') ||
    normalized.includes('还没有配齐18张不同驱动盘') ||
    normalized.includes('完整搜索未找到三人互斥配装')
  )
}

export function isSpecificTeamDiscReason(value: string) {
  return value.startsWith('套装数量不足：') || value.startsWith('号位数量不足：')
}

export function playerFacingExecutionBlocker(
  value: string,
  naming: TeamExecutionBlockerNaming = publicBlockerNaming,
) {
  if (isIncompleteTeamDiscReason(value)) return incompleteTeamLoadoutMessage
  return value
    .replace(/agent-[a-z0-9-]+/giu, (agentId) => getAgentName(agentId))
    .replace(/bangboo-[a-z0-9-]+/giu, (bangbooId) => getBangbooName(bangbooId))
    .replace(/wengine-[a-z0-9-]+/giu, (engineId) => naming.wEngineName(engineId))
    .replaceAll('simultaneous-lock', '同时出战')
    .replaceAll('Account Decision', '本次账户分析')
    .replaceAll('Team Engine', '队伍判断')
    .replaceAll('Build Intent', '养成方向')
    .replaceAll('Profile', '养成方向')
    .replaceAll('engineId', '音擎身份')
    .replaceAll('stable ', '稳定')
    .replaceAll('同时出战 ', '同时出战')
}

/** Readiness wording for a multi-team projection; identical in the desktop and public builds. */
export function presentTeamExecutionPortfolio(
  portfolio: TeamExecutionPortfolio,
  naming: TeamExecutionBlockerNaming = publicBlockerNaming,
) {
  const status: TeamExecutionPortfolioStatus =
    portfolio.status === 'ready'
      ? 'direct'
      : portfolio.status === 'needs_confirmation'
        ? 'confirm'
        : 'build'
  return {
    status,
    statusLabel:
      status === 'direct'
        ? '可以同时出战'
        : status === 'confirm'
          ? '请确认音擎'
          : '当前不能同时出战',
    headline:
      status === 'direct'
        ? `${portfolio.requestedTeamCount} 队配装已匹配`
        : status === 'confirm'
          ? '驱动盘已匹配，请确认音擎与邦布。'
          : `当前还不能配齐 ${portfolio.requestedTeamCount} 队。`,
    equipmentLine: `${portfolio.uniquePhysicalDiscIds.length}/${portfolio.requestedTeamCount * 18} 张驱动盘 · 音擎与邦布请按实际持有情况确认`,
    blockers: [
      ...new Set(portfolio.blockers.map((value) => playerFacingExecutionBlocker(value, naming))),
    ],
  }
}
