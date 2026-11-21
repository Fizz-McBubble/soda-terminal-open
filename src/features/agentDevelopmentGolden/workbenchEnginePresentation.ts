import { getPlayerEntityName } from '../../application/publicRosterNames'
import { currentGameDataSelection } from '../../gameDataPacks/currentGameDataSelection'
import {
  getReviewedWorkbenchEngineGuidance33,
  reviewedWorkbenchEngineGuidanceVersion33,
} from '../../gameDataPacks/reviewedWorkbenchEngineGuidance33'
import { engineConditionPresentation } from './engineConditionPresentation'
import { reviewedEngineConditionRules33 } from './reviewedEngineConditionRules33'
import type { GoldenWorkbenchData } from './types'

type Input = Pick<GoldenWorkbenchData, 'agentId' | 'engine' | 'graduation'>
export type EngineAdviceGroup = { engineId: string; name: string; lines: string[] }

const knownInteger = (value: number | null | undefined, maximum: number, minimum = 1) =>
  value != null && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null

export function workbenchEnginePresentation(subject: Input) {
  const currentId = Object.hasOwn(subject.engine, 'currentId')
    ? subject.engine.currentId || null
    : subject.engine.visual?.entityId || null
  const name = subject.engine.name || '未记录音擎'
  const recorded = Boolean(currentId || (name !== '未记录音擎' && name !== '—'))
  const level = recorded ? knownInteger(subject.engine.level, 60, 0) : null
  const refinement = recorded ? knownInteger(subject.engine.refinement, 5) : null
  const reviewedGuidance =
    currentGameDataSelection.gameVersion === reviewedWorkbenchEngineGuidanceVersion33
      ? getReviewedWorkbenchEngineGuidance33(subject.agentId)
      : undefined
  const selectedOptions = reviewedGuidance
    ? reviewedGuidance.displayEngineIds
        .map((id) => reviewedGuidance.reviewedOptions.find((option) => option.id === id))
        .filter((option) => option !== undefined)
    : undefined
  const engineOptions = selectedOptions
    ? selectedOptions.map((option, index) => ({
        tier: index === 0 ? ('推荐' as const) : ('替代' as const),
        name: option.name,
        bonus: '',
        visual: { entityId: option.id, name: option.name },
      }))
    : subject.graduation.engines.slice(0, 3)
  const recommendations = engineOptions.map((engine) => ({
    ...engine,
    // Account identity alone decides the marker. An upstream isCurrent flag or
    // matching display name cannot mark a different record as equipped.
    isCurrent: Boolean(currentId && engine.visual?.entityId === currentId),
    tierLabel:
      engine.tier === '推荐'
        ? '推荐'
        : engine.tier === '首选'
          ? '首选'
          : ['替代', 'S级替代', 'A级下位替代'].includes(engine.tier)
            ? '备选'
            : engine.tier === '下位'
              ? '下位'
              : '备选',
  }))
  const relevantIds = new Set([
    ...(currentId ? [currentId] : []),
    ...recommendations.flatMap((engine) => (engine.visual ? [engine.visual.entityId] : [])),
  ])
  const groups = new Map<string, EngineAdviceGroup>()
  for (const option of reviewedGuidance?.reviewedOptions ?? []) {
    if (!relevantIds.has(option.id)) continue
    groups.set(option.id, { engineId: option.id, name: option.name, lines: [option.condition] })
  }
  const rules =
    currentGameDataSelection.gameVersion === '3.3'
      ? (reviewedEngineConditionRules33[subject.agentId] ?? [])
      : []
  const bySource = new Map(rules.map((rule) => [rule.sourceText, rule]))
  const unreviewedConditions: string[] = []
  const legacyConditions = engineConditionPresentation(
    subject.graduation.engineConditions ?? [],
    subject.graduation.panelConditions ?? [],
  )
  for (const { text } of legacyConditions) {
    const rule = bySource.get(text)
    if (!rule) {
      // A changed source must be routed before entering player copy. Keep the
      // field available to the adoption audit, never show internal prose here.
      unreviewedConditions.push(text)
      continue
    }
    if (reviewedGuidance || rule.disposition !== 'engine') continue
    for (const note of rule.notes ?? []) {
      if (!relevantIds.has(note.engineId)) continue
      let group = groups.get(note.engineId)
      if (!group) {
        const engineName =
          getPlayerEntityName(note.engineId) ??
          recommendations.find((engine) => engine.visual?.entityId === note.engineId)?.name ??
          (currentId === note.engineId ? name : undefined)
        if (!engineName) continue
        group = { engineId: note.engineId, name: engineName, lines: [] }
        groups.set(note.engineId, group)
      }
      if (!group.lines.includes(note.text)) group.lines.push(note.text)
    }
  }
  return {
    current: {
      id: currentId,
      name,
      visual: currentId ? { entityId: currentId, name } : undefined,
      recorded,
      level,
      refinement,
      parameters: recorded ? `Lv.${level ?? '—'} · 精${refinement ?? '—'}` : '',
      parameterLabel: recorded
        ? `等级${level ?? '未记录'}，精炼${refinement ?? '未记录'}`
        : undefined,
    },
    visibleRecommendations: recommendations.slice(0, 3),
    advice: [...groups.values()].sort(
      (left, right) =>
        (recommendations.findIndex((engine) => engine.visual?.entityId === left.engineId) + 1 ||
          Number.MAX_SAFE_INTEGER) -
        (recommendations.findIndex((engine) => engine.visual?.entityId === right.engineId) + 1 ||
          Number.MAX_SAFE_INTEGER),
    ),
    unreviewedConditions,
  }
}
