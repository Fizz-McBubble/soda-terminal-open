import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'

type Source = { label: string; kind: 'official_fact' | 'community_candidate'; updatedAt: string }
type ConstraintSource = { id: string; sourceVersion: string | null }

export function createAgentDevelopmentDecisionGuide(input: {
  level: number
  mindscape: number
  currentEngineName: string
  discSource: GoldenWorkbenchData['discSource']
  skillPriority: string[]
  skillTargetCount?: number
  /** Mechanics may be recorded without a source-backed investment order. */
  skillGuidanceEvidence?: 'priority_available' | 'mechanics_without_priority' | 'unavailable'
  engines: Array<{ name: string }>
  discSets: Array<{ label: string }>
  teamCount: number
  panelCount: number
  gaps: string[]
  sources: Source[]
  constraintSources: ConstraintSource[]
}): GoldenWorkbenchData['decisionGuide'] {
  const coverage = [
    ...(input.skillPriority.length || input.skillTargetCount ? ['技能'] : []),
    ...(input.engines.some((engine) => engine.name !== '音擎方向资料待补齐') ? ['音擎'] : []),
    ...(input.discSets.length ? ['驱动盘'] : []),
    ...(input.teamCount ? ['配队'] : []),
    ...(input.panelCount ? ['毕业面板'] : []),
  ]
  const gaps = [
    ...(!input.skillPriority.length && !input.skillTargetCount
      ? [
          input.skillGuidanceEvidence === 'mechanics_without_priority'
            ? '技能资料已收录，升级建议尚未接入。'
            : '技能升级建议尚未接入。',
        ]
      : []),
    ...(input.engines.some((engine) => engine.name === '音擎方向资料待补齐')
      ? ['音擎建议资料不足。']
      : []),
    ...(!input.discSets.length ? ['驱动盘套装建议资料不足。'] : []),
    ...(!input.teamCount ? ['配队建议资料不足。'] : []),
    ...(!input.panelCount ? ['毕业属性参考尚未接入。'] : []),
    ...input.gaps,
  ]
  const evidence = [
    ...input.sources.map((source) => ({
      label: source.label,
      detail: `${source.kind === 'official_fact' ? '游戏资料' : '攻略资料'} · ${source.updatedAt.slice(0, 10)}`,
    })),
    ...input.constraintSources.map((source) => ({
      label: source.id,
      detail: `配装资料 · 版本 ${source.sourceVersion ?? '未标注'}`,
    })),
  ].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index,
  )
  const recommendation = coverage.length
    ? [
        input.skillPriority.length
          ? `优先升级${input.skillPriority.join('、')}`
          : input.skillTargetCount
            ? '按技能栏的目标等级培养'
            : null,
        input.engines[0]?.name && input.engines[0].name !== '音擎方向资料待补齐'
          ? `音擎先看${input.engines[0]?.name}`
          : null,
        input.discSets[0]?.label ? `驱动盘先按${input.discSets[0].label}` : null,
      ]
        .filter(Boolean)
        .join('；')
    : '现有资料尚不能形成该代理人的养成建议。'
  return {
    status: coverage.length === 5 ? 'recommendation' : coverage.length ? 'limited' : 'unavailable',
    recommendation,
    accountFacts: `Lv.${input.level} · M${input.mindscape} · ${input.currentEngineName} · ${input.discSource}`,
    coverage,
    gaps: [...new Set(gaps)],
    evidence,
    gapDisposition: 'existing_evidence_unresolved',
  }
}

export function createAgentDevelopmentWarehouseStatus(input: {
  inventoryTransition?: boolean
  savedInventoryTransition?: boolean
  requested: boolean
  comparable: boolean
  totalScore?: number
  choices: Array<{ effectiveLines: number; effectiveRolls: number }>
  replacementCount?: number
  gap?: string
}): GoldenWorkbenchData['warehouseAnalysis'] {
  const transitionSummary = '副套待补齐'
  if (!input.requested)
    return {
      status: 'idle',
      summary: input.savedInventoryTransition ? transitionSummary : '尚未匹配仓库驱动盘',
      ...(input.savedInventoryTransition ? { inventoryTransition: true } : {}),
    }
  if (!input.comparable)
    return { status: 'unavailable', summary: input.gap ?? '没有找到完整的六张仓库驱动盘。' }
  return {
    status: 'ready',
    summary: input.inventoryTransition
      ? transitionSummary
      : '已保留当前匹配结果；需要时可重新匹配。',
    ...(input.inventoryTransition ? { inventoryTransition: true } : {}),
    totalScore:
      typeof input.totalScore === 'number' && Number.isFinite(input.totalScore)
        ? Math.round(input.totalScore * 10) / 10
        : undefined,
    effectiveLines: input.choices.reduce((total, choice) => total + choice.effectiveLines, 0),
    effectiveEnhancements: input.choices.reduce(
      (total, choice) => total + Math.max(0, choice.effectiveRolls - choice.effectiveLines),
      0,
    ),
    replacementCount: input.replacementCount,
  }
}

export function createAgentDevelopmentPanelFacts(
  facts: Array<{ label: string; current: string }>,
  targets: Array<{ name: string; value: string }>,
): GoldenWorkbenchData['panelFacts'] {
  return facts.map((fact) => {
    const target = targets.find((item) => item.name === fact.label)
    return { name: fact.label, value: fact.current, target: target?.value, focus: Boolean(target) }
  })
}
