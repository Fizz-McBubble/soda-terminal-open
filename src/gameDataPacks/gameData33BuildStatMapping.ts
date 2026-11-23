import type { StatKey } from '../domain/schemas'
type SkillKey = 'core' | 'basic' | 'special' | 'chain' | 'assist' | 'dodge'
export type MainStats = Partial<Record<'4' | '5' | '6', StatKey[]>>

/** Mirrors the already adopted game enum in snapshotAgentSkills.ts, not export positions. */
const skillTypeToKey: Readonly<Partial<Record<number, SkillKey>>> = {
  0: 'basic',
  1: 'special',
  2: 'dodge',
  3: 'chain',
  5: 'core',
  6: 'assist',
}
export function decodePhoenixSkillPriority33(groups: readonly (readonly number[])[]) {
  if (!Array.isArray(groups) || groups.some((group) => !Array.isArray(group))) return null
  const ids = groups.flat()
  if (groups.length !== 3 || groups.some((group) => group.length !== 2) || new Set(ids).size !== 6)
    return null
  const mapped = groups.map((group) => group.map((id: number) => skillTypeToKey[id]))
  if (mapped.some((group) => group.some((key: SkillKey | undefined) => key === undefined)))
    return null
  return mapped as SkillKey[][]
}

export function decodeSeverianSkillPriority33(groups: readonly (readonly number[])[]) {
  if (!Array.isArray(groups) || groups.some((group) => !Array.isArray(group))) return null
  const ids = groups.flat()
  if (
    groups.length !== 3 ||
    groups.some((group) => group.length < 1) ||
    ids.length !== 6 ||
    new Set(ids).size !== 6
  )
    return null
  const mapped = groups.map((group) => group.map((id: number) => skillTypeToKey[id]))
  if (mapped.some((group) => group.some((key: SkillKey | undefined) => key === undefined)))
    return null
  return mapped as SkillKey[][]
}

/** Source part4/5/6 are priority labels. Physical slot legality determines the projection. */
export function mapPhoenixRecommendedMainStats33(props: readonly number[]): MainStats | null {
  const mapping: Readonly<Record<number, { stat: StatKey; slots: readonly ('4' | '5' | '6')[] }>> =
    {
      31402: { stat: 'anomaly_mastery', slots: ['6'] },
      31203: { stat: 'anomaly_proficiency', slots: ['4'] },
      31603: { stat: 'fire_dmg', slots: ['5'] },
      12102: { stat: 'atk_percent', slots: ['4', '5', '6'] },
    }
  const result: MainStats = {}
  for (const prop of props) {
    const entry = mapping[prop]
    if (!entry) return null
    for (const slot of entry.slots) {
      result[slot] ??= []
      if (!result[slot]!.includes(entry.stat)) result[slot]!.push(entry.stat)
    }
  }
  return ['4', '5', '6'].every((slot) => result[slot as '4' | '5' | '6']?.length) ? result : null
}

export function mapSeverianRecommendedMainStats33(props: readonly number[]): MainStats | null {
  const mapping: Readonly<Record<number, { stat: StatKey; slots: readonly ('4' | '5' | '6')[] }>> =
    {
      20103: { stat: 'crit_rate', slots: ['4'] },
      21103: { stat: 'crit_dmg', slots: ['4'] },
      23103: { stat: 'pen_ratio', slots: ['5'] },
      32303: { stat: 'wind_dmg', slots: ['5'] },
      12102: { stat: 'atk_percent', slots: ['4', '5', '6'] },
    }
  const result: MainStats = {}
  for (const prop of props) {
    const entry = mapping[prop]
    if (!entry) return null
    for (const slot of entry.slots) {
      result[slot] ??= []
      if (!result[slot]!.includes(entry.stat)) result[slot]!.push(entry.stat)
    }
  }
  return ['4', '5', '6'].every((slot) => result[slot as '4' | '5' | '6']?.length) ? result : null
}
