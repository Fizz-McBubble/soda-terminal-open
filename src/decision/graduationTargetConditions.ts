import { currentBuildAuthority } from '../gameDataPacks/currentBuildAuthority'
import { targetPanelMetricSemanticEntries } from '../gameDataPacks/targetPanelSemantics'
import type { GraduationMetricCompletion } from './savedTeamGraduationCompletion'
type GraduationPanelKey = GraduationMetricCompletion['key']

const conditionLabels: Record<GraduationPanelKey, readonly string[]> = {
  hp: ['生命值', 'hp'],
  atk: ['攻击力', 'atk'],
  def: ['防御力', 'def'],
  impact: ['冲击力', 'impact'],
  critRate: ['暴击率', 'crit rate'],
  critDamage: ['暴击伤害', 'crit dmg'],
  anomalyMastery: ['异常掌控', 'anomaly mastery'],
  anomalyProficiency: ['异常精通', 'anomaly proficiency'],
  penRatio: ['穿透率', 'pen ratio'],
  energyRegen: ['能量回复', 'energy regen'],
}

const knownExplanatoryTargetConditions = new Set([
  '来源标明其他属性不相关',
  'source marks all other stats not relevant',
  'guide marks all other stats not relevant',
])

export function targetConditionsAreAutomaticallyApplicable(
  conditions: readonly string[],
  metrics: readonly GraduationMetricCompletion[],
  target?: unknown,
) {
  // A provenance limitation is not a game-state prerequisite. Remove it only
  // when the complete payload and conditions match the adopted field exactly.
  const adopted = currentBuildAuthority.profiles
    .flatMap((profile) => profile.guidance.fields)
    .find(
      (field) =>
        field.fieldId === 'build.target_panel' &&
        field.state === 'ready' &&
        field.referenceContinuity &&
        'boundary' in field.referenceContinuity &&
        JSON.stringify(field.value) === JSON.stringify(target) &&
        JSON.stringify(field.conditions) === JSON.stringify(conditions),
    )
  const continuity = adopted?.referenceContinuity
  const prerequisites =
    continuity && 'boundary' in continuity
      ? conditions.filter((condition) => condition !== continuity.boundary)
      : conditions
  if (!prerequisites.length) return true
  const targetSemantics = targetPanelMetricSemanticEntries(target)
  return prerequisites.every((condition) => {
    const normalized = condition
      .trim()
      .replace(/[。；;.]+$/gu, '')
      .toLocaleLowerCase()
    // Some reviewed target-panel notes deliberately describe what the source does
    // not compare (for example, Sunna's "other stats are not relevant"). They are
    // still shown with the completion evidence, but they do not add an account
    // prerequisite. Keep the allowlist narrow so an unrecognised condition still
    // fails closed instead of turning a source note into a score.
    if (knownExplanatoryTargetConditions.has(normalized)) return true
    if (
      (normalized.includes('可选') || normalized.includes('optional')) &&
      targetSemantics.some(([, semantic]) => semantic.requirement === 'optional')
    )
      return true
    if (
      (normalized.includes('战斗内') || normalized.includes('in combat')) &&
      targetSemantics.some(([, semantic]) => semantic.observation === 'in_combat')
    )
      return true
    if (!normalized.includes('上限') && !normalized.includes('maximum')) return false
    return metrics.some(
      (metric) =>
        metric.comparator === 'at_most' &&
        conditionLabels[metric.key].some((label) => normalized.includes(label)),
    )
  })
}
