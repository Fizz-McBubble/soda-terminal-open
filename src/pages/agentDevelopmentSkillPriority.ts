export const skillLabels = {
  basic: '普攻',
  dodge: '闪避',
  assist: '支援',
  special: '特殊',
  chain: '连携',
  core: '核心技',
} as const

export const fallbackSkillPriority = [
  'special',
  'core',
  'chain',
  'assist',
  'dodge',
  'basic',
] as const

export type SkillPriorityKey = (typeof fallbackSkillPriority)[number]

export const skillPriorityAliases: Record<SkillPriorityKey, readonly string[]> = {
  basic: ['普通攻击', '普攻'],
  dodge: ['闪避'],
  assist: ['快速支援', '支援技', '支援'],
  special: ['强化特殊技', '强化特殊', '特殊技', '特殊'],
  chain: ['终结技', '连携技', '连携'],
  core: ['核心被动', '核心技'],
}

export function skillPriorityFromDirections(directions: readonly string[]) {
  const explicitPriorities = directions.flatMap((direction) => {
    const normalized = direction.toLowerCase()
    const trimmed = direction.trim()
    const exactKeys = fallbackSkillPriority.filter(
      (key) => normalized === key || trimmed === skillLabels[key],
    )
    if (exactKeys.length) return exactKeys

    // Mechanic/rotation prose can name many actions without recommending a
    // level-up order. A source that explicitly defers priority verification
    // must remain empty rather than being inferred from those action names.
    if (
      /(?:技能|核心).{0,12}(?:优先级|等级)?(?:需|需要|仍需|另行).{0,12}(?:独立)?核验/.test(
        direction,
      )
    )
      return []

    // Damage contribution and combat execution order are not upgrade advice.
    if (/(?:伤害窗口|输出占比|伤害占比)/.test(direction) && !/(?:升级|加点|投入)/.test(direction))
      return []
    const orderMarker =
      /(?:>|优先|其次|次之|先拉满|可先提高(?=[^。；]*等级)|按页面顺序投入|加点(?:顺序)?)/
    if (!orderMarker.test(direction)) return []

    // Restrict the scan to clauses that themselves declare an order. This
    // excludes subsequent rotation/condition clauses, such as “支援技取决于…”,
    // which name a skill without placing it in the investment sequence.
    const source = direction
      .split(/[；。]|，(?=[^，。；]*(?:根据需求|根据自身需求|酌情))/u)
      .filter((clause) => orderMarker.test(clause))
      .join('；')

    return fallbackSkillPriority
      .flatMap((key) =>
        skillPriorityAliases[key]
          .map((alias) => source.indexOf(alias))
          .filter((index) => index >= 0)
          .map((index) => ({ key, index })),
      )
      .reduce<Array<{ key: SkillPriorityKey; index: number }>>((matches, candidate) => {
        const existing = matches.find((match) => match.key === candidate.key)
        if (!existing) matches.push(candidate)
        else if (candidate.index < existing.index) existing.index = candidate.index
        return matches
      }, [])
      .sort((left, right) => left.index - right.index)
      .map((item) => item.key)
  })
  return explicitPriorities.filter((key, index, values) => values.indexOf(key) === index)
}

/**
 * A nonempty source field is authoritative even when it only records targets
 * or conditional prose. Legacy rankings are used solely when this source field
 * is absent, never to fill in an omitted order.
 */
export function skillPriorityWithLegacyFallback(
  sourceDirections: readonly string[],
  legacyPriority: readonly string[],
) {
  return sourceDirections.length ? skillPriorityFromDirections(sourceDirections) : legacyPriority
}

/** The source's first investment tier, separate from Soda's ordinal budget bands. */
export function skillPrimaryPriorityWithLegacyFallback(
  sourceDirections: readonly string[],
  legacyPriority: readonly string[],
) {
  if (!sourceDirections.length) return legacyPriority.slice(0, 1)
  if (
    sourceDirections.every((direction) =>
      fallbackSkillPriority.some(
        (key) => direction.trim().toLowerCase() === key || direction.trim() === skillLabels[key],
      ),
    )
  )
    return skillPriorityFromDirections(sourceDirections).slice(0, 1)

  const isPureTargetClause = (direction: string) =>
    /(?:先拉满|全部点满)/u.test(direction) && !/(?:优先升级|加点顺序)/u.test(direction)

  const specificPrimaryClauses = sourceDirections.filter((d) =>
    /(?:核心技|普攻|特殊技|闪避|支援技|终结技|连携技)(?:推荐)?优先升级/u.test(d),
  )
  const candidateDirections =
    specificPrimaryClauses.length > 0 && specificPrimaryClauses.length < sourceDirections.length
      ? specificPrimaryClauses
      : sourceDirections

  const primary = candidateDirections.flatMap((direction) => {
    if (isPureTargetClause(direction)) return []
    const ordered = skillPriorityFromDirections([direction])
    if (!ordered.length) return []
    if (/(?:按页面顺序投入|加点顺序|技能优先)/u.test(direction)) return ordered.slice(0, 1)
    if (ordered.length >= 4 && !/(?:=|同时优先)/u.test(direction)) return ordered.slice(0, 1)
    const firstTier = direction.split(
      /(?:其次|次之|最后|其余|然后|随后|再比较|再考虑|[>＞]|，(?=.*根据(?:自身)?需求))/u,
    )[0]!
    return ordered.filter(
      (key) =>
        skillPriorityAliases[key].some((alias) => firstTier.includes(alias)) ||
        firstTier.trim().toLowerCase() === key,
    )
  })
  return [...new Set(primary)]
}

/** Explicit target clauses are independent of investment order (11+ is not a rank). */
export function skillTargetsFromDirections(directions: readonly string[]) {
  const targets: Partial<Record<SkillPriorityKey, string>> = {}
  const labels: Record<string, SkillPriorityKey> = {
    普攻: 'basic',
    普通攻击: 'basic',
    闪避: 'dodge',
    支援技: 'assist',
    快速支援: 'assist',
    支援: 'assist',
    特殊技: 'special',
    强化特殊技: 'special',
    强化特殊: 'special',
    特殊: 'special',
    终结技: 'chain',
    连携技: 'chain',
    连携: 'chain',
    核心技: 'core',
    核心被动: 'core',
  }
  for (const direction of directions) {
    // A declared cap is a target, even when several skills share it. Do not
    // downgrade the third/fourth named skill through the ordinal budget bands.
    const maxClauses = direction
      .split(/[；。，]/u)
      .filter(
        (clause) =>
          /(?:先拉满|推荐点满)/u.test(clause) && !/(?:不|无需).*(?:拉满|点满)/u.test(clause),
      )
    const allMax = /所有技能[^。；]*全部点满/u.test(direction)
    for (const key of fallbackSkillPriority) {
      if (
        allMax ||
        maxClauses.some((clause) =>
          skillPriorityAliases[key].some((alias) => clause.includes(alias)),
        )
      )
        targets[key] = key === 'core' ? 'F' : '12'
    }
    const match =
      /^(普通攻击|普攻|闪避|快速支援|支援技|支援|强化特殊技|强化特殊|特殊技|特殊|终结技|连携技|连携|核心被动|核心技)\s*(?:优先升至\s*)?((?:≥|>=)?\s*(?:F|1[0-6]|[1-9])\+?)$/i.exec(
        direction.trim(),
      )
    if (!match || (/F/i.test(match[2]!) && labels[match[1]!] !== 'core')) continue
    targets[labels[match[1]!]!] = match[2]!.replace(/\s+/g, '').toUpperCase()
  }
  return targets
}
