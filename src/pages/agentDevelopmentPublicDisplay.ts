import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import type { AgentDevelopmentPanelProjection } from './agentDevelopmentPanelProjection'
import type { DriveDisc } from '../domain/schemas'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { evaluateDevelopmentRecordedDiscs } from './developmentRecordedDiscEvaluation'
import { presentDiscFactFromChoice } from './discFactPresentation'
import { displayDiscMainValue, displayDriveDiscSet } from './publicDiscFacts'

export const developmentSkillLabels = {
  basic: '普攻',
  dodge: '闪避',
  assist: '支援',
  special: '特殊',
  chain: '连携',
  core: '核心技',
} as const

export function displayDevelopmentStat(stat: string) {
  return getCandidateStatLabels([stat], '副词条')[0] ?? '资料待补齐'
}

export function developmentPanelSummary(
  projection: Pick<AgentDevelopmentPanelProjection, 'source' | 'result'> | null,
) {
  if (!projection) return '当前面板资料待更新；已记录的账户与驱动盘仍可查看。'
  if (projection.result.status === 'ok')
    if (projection.source === '本次匹配方案')
      return '本次匹配的六张驱动盘已计入面板；保存前不会改动当前装备。'
  if (projection.result.status === 'ok')
    return '当前账户组合已接入面板复算；仅高亮有毕业推荐的属性。'
  if (projection.source === '暂无完整配装')
    return '关联完整6张驱动盘后可查看面板；上方等级、技能和音擎仍为当前记录。'
  if (projection.result.reason?.startsWith('当前音擎')) return projection.result.reason
  if (projection.result.reason?.startsWith('所选配装')) return projection.result.reason
  if (projection.result.reason?.includes('60 级'))
    return '当前面板支持60级代理人与60级音擎；请先核对等级记录。'
  if (projection.result.reason?.includes('零档')) return '当前核心技档位尚未接入面板计算。'
  if (projection.result.reason?.includes('缺少核心技'))
    return '请补全核心技、音擎和精炼记录后再查看面板。'
  return '这套配装暂时无法计算面板，请核对等级、核心技与音擎记录。'
}

export function developmentRecordedDiscFacts(
  agentId: string,
  discs: DriveDisc[],
): GoldenWorkbenchData['discs'] {
  return discs.map((disc) =>
    presentDiscFactFromChoice({
      agentId,
      choice: null,
      disc,
      set: displayDriveDiscSet(disc.setId),
      mainValue: displayDiscMainValue(disc),
    }),
  )
}

export function applyRecordedDevelopmentMetrics(
  status: GoldenWorkbenchData['warehouseAnalysis'],
  evaluation: ReturnType<typeof evaluateDevelopmentRecordedDiscs>,
) {
  if (!evaluation || evaluation.choices.length !== 6) return
  status.totalScore =
    evaluation.totalScore === undefined ? undefined : Math.round(evaluation.totalScore * 10) / 10
  status.effectiveLines = evaluation.choices.reduce((sum, choice) => sum + choice.effectiveLines, 0)
  status.effectiveEnhancements = evaluation.choices.reduce(
    (sum, choice) => sum + choice.effectiveRolls - choice.effectiveLines,
    0,
  )
}
