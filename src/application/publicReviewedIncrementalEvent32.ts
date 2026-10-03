import { contentHash } from './contentHash'

export const reviewedIncrementalEvent32Contract = 'soda-reviewed-incremental-event32/v1' as const
export const reviewedIncrementalEventStatKeys32 = [
  'attack',
  'defense',
  'critRate',
  'critDamage',
  'lacerationDamage',
  'sharpDamageBonus',
  'flatDamage',
  'damageBonus',
  'directDamageBonus',
  'buffBonus',
  'defenseReduction',
  'defenseIgnore',
  'penetrationRatio',
  'penetrationFlat',
  'resistanceReduction',
  'resistanceIgnore',
] as const
export type ReviewedIncrementalEventInput32Dto = {
  agentId: string
  eventId?: string
  level: number
  skillLevel: number
  stats: Record<(typeof reviewedIncrementalEventStatKeys32)[number], number>
  enemy: { defense: number; resistance: number; stunMultiplier: number; vulnerability: number }
  confirmedFinalStatsAndModifiers: boolean
  stale: boolean
}
export type ReviewedIncrementalEventMetadata32 = {
  agentId: string
  eventId?: string
  availableEvents?: Array<{ eventId: string; label: string; skill: string }>
  label: string
  family: 'sharp' | 'direct'
  sourceLink: string
  sourceFingerprint: string
  scope: 'provided_final_stats_single_event'
}
export type ReviewedIncrementalEventResult32Dto = {
  contract: typeof reviewedIncrementalEvent32Contract
  runId: string
  inputFingerprint: string
  resultFingerprint: string
  sideEffect: 'read_only'
  subject: ReviewedIncrementalEventMetadata32 | null
  status: 'formal_single_event' | 'unsupported'
  formalSingleEvent: boolean
  expectedDamage: number | null
  gaps: string[]
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** No stat or condition defaults: every displayed input must be explicitly supplied. */
export function reviewedIncrementalEventInputGaps32(raw: unknown): string[] {
  if (!record(raw)) return ['missing_event_input']
  const gaps: string[] = []
  if (typeof raw.agentId !== 'string' || !raw.agentId) gaps.push('missing_agent_id')
  if (raw.eventId !== undefined && (typeof raw.eventId !== 'string' || !raw.eventId))
    gaps.push('invalid_event_id')
  if (!Number.isInteger(raw.level) || Number(raw.level) < 1 || Number(raw.level) > 60)
    gaps.push('invalid_agent_level:1..60')
  if (
    !Number.isInteger(raw.skillLevel) ||
    Number(raw.skillLevel) < 1 ||
    Number(raw.skillLevel) > 16
  )
    gaps.push('invalid_skill_level:1..16')
  if (typeof raw.confirmedFinalStatsAndModifiers !== 'boolean')
    gaps.push('missing_confirmation_gate')
  if (typeof raw.stale !== 'boolean') gaps.push('missing_stale_gate')
  for (const key of reviewedIncrementalEventStatKeys32)
    if (
      !record(raw.stats) ||
      typeof raw.stats[key] !== 'number' ||
      !Number.isFinite(raw.stats[key])
    )
      gaps.push(`missing_or_nonfinite_stat:${key}`)
  for (const key of ['defense', 'resistance', 'stunMultiplier', 'vulnerability'])
    if (
      !record(raw.enemy) ||
      typeof raw.enemy[key] !== 'number' ||
      !Number.isFinite(raw.enemy[key])
    )
      gaps.push(`missing_or_nonfinite_enemy:${key}`)
  if (
    Object.keys(raw).some(
      (key) =>
        ![
          'agentId',
          'eventId',
          'level',
          'skillLevel',
          'stats',
          'enemy',
          'confirmedFinalStatsAndModifiers',
          'stale',
        ].includes(key),
    ) ||
    (record(raw.stats) &&
      Object.keys(raw.stats).some(
        (key) =>
          !reviewedIncrementalEventStatKeys32.includes(
            key as (typeof reviewedIncrementalEventStatKeys32)[number],
          ),
      )) ||
    (record(raw.enemy) &&
      Object.keys(raw.enemy).some(
        (key) => !['defense', 'resistance', 'stunMultiplier', 'vulnerability'].includes(key),
      ))
  )
    gaps.push('unknown_event_input_field')
  return gaps
}

export const reviewedIncrementalEventInputFingerprint32 = (input: unknown) => contentHash(input)
export function reviewedIncrementalEventResultFingerprint32(
  result: Omit<ReviewedIncrementalEventResult32Dto, 'resultFingerprint'>,
) {
  return contentHash(result)
}
/** Reject responses for another request, source payload, or transport contract. */
export function acceptReviewedIncrementalEventResult32(
  raw: unknown,
  runId: string,
  input: ReviewedIncrementalEventInput32Dto,
): ReviewedIncrementalEventResult32Dto {
  if (
    !record(raw) ||
    raw.contract !== reviewedIncrementalEvent32Contract ||
    raw.runId !== runId ||
    raw.inputFingerprint !== reviewedIncrementalEventInputFingerprint32(input) ||
    raw.sideEffect !== 'read_only' ||
    !['formal_single_event', 'unsupported'].includes(String(raw.status)) ||
    !Array.isArray(raw.gaps) ||
    !raw.gaps.every((gap) => typeof gap === 'string') ||
    (raw.subject !== null &&
      (!record(raw.subject) ||
        raw.subject.agentId !== input.agentId ||
        (input.eventId !== undefined && raw.subject.eventId !== input.eventId) ||
        typeof raw.subject.label !== 'string' ||
        !['sharp', 'direct'].includes(String(raw.subject.family)) ||
        typeof raw.subject.sourceLink !== 'string' ||
        !raw.subject.sourceLink.startsWith('https://github.com/frzyc/genshin-optimizer/blob/') ||
        typeof raw.subject.sourceFingerprint !== 'string' ||
        raw.subject.scope !== 'provided_final_stats_single_event')) ||
    (raw.status === 'formal_single_event' &&
      (input.stale ||
        input.confirmedFinalStatsAndModifiers !== true ||
        raw.gaps.length !== 0 ||
        raw.formalSingleEvent !== true ||
        !Number.isFinite(raw.expectedDamage) ||
        raw.subject === null)) ||
    (raw.status === 'unsupported' &&
      (raw.formalSingleEvent !== false || raw.expectedDamage !== null))
  )
    throw new Error('单次命中响应版本或输入绑定无效。')
  const { resultFingerprint, ...payload } = raw
  if (resultFingerprint !== contentHash(payload)) throw new Error('单次命中响应指纹不一致。')
  return raw as ReviewedIncrementalEventResult32Dto
}
