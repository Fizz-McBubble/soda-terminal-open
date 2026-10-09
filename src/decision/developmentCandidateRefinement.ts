import type { DriveDisc } from '../domain/schemas'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { driveDiscData } from '../data/gameData'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { candidatePriorityEvidence } from '../gameDataPacks/candidatePriorityEvidence'
import {
  candidatePriorityPrefixVector,
  candidatePriorityDominates,
} from '../gameDataPacks/candidateSubstatPriority'
import { candidateConstraintToDiscProfile } from '../gameDataPacks/candidateWarehouseConstraints'
import { toBuildProfile } from '../optimizer/accountBuildCandidates'
import { scoreActualDisc } from '../optimizer/scoreActualDisc'
import { candidateDiscProposals } from '../optimizer/candidateDiscProposals'
import {
  candidateDiscFactKey,
  compareCandidatePanelPriority,
} from '../optimizer/candidateSearchFacts'
import {
  refineComparableCandidatePool,
  refineSourceDominancePool,
} from '../optimizer/refineComparableCandidatePool'
import {
  solveCandidateWarehouse,
  type CandidateWarehousePlan,
} from '../optimizer/candidateWarehouseSolver'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmark'
import { optimizerOptionsFromBuildIntent, type AgentIndependentBuildIntent } from './buildIntent'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import { dynamicDiscProposals } from '../optimizer/dynamicDiscProposals'

export const developmentCandidateRefinementVersion = 'dynamic-marginal-source-compatible-local-r4'
const proposalBudget = 24
const sourceNote =
  '本候选按已核对的来源词条层级细化，且已建模片段数值不下降；未建模效果仍未验证，不据此宣称整体伤害提升。'
const key = (plan: CandidateWarehousePlan) =>
  JSON.stringify(
    plan.loadouts[0]?.discs
      .map(({ disc }) => [disc.slot, disc.id])
      .sort((a, b) => Number(a[0]) - Number(b[0])),
  )
const group = (plan: CandidateWarehousePlan) =>
  JSON.stringify([
    plan.inventoryTransition ?? false,
    plan.loadouts[0]?.degraded ?? false,
    Object.entries(plan.loadouts[0]?.setCounts ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    plan.loadouts[0]?.panelObjectiveStatus ?? null,
  ])
const mains = (plan: CandidateWarehousePlan) =>
  JSON.stringify(
    plan.loadouts[0]?.discs
      .map(({ disc }) => [disc.slot, disc.mainStat, disc.level, disc.rarity ?? 'S'])
      .sort((a, b) => Number(a[0]) - Number(b[0])),
  )
const coverageKey = (side: ValueBenchmarkSide) =>
  side.coverage
    ? JSON.stringify([
        [...side.coverage.includedEffectKeys].sort(),
        side.coverage.excludedEffects
          .map((effect) => [
            effect.effectKey,
            effect.reason,
            [...effect.fields].sort(),
            [...effect.sourceRefs].sort(),
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ])
    : null

/** Runs before ranks reach comparison/saving. No account or saved plan writes. */
export function refineDevelopmentCandidates(input: {
  warehouse: CoreWarehouse
  agentId: string
  candidates: readonly CandidateWarehousePlan[]
  buildIntent: AgentIndependentBuildIntent
  parameters?: DevelopmentComparisonParameters
}): CandidateWarehousePlan[] {
  const originals = [...input.candidates]
  if (!originals.length) return originals
  const constraint = input.buildIntent.recommendations.find(
    (row) => row.agentId === input.agentId,
  )?.constraint
  const profile = constraint ? candidateConstraintToDiscProfile(constraint) : null
  if (!constraint || !profile) return originals
  const specialty = getCurrentAgentEventContract(input.agentId)?.identity.specialty
  const direct = ['attack', 'rupture', 'armorer'].includes(specialty ?? '')
  const functional = originals.some((plan) => Boolean(plan.loadouts[0]?.panelObjective))
  if (!direct && !functional) return originals
  const options = optimizerOptionsFromBuildIntent(input.buildIntent)
  const priority = candidatePriorityEvidence(constraint)
  const sourceProfile = toBuildProfile(profile)
  const useful = Object.entries(profile.statWeights)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([stat]) => stat)
  const steps = Object.fromEntries(
    (driveDiscData?.rules.subStatStepsByRarity.S ?? []).map((row) => [row.stat, row.baseValue]),
  )
  const ids = new Map<string, number>()
  input.warehouse.discs.forEach((disc) => ids.set(disc.id, (ids.get(disc.id) ?? 0) + 1))
  const excluded = new Set(options.excludedDiscIds ?? [])
  const available = input.warehouse.discs.filter((disc) => {
    if (ids.get(disc.id) !== 1 || excluded.has(disc.id)) return false
    try {
      history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules)
      return true
    } catch {
      return false
    }
  })
  const sideCache = new Map<string, ValueBenchmarkSide>()
  const side = (plan: CandidateWarehousePlan) => {
    const id = key(plan)
    if (!sideCache.has(id))
      sideCache.set(
        id,
        evaluateDevelopmentValueBenchmarkSide({
          warehouse: input.warehouse,
          agentId: input.agentId,
          discs: plan.loadouts[0]!.discs.map((row) => row.disc),
          stale: false,
          parameters: input.parameters,
        }),
      )
    return sideCache.get(id)!
  }
  const comparisons = new Map<string, ReturnType<typeof compareValueBenchmarkSides>>()
  const compare = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    const id = JSON.stringify([key(a), key(b)])
    if (!comparisons.has(id))
      comparisons.set(
        id,
        compareValueBenchmarkSides({
          baseline: side(a),
          candidate: side(b),
          changedDimensions: ['disc_loadout'],
          independentCounterfactual: true,
          labels: { baseline: '同来源候选', candidate: '同来源候选' },
        }),
      )
    return comparisons.get(id)!
  }
  const comparable = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    if (group(a) !== group(b)) return false
    const left = a.loadouts[0]?.panelObjective,
      right = b.loadouts[0]?.panelObjective
    if (
      functional &&
      (Boolean(left) !== Boolean(right) ||
        (left &&
          right &&
          (left.priorityStat ?? 'anomalyProficiency') !==
            (right.priorityStat ?? 'anomalyProficiency')))
    )
      return false
    if (left && right) return true
    if (!direct) return false
    const result = compare(a, b)
    return result.comparable && result.coverage.generalConclusion === 'supported'
  }
  const compareOrder = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    const left = a.loadouts[0]?.panelObjective,
      right = b.loadouts[0]?.panelObjective
    return left && right
      ? compareCandidatePanelPriority(left, right)
      : side(b).totalDamage! - side(a).totalDamage!
  }
  const canExploreSource = (plan: CandidateWarehousePlan) =>
    direct &&
    priority.kind === 'ordered' &&
    side(plan).state === 'supported' &&
    compare(plan, plan).comparable
  const seen = new Set(originals.map(key))
  const proposals: CandidateWarehousePlan[] = []
  const proposalLists = new Map<string, DriveDisc[]>()
  const lanes = originals.flatMap((plan) => {
    if ((!comparable(plan, plan) && !canExploreSource(plan)) || plan.inventoryTransition) return []
    const weights = direct
      ? evaluateDevelopmentStatWeights({
          warehouse: input.warehouse,
          agentId: input.agentId,
          discs: plan.loadouts[0]!.discs.map((row) => row.disc),
          stale: false,
          parameters: input.parameters,
        })
      : null
    return plan.loadouts[0]!.discs.flatMap(({ disc: current }) => {
      if (options.fixedDiscByAgent?.[input.agentId] === current.id) return []
      const allowedMain =
        current.slot <= 3
          ? [current.mainStat]
          : (constraint.mainStats[String(current.slot) as '4' | '5' | '6'] ?? [])
      const poolKey = JSON.stringify([current.slot, current.setId, allowedMain])
      if (!proposalLists.has(poolKey)) {
        const pool = available.filter(
          (disc) =>
            disc.slot === current.slot &&
            disc.setId === current.setId &&
            allowedMain.includes(disc.mainStat),
        )
        proposalLists.set(
          poolKey,
          candidateDiscProposals(
            pool,
            priority,
            useful,
            steps,
            (disc) => scoreActualDisc(disc, sourceProfile).score,
          ),
        )
      }
      const sourceChoices = proposalLists.get(poolKey)!.filter((disc) => disc.id !== current.id)
      const dynamicChoices = weights ? dynamicDiscProposals(available, current, weights) : []
      // Preserve source/extreme proposals alongside sensitivity proposals. Local weights are
      // never an upper bound, and every physical proposal still faces the full comparison gate.
      const choices = [
        ...new Map(
          [
            dynamicChoices[0],
            sourceChoices[0],
            ...dynamicChoices.slice(1),
            ...sourceChoices.slice(1),
          ]
            .filter((disc): disc is DriveDisc => Boolean(disc))
            .map((disc) => [disc.id, disc]),
        ).values(),
      ]
      return [
        {
          plan,
          current,
          choices,
        },
      ]
    })
  })
  let compiled = 0
  const maximum = Math.max(0, ...lanes.map((lane) => lane.choices.length))
  outer: for (let offset = 0; offset < maximum; offset++) {
    for (const lane of lanes) {
      if (compiled >= proposalBudget) break outer
      const replacement = lane.choices[offset]
      if (!replacement) continue
      const discs = lane.plan.loadouts[0]!.discs.map(({ disc }) =>
        disc.id === lane.current.id ? replacement : disc,
      )
      const physicalKey = JSON.stringify(
        discs.map((disc) => [disc.slot, disc.id]).sort((a, b) => Number(a[0]) - Number(b[0])),
      )
      if (seen.has(physicalKey)) continue
      seen.add(physicalKey)
      compiled++
      const proposal = solveCandidateWarehouse(
        discs,
        [input.agentId],
        'agent',
        options,
        input.buildIntent.recommendations,
      )
      if (proposal.loadouts[0]?.discs.length === 6 && group(proposal) === group(lane.plan))
        proposals.push(proposal)
    }
  }
  proposals.sort((a, b) =>
    a.loadouts[0]!.discs.map(({ disc }) => candidateDiscFactKey(disc))
      .join('|')
      .localeCompare(b.loadouts[0]!.discs.map(({ disc }) => candidateDiscFactKey(disc)).join('|')),
  )
  const exact = refineComparableCandidatePool(originals, proposals, {
    key,
    group,
    comparable,
    compare: compareOrder,
  })
  if (!direct || priority.kind !== 'ordered') return exact
  const prefixes = new Map<string, number[] | null>()
  const prefix = (plan: CandidateWarehousePlan) => {
    if (!prefixes.has(key(plan))) {
      const units: Record<string, number> = {}
      for (const { disc } of plan.loadouts[0]!.discs)
        for (const line of disc.subStats)
          units[line.stat] = (units[line.stat] ?? 0) + line.value / (steps[line.stat] ?? Infinity)
      prefixes.set(key(plan), candidatePriorityPrefixVector(priority, units))
    }
    return prefixes.get(key(plan))!
  }
  // A separate source-quality objective. Slice damage vetoes a regression,
  // but must not promote limited coverage to an overall-damage conclusion.
  return refineSourceDominancePool(exact, proposals, {
    key,
    group,
    canReplace: (current, proposal) => {
      if (
        current.loadouts[0]?.panelObjective ||
        proposal.loadouts[0]?.panelObjective ||
        mains(current) !== mains(proposal) ||
        !candidatePriorityDominates(prefix(proposal), prefix(current))
      )
        return false
      const before = side(current),
        after = side(proposal)
      const coverage = coverageKey(before)
      if (
        before.state !== 'supported' ||
        after.state !== 'supported' ||
        !coverage ||
        coverage !== coverageKey(after)
      )
        return false
      const comparison = compare(current, proposal)
      return (
        comparison.comparable &&
        comparison.coverage.generalConclusion === 'limited' &&
        comparison.totalDamageDelta !== null &&
        Number.isFinite(comparison.totalDamageDelta) &&
        comparison.totalDamageDelta >= 0
      )
    },
    mark: (proposal) =>
      proposal.boundary.includes(sourceNote)
        ? proposal
        : { ...proposal, boundary: `${proposal.boundary} ${sourceNote}` },
  })
}
