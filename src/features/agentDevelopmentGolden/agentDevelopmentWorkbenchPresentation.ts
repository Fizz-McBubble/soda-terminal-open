import type { GoldenWorkbenchData } from './types'
import { getMindscapeSkillLevelBonus } from '../../accounts/agentProgressionRules'
import type { SkillNextLevelDisplay } from '../../decision/skillInvestmentProjection'

type PresentationSkill = GoldenWorkbenchData['graduation']['skills'][number]

/** Translate calculation evidence without presenting an unknown target as an action. */
export function presentationSkillNextLevelDetail(skill: PresentationSkill): string | null {
  const next = skill.nextLevel as (typeof skill.nextLevel & Partial<SkillNextLevelDisplay>) | null
  if (!next) return null
  if (skill.targetLevel === null && next.status === 'no_upgrade') return null
  if (
    next.reasonCode === 'current_level_unknown' ||
    next.reasonCode === 'current_and_target_unknown'
  )
    return '请录入当前技能等级'
  if (next.reasonCode === 'target_level_unknown' && skill.targetType === 'minimum_reference') {
    return typeof next.fromLevel === 'number' ? `当前技能 Lv.${next.fromLevel}` : null
  }
  return next.tooltip || null
}

export const specialtyIconIds: Record<string, { entityId: string; name: string }> = {
  锋御: { entityId: 'specialty-armorer', name: '锋御特性' },
  异常: { entityId: 'specialty-anomaly', name: '异常特性' },
  强攻: { entityId: 'specialty-attack', name: '强攻特性' },
  防护: { entityId: 'specialty-defense', name: '防护特性' },
  命破: { entityId: 'specialty-rupture', name: '命破特性' },
  击破: { entityId: 'specialty-stun', name: '击破特性' },
  支援: { entityId: 'specialty-support', name: '支援特性' },
}

export function presentationTargetLevel(recommended: string) {
  // Display a concrete reference level; source floors remain in the skill data.
  // F maps to the canonical seven-level core cap.
  const trimmed = recommended.trim()
  if (/^(?:核心技|核心)?(?:优先升至\s*)?[≥>=]*F\+?$/i.test(trimmed)) {
    return '7'
  }
  const level = trimmed.match(/(\d+)/)
  return level ? level[1]! : recommended
}

export function presentationSkillTargetDescription(skill: PresentationSkill) {
  const level = presentationSkillTargetValue(skill)
  const target =
    level === '待确认'
      ? '当前条件下推荐等级待确认'
      : skill.targetType === 'minimum_reference'
        ? `参考等级：${level}${level.endsWith('+') ? '' : '级'}`
        : skill.targetType === 'soda_derived'
          ? `培养参考：${level}级`
          : `推荐等级：${level}级`
  return [presentationSkillPriorityLead(skill), target, presentationSkillNextLevelDetail(skill)]
    .filter(Boolean)
    .join('；')
}

function isCoreSkill(skill: PresentationSkill) {
  return skill.key === 'core' || skill.label === '核心' || skill.label === '核心技'
}

function knownTargetLevel(skill: PresentationSkill) {
  // A null effective target is intentional, including a source with unknown cinema basis.
  if (skill.targetLevel === null) return null
  const level =
    skill.targetLevel ??
    (skill.targetType === 'exact_integer'
      ? (skill.exactTarget ?? Number(presentationTargetLevel(skill.recommended)))
      : null)
  return typeof level === 'number' &&
    Number.isInteger(level) &&
    level > 0 &&
    level <= (isCoreSkill(skill) ? 7 : 16)
    ? level
    : null
}

/** Visual investment emphasis is independent from the author's upgrade ordering. */
export function presentationSkillIsHighInvestment(
  skill: PresentationSkill,
  mindscape?: number | null,
) {
  const target = knownTargetLevel(skill)
  if (target === null) {
    // A source floor supports investment emphasis without establishing that
    // the current effective level has reached an unknown paid/effective basis.
    return (
      !isCoreSkill(skill) &&
      skill.targetType === 'minimum_reference' &&
      (skill.minimumReference === 11 || skill.minimumReference === 12)
    )
  }
  if (isCoreSkill(skill)) return target === 7
  const bonus =
    mindscape != null && Number.isInteger(mindscape) && mindscape >= 0 && mindscape <= 6
      ? getMindscapeSkillLevelBonus('basic', mindscape)
      : null
  const base =
    skill.baseTargetLevel ??
    skill.sodaDerived?.baseTargetLevel ??
    (bonus === null ? null : target - bonus)
  return base != null && Number.isInteger(base) && base >= 11 && base <= 12
}

export function presentationSkillPriorityLead(skill: PresentationSkill, achieved = false) {
  if (!skill.priority || achieved) return null
  return '优先培养方向'
}

export function presentationSkillTargetValue(skill: PresentationSkill) {
  const target = knownTargetLevel(skill)
  if (target !== null) return String(target)
  if (skill.targetType === 'minimum_reference') {
    const reference = skill.minimumReference
    if (
      typeof reference === 'number' &&
      Number.isInteger(reference) &&
      reference > 0 &&
      reference <= (isCoreSkill(skill) ? 7 : 16)
    )
      return `${reference}+`
  }
  return '待确认'
}
