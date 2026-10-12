import type { ObservedAgentField, RosterAgent } from '../assault/types'
import type { SnapshotAgentRecord, SnapshotObservation } from './snapshotProtocolSchema'

// Protocol enum, not the positional indices used by upstream ZOD export.
const skillsByType: Record<number, keyof RosterAgent['skillLevels']> = {
  0: 'basic',
  1: 'special',
  2: 'dodge',
  3: 'chain',
  5: 'core',
  6: 'assist',
}

export function convertSnapshotAgentSkills(
  skills: SnapshotAgentRecord['skills'],
  mindscape: number | undefined,
  observedFields: ObservedAgentField[],
  value: (observation: SnapshotObservation, maximum: number, field: string) => number | undefined,
  issue: (code: string, message: string) => void,
): RosterAgent['skillLevels'] {
  const levels: RosterAgent['skillLevels'] = {
    basic: null,
    dodge: null,
    assist: null,
    special: null,
    chain: null,
    core: null,
  }
  const seen = new Set<string>()
  for (const skill of skills) {
    const key =
      skill.skill_type.presence === 'invalid'
        ? undefined
        : skillsByType[skill.skill_type.value ?? 0]
    if (!key || seen.has(key)) {
      issue('invalid_skill_type', '技能类型未知或重复。')
      if (key) {
        levels[key] = null
        const observed = observedFields.indexOf(`skillLevels.${key}`)
        if (observed !== -1) observedFields.splice(observed, 1)
      }
      continue
    }
    seen.add(key)
    const base = value(skill.level, key === 'core' ? 7 : 12, `skills.${key}`)
    if (base !== undefined && (key === 'core' || mindscape !== undefined)) {
      levels[key] =
        base + (key === 'core' ? 0 : (mindscape! >= 3 ? 2 : 0) + (mindscape! >= 5 ? 2 : 0))
      observedFields.push(`skillLevels.${key}`)
    }
  }
  if (seen.size !== 6) issue('missing_skills', '缺少六项完整技能观察。')
  return levels
}
