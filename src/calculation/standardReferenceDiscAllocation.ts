import { driveDiscData, driveDiscImportSetIdentities } from '../data/gameData'
import { driveDiscSchema, type DriveDisc, type StatKey } from '../domain/schemas'
import { stableContentHash } from '../domain/stableContentHash'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'

export const standardReferenceDiscAllocationPolicy = Object.freeze({
  id: 'standard-reference-48-rolls-balanced20-objective28-bounded/v2',
  balancedRollsPerStat: 2,
  targetRolls: 28,
  totalRolls: 48,
  rollsPerDisc: 8,
  maximumRollsPerStat: 14,
  maximumRollsPerLine: 5,
  defaultMaxEvaluations: 256,
  frontierSize: 12,
  searchCompleteness: 'bounded' as const,
})

export type StandardReferenceStatCount = {
  stat: StatKey
  balancedRolls: 2
  targetRolls: number
  totalRolls: number
}

const policy = standardReferenceDiscAllocationPolicy
const rules = driveDiscData?.rules.subStatStepsByRarity.S ?? []
const knownSets = new Set(driveDiscImportSetIdentities.map((set) => set.id))
type Allocation = number[][]
const feasibleSeeds = new Map<string, { allocation: Allocation | null; nodes: number }>()

function templateError(discs: readonly DriveDisc[]) {
  if (rules.length !== 10 || new Set(rules.map((rule) => rule.stat)).size !== 10)
    return '标准48次分配需要已核验的10种S级数值副词条规则。'
  if (discs.length !== 6 || new Set(discs.map((disc) => disc.id)).size !== 6)
    return '标准分配需要六张身份唯一的驱动盘模板。'
  if (new Set(discs.map((disc) => disc.slot)).size !== 6)
    return '标准分配需要完整且唯一的六个槽位。'
  for (const disc of discs) {
    // Existing substats are deliberately not an input to the new allocation.
    if (!driveDiscSchema.safeParse({ ...disc, subStats: [] }).success)
      return '标准驱动盘模板元数据不合法。'
    if ((disc.rarity ?? 'S') !== 'S' || disc.level !== 15)
      return '标准48次分配只接受S级满级六盘模板。'
    if (!knownSets.has(disc.setId)) return '标准驱动盘模板包含未知套装身份。'
    if (!driveDiscData?.rules.mainStatsBySlot[String(disc.slot)]?.includes(disc.mainStat))
      return '标准驱动盘模板的槽位和主词条不匹配。'
  }
  return null
}

function countProof(totals: readonly number[]): StandardReferenceStatCount[] {
  return rules.map((rule, index) => ({
    stat: rule.stat,
    balancedRolls: 2,
    targetRolls: totals[index]! - 2,
    totalRolls: totals[index]!,
  }))
}

export function validateStandardReferenceDiscs(discs: readonly DriveDisc[]): {
  valid: boolean
  reason?: string
  counts: StandardReferenceStatCount[]
} {
  const totals = rules.map(() => 0)
  const invalid = (reason: string) => ({ valid: false, reason, counts: countProof(totals) })
  const error = templateError(discs)
  if (error) return invalid(error)
  for (const disc of discs) {
    if (disc.subStats.length !== 4 || new Set(disc.subStats.map((line) => line.stat)).size !== 4)
      return invalid('每张标准盘必须有四条不同副词条。')
    const history = deriveSubStatHistory(disc)
    if (history.status !== 'known' || history.actualTotalRolls !== 8)
      return invalid('每张标准盘必须具有可核对的合法8次数值历史。')
    for (const line of disc.subStats) {
      const index = rules.findIndex((rule) => rule.stat === line.stat)
      if (index < 0 || line.stat === disc.mainStat)
        return invalid('标准盘副词条不在数值规则内，或与主词条冲突。')
      const rolls = line.upgrades + 1
      if (
        !Number.isInteger(rolls) ||
        rolls < 1 ||
        rolls > policy.maximumRollsPerLine ||
        !Number.isFinite(line.value) ||
        Math.abs(line.value - rules[index]!.baseValue * rolls) > 1e-7
      )
        return invalid('标准盘副词条数值与合法次数不一致。')
      totals[index]! += rolls
    }
  }
  if (
    totals.reduce((sum, count) => sum + count, 0) !== policy.totalRolls ||
    totals.some((count) => count < 2 || count > policy.maximumRollsPerStat)
  )
    return invalid(
      '标准六盘必须满足20次均衡基础、28次目标分配及单属性14次上限（基础2次加定向12次）。',
    )
  return { valid: true, counts: countProof(totals) }
}

function totalsOf(allocation: Allocation) {
  return rules.map((_, stat) => allocation.reduce((sum, row) => sum + row[stat]!, 0))
}

/** Four lines of two rolls each give legal initial-three-line +15 histories.
 * Backtracking covers all ten stats without assuming any particular mains. */
function feasibleSeed(templates: readonly DriveDisc[]) {
  // Only stat identities and ordered main stats constrain this pure feasibility
  // search. Cache no account data or objective; callers get independent rows.
  const key = JSON.stringify([
    rules.map((rule) => rule.stat),
    templates.map((disc) => disc.mainStat),
  ])
  const cached = feasibleSeeds.get(key)
  if (cached)
    return { allocation: cached.allocation?.map((row) => [...row]) ?? null, nodes: cached.nodes }
  const choices = templates.map((disc) => {
    const allowed = rules.flatMap((rule, index) => (rule.stat === disc.mainStat ? [] : [index]))
    const combinations: number[][] = []
    for (let a = 0; a < allowed.length - 3; a++)
      for (let b = a + 1; b < allowed.length - 2; b++)
        for (let c = b + 1; c < allowed.length - 1; c++)
          for (let d = c + 1; d < allowed.length; d++)
            combinations.push([allowed[a]!, allowed[b]!, allowed[c]!, allowed[d]!])
    return combinations.sort((a, b) => a.join(',').localeCompare(b.join(',')))
  })
  const totals = rules.map(() => 0)
  const allocation: Allocation = []
  let nodes = 0
  const visit = (slot: number): boolean => {
    nodes++
    if (slot === 6) return totals.every((count) => count >= 2)
    const missing = totals.flatMap((count, index) => (count === 0 ? [index] : []))
    if (
      missing.length > (6 - slot) * 4 ||
      missing.some((stat) =>
        templates.slice(slot).every((disc) => disc.mainStat === rules[stat]!.stat),
      )
    )
      return false
    const ordered = choices[slot]!.map((selected, rank) => ({
      selected,
      rank,
      score: selected.reduce((sum, stat) => sum + totals[stat]!, 0),
    })).sort((a, b) => a.score - b.score || a.rank - b.rank)
    for (const { selected } of ordered) {
      const row = rules.map((_, index) => (selected.includes(index) ? 2 : 0))
      selected.forEach((stat) => (totals[stat]! += 2))
      allocation.push(row)
      if (visit(slot + 1)) return true
      allocation.pop()
      selected.forEach((stat) => (totals[stat]! -= 2))
    }
    return false
  }
  const result = { allocation: visit(0) ? allocation : null, nodes }
  if (feasibleSeeds.size >= 128) feasibleSeeds.delete(feasibleSeeds.keys().next().value!)
  feasibleSeeds.set(key, {
    allocation: result.allocation?.map((row) => [...row]) ?? null,
    nodes,
  })
  return result
}

const cloneAllocation = (allocation: Allocation) => allocation.map((row) => [...row])
const allocationKey = (allocation: Allocation) => allocation.map((row) => row.join('')).join(':')

/** Legal neighbors change roll allocation AND which stats appear on each disc.
 * Cross-disc swaps retain global counts even when a single replacement cannot. */
function* legalNeighbors(allocation: Allocation, templates: readonly DriveDisc[]) {
  const totals = totalsOf(allocation)
  for (let slot = 0; slot < 6; slot++) {
    const row = allocation[slot]!
    for (let from = 0; from < rules.length; from++) {
      if (row[from]! <= 1 || totals[from]! <= 2) continue
      for (let to = 0; to < rules.length; to++) {
        if (to === from || !row[to] || row[to]! >= 5 || totals[to]! >= policy.maximumRollsPerStat)
          continue
        const next = cloneAllocation(allocation)
        next[slot]![from]!--
        next[slot]![to]!++
        yield next
      }
    }
  }
  for (let left = 0; left < 5; left++)
    for (let right = left + 1; right < 6; right++)
      for (let a = 0; a < rules.length; a++) {
        const amount = allocation[left]![a]!
        if (!amount || allocation[right]![a] || templates[right]!.mainStat === rules[a]!.stat)
          continue
        for (let b = 0; b < rules.length; b++) {
          if (
            allocation[right]![b] !== amount ||
            allocation[left]![b] ||
            templates[left]!.mainStat === rules[b]!.stat
          )
            continue
          const next = cloneAllocation(allocation)
          next[left]![a] = next[right]![b] = 0
          next[left]![b] = next[right]![a] = amount
          yield next
        }
      }
  for (let slot = 0; slot < 6; slot++)
    for (let from = 0; from < rules.length; from++) {
      const amount = allocation[slot]![from]!
      if (!amount || totals[from]! - amount < 2) continue
      for (let to = 0; to < rules.length; to++) {
        if (
          allocation[slot]![to] ||
          templates[slot]!.mainStat === rules[to]!.stat ||
          totals[to]! + amount > policy.maximumRollsPerStat
        )
          continue
        const next = cloneAllocation(allocation)
        next[slot]![from] = 0
        next[slot]![to] = amount
        yield next
      }
    }
  // Exchange enhancement hits across discs without changing global counts.
  for (let left = 0; left < 5; left++)
    for (let right = left + 1; right < 6; right++)
      for (let a = 0; a < rules.length; a++)
        for (let b = 0; b < rules.length; b++) {
          if (
            a === b ||
            allocation[left]![a]! <= 1 ||
            !allocation[left]![b] ||
            allocation[left]![b]! >= 5 ||
            allocation[right]![b]! <= 1 ||
            !allocation[right]![a] ||
            allocation[right]![a]! >= 5
          )
            continue
          const next = cloneAllocation(allocation)
          next[left]![a]!--
          next[left]![b]!++
          next[right]![a]!++
          next[right]![b]!--
          yield next
        }
}

function transfer(allocation: Allocation, next: Allocation) {
  const before = totalsOf(allocation)
  const after = totalsOf(next)
  const from = before.flatMap((count, stat) => (after[stat]! < count ? [stat] : []))
  const to = before.flatMap((count, stat) => (after[stat]! > count ? [stat] : []))
  return from.length === 1 && to.length === 1
    ? { key: `${from[0]}:${to[0]}`, amount: after[to[0]!]! - before[to[0]!]! }
    : null
}

function* neighbors(
  allocation: Allocation,
  templates: readonly DriveDisc[],
  observedGains: ReadonlyMap<string, number>,
) {
  // Use only improvements actually observed from this objective to order
  // proposals. Every selected result is still scored by evaluate; this neither
  // substitutes static weights nor removes zero/negative/unknown proposals.
  const proposals = [...legalNeighbors(allocation, templates)].map((next, index) => {
    const move = transfer(allocation, next)
    return { next, index, priority: move ? (observedGains.get(move.key) ?? 0) * move.amount : 0 }
  })
  proposals.sort((a, b) => b.priority - a.priority || a.index - b.index)
  for (const { next } of proposals) yield next
}

function materializeAllocation(
  templates: readonly DriveDisc[],
  allocation: Allocation,
): DriveDisc[] {
  return templates.map((template, slot) => ({
    ...structuredClone(template),
    rarity: 'S',
    subStats: allocation[slot]!.flatMap((rolls, stat) =>
      rolls
        ? [{ stat: rules[stat]!.stat, value: rules[stat]!.baseValue * rolls, upgrades: rolls - 1 }]
        : [],
    ),
  }))
}

/** Feasibility only: no surrogate objective or score is assigned to this seed. */
export function createStandardReferenceDiscSeed(discs: readonly DriveDisc[]) {
  const error = templateError(discs)
  if (error) return { status: 'unsupported' as const, reason: error }
  const templates = [...discs].sort((a, b) => a.slot - b.slot)
  const seed = feasibleSeed(templates)
  return seed.allocation
    ? { status: 'supported' as const, discs: materializeAllocation(templates, seed.allocation) }
    : { status: 'unsupported' as const, reason: '当前主词条下没有合法的标准48次分配。' }
}

/** The same physical proposal domain serves single-actor and whole-team goals. */
export function* standardReferenceDiscProposals(discs: readonly DriveDisc[]) {
  if (!validateStandardReferenceDiscs(discs).valid) return
  const templates = [...discs].sort((a, b) => a.slot - b.slot)
  const allocation = templates.map((disc) =>
    rules.map((rule) => {
      const line = disc.subStats.find((item) => item.stat === rule.stat)
      return line ? line.upgrades + 1 : 0
    }),
  )
  for (const next of legalNeighbors(allocation, templates))
    yield materializeAllocation(templates, next)
}

export function allocateStandardReferenceDiscs(input: {
  discs: readonly DriveDisc[]
  objectiveIdentity: string
  evaluate: (discs: readonly DriveDisc[]) => number | null
  maxEvaluations?: number
}) {
  const error = templateError(input.discs)
  if (error) return { status: 'unsupported' as const, reason: error }
  if (!input.objectiveIdentity.trim())
    return { status: 'unsupported' as const, reason: '标准装备分配需要明确目标身份。' }
  const maxEvaluations = input.maxEvaluations ?? policy.defaultMaxEvaluations
  if (!Number.isInteger(maxEvaluations) || maxEvaluations < 1)
    return { status: 'unsupported' as const, reason: '目标求值预算必须为正整数。' }
  const templates = [...input.discs].sort((a, b) => a.slot - b.slot)
  const seed = feasibleSeed(templates)
  if (!seed.allocation)
    return { status: 'unsupported' as const, reason: '当前主词条下没有合法的标准48次分配。' }
  const materialize = (allocation: Allocation) => materializeAllocation(templates, allocation)
  let evaluations = 0
  let unknownEvaluations = 0
  let improvements = 0
  const evaluate = (allocation: Allocation) => {
    evaluations++
    const value = input.evaluate(materialize(allocation))
    if (value === null || !Number.isFinite(value)) {
      unknownEvaluations++
      return null
    }
    return value
  }
  type Entry = {
    allocation: Allocation
    value: number | null
    neighbors: Generator<Allocation>
    turn: number
  }
  const observedGains = new Map<string, number>()
  let turn = 0
  const entry = (allocation: Allocation, value: number | null): Entry => ({
    allocation,
    value,
    neighbors: neighbors(allocation, templates, observedGains),
    turn: turn++,
  })
  const initialValue = evaluate(seed.allocation)
  let best = initialValue === null ? null : { allocation: seed.allocation, value: initialValue }
  const frontier = [entry(seed.allocation, initialValue)]
  const seen = new Set([allocationKey(seed.allocation)])
  const order = (a: Entry, b: Entry) =>
    (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.turn - b.turn
  while (frontier.length && evaluations < maxEvaluations) {
    frontier.sort(order)
    const current = frontier.shift()!
    let exhausted = false
    // A short expansion lets a new improvement take priority while plateau
    // states still explore changes in stat placement under the same budget.
    let added = 0
    while (added < 8 && evaluations < maxEvaluations) {
      const candidate = current.neighbors.next()
      if (candidate.done) {
        exhausted = true
        break
      }
      const key = allocationKey(candidate.value)
      if (seen.has(key)) continue
      seen.add(key)
      const value = evaluate(candidate.value)
      added++
      if (value !== null && current.value !== null && value > current.value) {
        const move = transfer(current.allocation, candidate.value)
        if (move)
          observedGains.set(
            move.key,
            Math.max(observedGains.get(move.key) ?? 0, (value - current.value) / move.amount),
          )
      }
      frontier.push(entry(candidate.value, value))
      if (value !== null && (!best || value > best.value)) {
        best = { allocation: candidate.value, value }
        improvements++
        break
      }
    }
    if (!exhausted) {
      current.turn = turn++
      frontier.push(current)
    }
    frontier.sort(order)
    frontier.length = Math.min(frontier.length, policy.frontierSize)
  }
  if (!best)
    return {
      status: 'unsupported' as const,
      reason: '求值预算内目标均未知，未生成可比较的标准装备。',
    }
  const discs = materialize(best.allocation)
  const validation = validateStandardReferenceDiscs(discs)
  if (!validation.valid) return { status: 'unsupported' as const, reason: validation.reason! }
  return {
    status: 'supported' as const,
    discs,
    value: best.value,
    identity: stableContentHash({
      policy,
      rules: driveDiscData?.contentHash,
      objectiveIdentity: input.objectiveIdentity,
      maxEvaluations,
      discs,
      value: best.value,
    }),
    diagnostics: {
      evaluations,
      budgetExhausted: evaluations === maxEvaluations && frontier.length > 0,
      searchCompleteness: 'bounded' as const,
      improvements,
      unknownEvaluations,
      feasibleSeedNodes: seed.nodes,
      counts: validation.counts,
    },
  }
}
