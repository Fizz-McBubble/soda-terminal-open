import type { GoldenWorkbenchData } from './types'

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

export function presentationSkillTargetDescription(
  skill: GoldenWorkbenchData['graduation']['skills'][number],
) {
  const level = presentationTargetLevel(skill.recommended)
  const target = `${skill.targetType === 'soda_derived' ? '建议等级' : '推荐等级'}：${level}${/^\d+$/.test(level) ? '级' : ''}`
  return [skill.priority ? '优先升级' : null, target, skill.nextLevel?.tooltip]
    .filter(Boolean)
    .join('；')
}
