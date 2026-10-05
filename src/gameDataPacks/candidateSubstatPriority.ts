/** Source order is ordinal evidence, never a numeric damage coefficient. */
export type CandidateSubstatPriority = {
  kind: 'ordered' | 'unordered' | 'conditional' | 'unparsed'
  tiers: string[][]
  conditions: string[]
  sourceText: string[]
}

type TokenResolver = (token: string) => readonly string[]

/** Parse exact tokens, equal groups and ordered tiers. Conditions remain inactive. */
export function parseCandidateSubstatPriority(
  lines: readonly string[],
  resolveToken: TokenResolver,
  explicitlyOrdered = false,
): CandidateSubstatPriority {
  const sourceText = [...lines]
  const conditions: string[] = []
  const parsed = lines.map((line) =>
    line.trim().replace(/^(?:副词条|副属性|Substats?)\s*[:：]\s*/i, ''),
  )
  const none = (): CandidateSubstatPriority => ({
    kind: 'unparsed',
    tiers: [],
    conditions,
    sourceText,
  })
  if (!parsed.length || parsed.some((line) => !line)) return none()
  const containsRelation = parsed.some((line) => /[>＞=＝]/.test(line))
  if (containsRelation && parsed.length !== 1) return none()
  const ordered = containsRelation || explicitlyOrdered
  const pieces = containsRelation ? parsed[0]!.split(/[>＞]/) : parsed
  const tiers: string[][] = []
  for (const piece of pieces) {
    const tier: string[] = []
    for (const raw of piece.split(/[=＝]/)) {
      const token = raw
        .replace(/[（(]([^()（）]*)[)）]/g, (_, condition: string) => {
          conditions.push(condition.trim())
          return ''
        })
        .trim()
      const keys = [...resolveToken(token)]
      if (!keys.length || keys.some((key) => !key)) return none()
      tier.push(...keys)
    }
    if (!tier.length || new Set(tier).size !== tier.length) return none()
    tiers.push(tier)
  }
  const flat = tiers.flat()
  if (new Set(flat).size !== flat.length) return none()
  return {
    kind: conditions.length ? 'conditional' : ordered ? 'ordered' : 'unordered',
    tiers: ordered ? tiers : [flat],
    conditions,
    sourceText,
  }
}

/** Prefix dominance supports every nonnegative nonincreasing tier weighting.
 * It orders search proposals only and never claims a numerical damage ratio. */
export function candidatePriorityPrefixVector(
  priority: CandidateSubstatPriority,
  standardRollUnits: Readonly<Record<string, number>>,
): number[] | null {
  if (
    priority.kind !== 'ordered' ||
    !priority.tiers.length ||
    priority.tiers.some((tier) => !tier.length) ||
    new Set(priority.tiers.flat()).size !== priority.tiers.flat().length
  )
    return null
  let sum = 0
  const result: number[] = []
  for (const tier of priority.tiers) {
    for (const stat of tier) {
      const value = standardRollUnits[stat] ?? 0
      if (!Number.isFinite(value) || value < 0) return null
      sum += value
      if (!Number.isFinite(sum)) return null
    }
    result.push(sum)
  }
  return result
}

export function candidatePriorityDominates(
  left: readonly number[] | null,
  right: readonly number[] | null,
) {
  return Boolean(
    left &&
    right &&
    left.length > 0 &&
    left.length === right.length &&
    left.every(
      (value, index) =>
        Number.isFinite(value) && Number.isFinite(right[index]) && value + 1e-9 >= right[index]!,
    ) &&
    left.some((value, index) => value > right[index]! + 1e-9),
  )
}
