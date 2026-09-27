import type { DriveDisc } from '../domain/schemas'
import { candidateSetPlanPriority } from '../gameDataPacks/candidateSetPlanPolicy'
import { allowedSetCountPatterns } from '../optimizer/optimizerSetPatterns'
import { twoPieceRecommendationPriority } from '../gameDataPacks/twoPieceSetPolicy'
import type { WarehouseDemandContext } from './warehouseDemandContexts'
import {
  assessWarehouseContextQuality,
  hasReliableWarehouseDiscRecord,
  warehouseQualityIsAdmitted,
  type WarehouseContextQuality,
} from './warehouseDiscQuality'

export type WarehouseUseAssessment = {
  status: 'keep' | 'develop' | 'cleanup' | 'verify'
  basis:
    | 'active_use'
    | 'quality_reserve'
    | 'poor_seed'
    | 'failed_rolls'
    | 'surplus'
    | 'low_reserve_value'
    | 'no_current_use'
    | 'uncertain_context'
    | 'invalid_record'
  agentId: string | null
  contextId: string | null
  effectiveRolls: number | null
  worthInvestment: boolean
  compatibleAgentIds: string[]
  retainedAgentIds: string[]
}
type Entry = { disc: DriveDisc; quality: WarehouseContextQuality }
type Choice = {
  entries: Entry[]
  score: number
  context: WarehouseDemandContext
  secondaryRank: number
}

/** Pick an actual set pattern, not independent winners that cannot form a set.
 * Empty slots are allowed: a missing good disc never admits a bad filler.
 */
function chooseBranch(
  context: WarehouseDemandContext,
  entries: Entry[],
  unavailable: ReadonlySet<string>,
): Choice {
  const plan = context.setPlan
  const patterns = allowedSetCountPatterns({
    setPlans: [
      {
        pattern: plan.pattern,
        primarySets: plan.primarySetIds,
        secondarySets: plan.secondarySetIds,
      },
    ],
  })
  let best: Choice = { entries: [], score: 0, context, secondaryRank: Number.POSITIVE_INFINITY }
  for (const pattern of patterns) {
    const secondarySet =
      plan.pattern === '4+2'
        ? Object.keys(pattern).find((setId) => pattern[setId] === 2)
        : undefined
    const primarySet = Object.keys(pattern).find((setId) => pattern[setId] === 4)
    const secondaryRank =
      secondarySet && primarySet
        ? twoPieceRecommendationPriority(secondarySet, context.constraint, primarySet).order
        : 0
    const bySlot = Array.from({ length: 6 }, (_, index) =>
      Object.keys(pattern).flatMap((setId) => {
        const eligible = entries.filter(
          ({ disc }) =>
            disc.slot === index + 1 && disc.setId === setId && !unavailable.has(disc.id),
        )
        eligible.sort(compareEntries)
        return eligible.length ? [eligible[0]!] : []
      }),
    )
    const visit = (
      slot: number,
      picked: Entry[],
      counts: Record<string, number>,
      score: number,
    ) => {
      if (slot === 6) {
        if (
          picked.length > best.entries.length ||
          (picked.length === best.entries.length &&
            (secondaryRank < best.secondaryRank ||
              (secondaryRank === best.secondaryRank && score > best.score)))
        )
          best = { entries: [...picked], score, context, secondaryRank }
        return
      }
      for (const entry of bySlot[slot]!) {
        const set = entry.disc.setId
        if ((counts[set] ?? 0) >= pattern[set]!) continue
        counts[set] = (counts[set] ?? 0) + 1
        picked.push(entry)
        visit(slot + 1, picked, counts, score + entry.quality.score)
        picked.pop()
        counts[set]!--
      }
      visit(slot + 1, picked, counts, score)
    }
    visit(0, [], {}, 0)
  }
  return best
}
function compareEntries(left: Entry, right: Entry) {
  return right.quality.score - left.quality.score || left.disc.id.localeCompare(right.disc.id)
}
function compareChoices(left: Choice, right: Choice) {
  // First use a feasible six-disc branch. Authored priorities apply between
  // feasible branches; missing modern pieces do not invalidate an older build.
  return (
    right.entries.length - left.entries.length ||
    candidateSetPlanPriority(left.context.setPlan) -
      candidateSetPlanPriority(right.context.setPlan) ||
    right.entries.length - left.entries.length ||
    right.score - left.score ||
    left.context.id.localeCompare(right.context.id)
  )
}

export function assessWarehouseUses(
  discs: DriveDisc[],
  contexts: WarehouseDemandContext[],
  coverageComplete: boolean,
) {
  const qualities = new Map<string, WarehouseContextQuality[]>()
  const byContext = new Map<string, Entry[]>()
  for (const disc of discs) {
    const matched = contexts.flatMap((context) => {
      const quality = assessWarehouseContextQuality(disc, context)
      return quality ? [quality] : []
    })
    qualities.set(disc.id, matched)
    if (!hasReliableWarehouseDiscRecord(disc)) continue
    for (const quality of matched.filter(warehouseQualityIsAdmitted)) {
      byContext.set(quality.context.id, [
        ...(byContext.get(quality.context.id) ?? []),
        { disc, quality },
      ])
    }
  }
  const retained = new Map<string, WarehouseContextQuality[]>()
  const retain = ({ disc, quality }: Entry) =>
    retained.set(disc.id, [...(retained.get(disc.id) ?? []), quality])
  const groups = new Map<string, WarehouseDemandContext[]>()
  for (const context of contexts.filter(
    (context) => context.demand === 'active' && context.eligibility === 'eligible',
  ))
    groups.set(context.groupId, [...(groups.get(context.groupId) ?? []), context])
  const sources = new Map<string, WarehouseDemandContext[][]>()
  for (const [groupId, branches] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const source = groupId.startsWith('selected:')
      ? 'selected-portfolio'
      : groupId.slice(0, -(branches[0]!.agentId.length + 1))
    sources.set(source, [...(sources.get(source) ?? []), branches])
  }
  const incompleteSearchContexts = new Set<string>()
  for (const members of sources.values()) {
    let best: Choice[] = []
    let visits = 0
    let exhausted = false
    const rank = (choices: Choice[]) => [
      choices.filter((choice) => choice.entries.length === 6).length,
      choices.reduce((sum, choice) => sum + choice.entries.length, 0),
      -choices.reduce((sum, choice) => sum + candidateSetPlanPriority(choice.context.setPlan), 0),
      choices.reduce((sum, choice) => sum + choice.score, 0),
    ]
    const better = (choices: Choice[]) => {
      const left = rank(choices),
        right = rank(best)
      for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) return left[index]! > right[index]!
      }
      return false
    }
    // A flexible member must not consume the sole branch of a restricted
    // teammate. Explore member order and authored branches together (trios).
    const visit = (
      remaining: WarehouseDemandContext[][],
      selected: Choice[],
      assigned: Set<string>,
    ) => {
      if (++visits > 4096) {
        exhausted = true
        return
      }
      if (!remaining.length) {
        if (better(selected)) best = selected
        return
      }
      remaining.forEach((branches, index) => {
        const choices = branches
          .map((context) => chooseBranch(context, byContext.get(context.id) ?? [], assigned))
          .sort(compareChoices)
        const distinct = new Set<string>()
        for (const choice of choices) {
          const key = choice.entries
            .map((entry) => entry.disc.id)
            .sort()
            .join('|')
          if (distinct.has(key)) continue
          distinct.add(key)
          visit(
            remaining.filter((_, other) => other !== index),
            [...selected, choice],
            new Set([...assigned, ...choice.entries.map((entry) => entry.disc.id)]),
          )
        }
      })
    }
    visit(members, [], new Set())
    if (exhausted)
      for (const branches of members)
        for (const context of branches) incompleteSearchContexts.add(context.id)
    for (const choice of best) {
      for (const entry of choice.entries) retain(entry)
      // One admitted development candidate per slot in the chosen branch is
      // enough to support improvement without storing every optimistic seed.
      const seeds = (byContext.get(choice.context.id) ?? [])
        .filter((entry) => entry.quality.worthInvestment)
        .sort(compareEntries)
      const slots = new Set<number>()
      for (const entry of seeds) {
        if (slots.has(entry.disc.slot)) continue
        slots.add(entry.disc.slot)
        retain(entry)
      }
    }
  }
  // A recommendation rank is not proof that another build is disposable.
  // Preserve qualified, non-dominated choices within each actual set/slot/main
  // and growth stage. Never impose a cross-slot quota on an unmarked agent.
  for (const context of contexts.filter((item) => item.eligibility === 'eligible')) {
    const pool = (byContext.get(context.id) ?? []).filter(({ quality }) =>
      context.demand === 'active'
        ? quality.viableNow || quality.worthInvestment
        : quality.premium || quality.functionMain,
    )
    for (const entry of pool) {
      const dominated = pool.some((other) => {
        const left = entry.disc,
          right = other.disc
        if (
          left.id === right.id ||
          left.setId !== right.setId ||
          left.slot !== right.slot ||
          left.mainStat !== right.mainStat ||
          left.level !== right.level ||
          (left.rarity ?? 'S') !== (right.rarity ?? 'S')
        )
          return false
        // Different seed lines carry different future opportunities.
        if (
          entry.quality.worthInvestment &&
          left.subStats
            .map((line) => line.stat)
            .sort()
            .join('|') !==
            right.subStats
              .map((line) => line.stat)
              .sort()
              .join('|')
        )
          return false
        const stats = Object.entries(context.constraint.subStatWeights)
          .filter(([, weight]) => weight > 0)
          .map(([stat]) => stat)
        const value = (disc: DriveDisc, stat: string) =>
          disc.subStats.find((line) => line.stat === stat)?.value ?? 0
        return (
          stats.every((stat) => value(right, stat) >= value(left, stat)) &&
          (stats.some((stat) => value(right, stat) > value(left, stat)) ||
            right.id.localeCompare(left.id) < 0)
        )
      })
      if (!dominated) retain(entry)
    }
  }
  return new Map(
    discs.map((disc): [string, WarehouseUseAssessment] => {
      const matched = qualities.get(disc.id) ?? []
      const uses = retained.get(disc.id) ?? []
      const eligible = matched.filter((quality) => quality.context.eligibility === 'eligible')
      const best = [...(uses.length ? uses : eligible)].sort(
        (a, b) =>
          Number(b.context.demand === 'active') - Number(a.context.demand === 'active') ||
          b.score - a.score,
      )[0]
      const uncertain =
        !coverageComplete ||
        matched.some(
          (quality) =>
            warehouseQualityIsAdmitted(quality) && incompleteSearchContexts.has(quality.context.id),
        ) ||
        matched.some(
          (quality) =>
            quality.context.eligibility === 'unknown' &&
            // Unknown applicability cannot prove absence of demand. Apply the
            // same quality bar as a known use, including stricter reserves.
            // Equal stat weights do not establish equivalent set conditions.
            (quality.context.demand === 'active'
              ? quality.viableNow || quality.worthInvestment
              : quality.premium || quality.functionMain) &&
            !eligible.some(
              (known) =>
                known.context.agentId === quality.context.agentId &&
                (quality.context.demand === 'active' ||
                  (known.context.demand === quality.context.demand &&
                    JSON.stringify(known.context.setPlan) ===
                      JSON.stringify(quality.context.setPlan))) &&
                JSON.stringify(Object.entries(known.context.constraint.subStatWeights).sort()) ===
                  JSON.stringify(Object.entries(quality.context.constraint.subStatWeights).sort()),
            ),
        )
      const reliable = hasReliableWarehouseDiscRecord(disc)
      const worthInvestment = uses.some(
        (quality) => quality.worthInvestment && quality.context.demand === 'active',
      )
      const status = !reliable
        ? 'verify'
        : uses.length
          ? worthInvestment
            ? 'develop'
            : 'keep'
          : uncertain
            ? 'verify'
            : 'cleanup'
      const basis = !reliable
        ? 'invalid_record'
        : uses.length
          ? uses.some((quality) => quality.context.demand === 'active')
            ? 'active_use'
            : 'quality_reserve'
          : uncertain
            ? 'uncertain_context'
            : eligible.length === 0
              ? 'no_current_use'
              : (best?.stopReason ??
                (!eligible.some((quality) => quality.context.demand === 'active') &&
                !eligible.some((quality) => quality.premium)
                  ? 'low_reserve_value'
                  : 'surplus'))
      return [
        disc.id,
        {
          status,
          basis,
          agentId: best?.context.agentId ?? null,
          contextId: best?.context.id ?? null,
          effectiveRolls: best?.effectiveRolls ?? null,
          worthInvestment,
          compatibleAgentIds: [...new Set(eligible.map((quality) => quality.context.agentId))],
          retainedAgentIds: [...new Set(uses.map((quality) => quality.context.agentId))],
        },
      ]
    }),
  )
}

export { warehouseUseReasons } from '../application/warehouseUseReasons'
