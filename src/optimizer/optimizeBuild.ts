import type { BuildProfile, DriveDisc, StatKey } from '../domain/schemas'
import { contentHash } from '../evaluation/contentHash'
import { retainSetRepresentatives } from './retainSetRepresentatives'
import { actualDiscScoreVersion, scoreActualDisc } from './scoreActualDisc'
import { insertTopK } from './retainTopK'
import { evaluationRules } from '../evaluation/rules'
import { isAllowedMainStat, type BuildKnowledgeProfile } from './buildKnowledge'
import { allowedSetCountPatterns, canStillCompleteSetPattern } from './optimizerSetPatterns'
export { allowedSetCountPatterns, canStillCompleteSetPattern } from './optimizerSetPatterns'

import {
  candidatePanelObjectiveAppliesToSetPlan,
  candidatePanelObjectiveSupportsSetPlans,
  candidatePanelObjectiveWarning,
  compareCandidatePanelObjective,
  prepareCandidatePanelObjective,
  projectCandidatePanelObjective,
  resolveCandidatePanelObjectiveStatus,
  type CandidatePanelInput,
  type CandidatePanelObjective,
} from './candidatePanelObjective'
export {
  candidatePanelObjectiveVersion,
  compareCandidatePanelObjective,
  type CandidatePanelInput,
  type CandidatePanelObjective,
} from './candidatePanelObjective'

/** Solver constraints carry no claim about provenance or current-version authority. */
export type OptimizerKnowledge = Pick<
  BuildKnowledgeProfile,
  'mainStats' | 'minimumSubstatValues' | 'setPlans' | 'contentHash'
>

export type OptimizerOptions = {
  fixedDiscId?: string | null
  allowLocked?: boolean
  allowEquipped?: boolean
  topK?: number
  candidateLimitPerSlot?: number
  panelInput?: CandidatePanelInput
  /** Internal same-call identity; ignored unless it refers to the exact input array. */
  warehouseSnapshot?: { discs: DriveDisc[]; hash: string }
}

export type DiscContribution = {
  disc: DriveDisc
  score: number
  mainStatScore: number
  subStatScore: number
  effectiveRolls: number
  reasons: string[]
}

export type OptimizedBuild = {
  rank: number
  discs: DiscContribution[]
  totalScore: number
  discScore: number
  setScore: number
  effectiveRolls: number
  setCounts: Record<string, number>
  setPattern: '4+2' | '2+2+2'
  tieBreakKey: string
  panelObjective?: CandidatePanelObjective
  panelObjectiveStatus?: 'applied' | 'limited' | 'unsupported'
}

export type OptimizationResult = {
  builds: OptimizedBuild[]
  consideredCount: number
  excludedLockedCount: number
  excludedIllegalMainStatCount: number
  excludedUnsupportedSetCount: number
  candidateCounts: Record<number, number>
  warehouseSnapshotHash: string
  profileVersion: string
  knowledgeVersion: string
  gameDataVersion: string
  ruleVersion: string
  elapsedMs: number
  warnings: string[]
  panelObjectiveStatus?: 'applied' | 'limited' | 'unsupported'
}

type PartialBuild = {
  discs: DiscContribution[]
  score: number
  setCounts: Record<string, number>
  tieBreakKey: string
  attack?: number
  priority?: number
}

type ScalarExtension = Pick<PartialBuild, 'score' | 'setCounts' | 'tieBreakKey'> & {
  partial: PartialBuild
  candidate: DiscContribution
}

function round(value: number, digits = 3) {
  const multiplier = 10 ** digits
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

function countKey(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([setId, count]) => `${setId}:${Math.min(count, 4)}`)
    .join('|')
}

function tieBreak(discs: DiscContribution[]) {
  return discs
    .map((item) => item.disc.id)
    .sort()
    .join('|')
}

function comparePartial(
  left: Pick<PartialBuild, 'score' | 'tieBreakKey'>,
  right: Pick<PartialBuild, 'score' | 'tieBreakKey'>,
) {
  return right.score - left.score || left.tieBreakKey.localeCompare(right.tieBreakKey)
}

export function resolveSetPlan(
  counts: Record<string, number>,
  profile: BuildProfile,
  knowledge: OptimizerKnowledge,
) {
  const pairs = Object.entries(counts).filter(([, count]) => count >= 2)
  const candidates: Array<{
    pattern: '4+2' | '2+2+2'
    activeSets: string[]
  }> = []
  for (const plan of knowledge.setPlans) {
    if (plan.pattern === '4+2') {
      const primary = pairs.find(([setId, count]) => count >= 4 && plan.primarySets.includes(setId))
      if (primary) {
        const secondary = pairs.find(
          ([setId]) => setId !== primary[0] && plan.secondarySets.includes(setId),
        )
        if (secondary)
          candidates.push({ pattern: plan.pattern, activeSets: [primary[0], secondary[0]] })
      }
      continue
    }
    const activeSets = pairs
      .filter(([setId]) => plan.primarySets.includes(setId))
      .map(([setId]) => setId)
      .sort()
      .slice(0, 3)
    if (activeSets.length === 3) candidates.push({ pattern: plan.pattern, activeSets })
  }
  if (!candidates.length) return null

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: round(
        candidate.activeSets.reduce((sum, setId) => {
          const fit = profile.setFit[setId] ?? 0
          return sum + fit * ((counts[setId] ?? 0) >= 4 ? 30 : 12)
        }, 0),
      ),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.activeSets.join('|').localeCompare(right.activeSets.join('|')),
    )[0]
}

function meetsMinimumTargets(discs: DiscContribution[], knowledge: OptimizerKnowledge) {
  const totals = discs.reduce<Partial<Record<StatKey, number>>>((result, item) => {
    for (const subStat of item.disc.subStats) {
      result[subStat.stat] = (result[subStat.stat] ?? 0) + subStat.value
    }
    return result
  }, {})
  return Object.entries(knowledge.minimumSubstatValues).every(
    ([stat, minimum]) => (totals[stat as StatKey] ?? 0) >= minimum,
  )
}

export function optimizeBuild(
  discs: DriveDisc[],
  profile: BuildProfile,
  knowledge: OptimizerKnowledge,
  gameDataVersion: string,
  options: OptimizerOptions = {},
): OptimizationResult {
  const startedAt = performance.now()
  const topK = options.topK ?? 3
  const allowLocked = options.allowLocked ?? true
  const fixedDisc = options.fixedDiscId
    ? discs.find((disc) => disc.id === options.fixedDiscId)
    : undefined
  if (options.fixedDiscId && !fixedDisc) throw new Error('固定的驱动盘已不存在。')

  const excludedLockedCount = allowLocked ? 0 : discs.filter((disc) => disc.locked).length
  const eligibleByLock = allowLocked ? discs : discs.filter((disc) => !disc.locked)
  const excludedIllegalMainStatCount = eligibleByLock.filter(
    (disc) => !isAllowedMainStat(knowledge, disc.slot, disc.mainStat),
  ).length
  const mainStatEligible = eligibleByLock.filter((disc) =>
    isAllowedMainStat(knowledge, disc.slot, disc.mainStat),
  )
  const supportedSets = new Set(
    knowledge.setPlans.flatMap((plan) => [...plan.primarySets, ...plan.secondarySets]),
  )
  const excludedUnsupportedSetCount = mainStatEligible.filter(
    (disc) => !supportedSets.has(disc.setId),
  ).length
  const eligible = mainStatEligible.filter((disc) => supportedSets.has(disc.setId))
  if (fixedDisc && !eligible.some((disc) => disc.id === fixedDisc.id)) {
    throw new Error('固定盘不满足当前场景的锁定或主词条约束。')
  }

  const panelInput = options.panelInput
  const {
    wantsPanelObjective,
    useObjective: panelReady,
    contributions,
    baseAttack,
    objectiveTarget,
    requestedTarget,
  } = prepareCandidatePanelObjective(profile.agentId, eligible, panelInput)
  // A source-bound panel objective may coexist with other legal set branches.
  // Keep it available for its named four-piece without lending the threshold to
  // physical builds that resolve to another primary set.
  const requiredObjectiveSet = objectiveTarget?.requiredFourPieceSet
  const objectiveSourceSupported = candidatePanelObjectiveSupportsSetPlans(
    objectiveTarget,
    knowledge.setPlans,
  )
  const useObjective = panelReady && objectiveSourceSupported
  let objectiveLimited = false

  const candidates = new Map<number, DiscContribution[]>()
  for (let slot = 1; slot <= 6; slot += 1) {
    const scoredSlotCandidates = eligible
      .filter(
        (disc) =>
          disc.slot === slot && (!fixedDisc || fixedDisc.slot !== slot || disc.id === fixedDisc.id),
      )
      .map((disc) => scoreActualDisc(disc, profile))
      .sort((left, right) => right.score - left.score || left.disc.id.localeCompare(right.disc.id))
    if (useObjective || options.candidateLimitPerSlot === undefined) {
      candidates.set(slot, scoredSlotCandidates)
      continue
    }
    candidates.set(
      slot,
      retainSetRepresentatives(scoredSlotCandidates, options.candidateLimitPerSlot, topK),
    )
  }
  const candidateCounts = Object.fromEntries(
    [...candidates].map(([slot, items]) => [slot, items.length]),
  )
  const baseResult = {
    consideredCount: eligible.length,
    excludedLockedCount,
    excludedIllegalMainStatCount,
    excludedUnsupportedSetCount,
    candidateCounts,
    warehouseSnapshotHash:
      options.warehouseSnapshot?.discs === discs
        ? options.warehouseSnapshot.hash
        : contentHash(discs),
    profileVersion: profile.version,
    knowledgeVersion: knowledge.contentHash,
    gameDataVersion,
    ruleVersion: `${evaluationRules.ruleVersion}:${actualDiscScoreVersion}`,
  }
  if ([...candidates.values()].some((items) => items.length === 0)) {
    return {
      ...baseResult,
      builds: [],
      elapsedMs: round(performance.now() - startedAt),
      warnings: ['至少一个号位没有满足当前主词条或锁定条件的候选盘。'],
    }
  }

  const allowedPatterns = allowedSetCountPatterns(knowledge)
  if (!allowedPatterns.length) {
    return {
      ...baseResult,
      builds: [],
      elapsedMs: round(performance.now() - startedAt),
      warnings: ['当前知识资料没有可组成六张驱动盘的合法套装方案。'],
    }
  }

  let states = new Map<string, PartialBuild[]>([
    ['', [{ discs: [], score: 0, setCounts: {}, tieBreakKey: '' }]],
  ])
  for (let slot = 1; slot <= 6; slot += 1) {
    const next = new Map<string, PartialBuild[]>()
    if (!useObjective) {
      const scalarNext = new Map<string, ScalarExtension[]>()
      const candidatesBySet = new Map<string, DiscContribution[]>()
      for (const candidate of candidates.get(slot) ?? []) {
        const bucket = candidatesBySet.get(candidate.disc.setId) ?? []
        bucket.push(candidate)
        candidatesBySet.set(candidate.disc.setId, bucket)
      }
      for (const partials of states.values()) {
        const sourceCounts = partials[0]!.setCounts
        for (const [setId, setCandidates] of candidatesBySet) {
          const setCounts = {
            ...sourceCounts,
            [setId]: (sourceCounts[setId] ?? 0) + 1,
          }
          if (!canStillCompleteSetPattern(setCounts, 6 - slot, allowedPatterns)) continue
          const key = countKey(setCounts)
          const bucket = scalarNext.get(key) ?? []
          for (const partial of partials) {
            for (const candidate of setCandidates) {
              insertTopK(
                bucket,
                {
                  partial,
                  candidate,
                  setCounts,
                  tieBreakKey: tieBreak([...partial.discs, candidate]),
                  score: round(partial.score + candidate.score),
                },
                topK,
                comparePartial,
              )
            }
          }
          scalarNext.set(key, bucket)
        }
      }
      for (const [key, extensions] of scalarNext)
        next.set(
          key,
          extensions.map(({ partial, candidate, setCounts, score, tieBreakKey }) => ({
            discs: [...partial.discs, candidate],
            score,
            setCounts,
            tieBreakKey,
          })),
        )
      states = next
      continue
    }
    for (const partials of states.values()) {
      for (const partial of partials) {
        for (const candidate of candidates.get(slot) ?? []) {
          const setCounts = {
            ...partial.setCounts,
            [candidate.disc.setId]: (partial.setCounts[candidate.disc.setId] ?? 0) + 1,
          }
          if (!canStillCompleteSetPattern(setCounts, 6 - slot, allowedPatterns)) continue
          const key = countKey(setCounts)
          const bucket = next.get(key) ?? []
          bucket.push({
            discs: [...partial.discs, candidate],
            score: round(partial.score + candidate.score),
            setCounts,
            tieBreakKey: tieBreak([...partial.discs, candidate]),
            attack: (partial.attack ?? 0) + contributions.get(candidate.disc.id)!.attack,
            priority: (partial.priority ?? 0) + contributions.get(candidate.disc.id)!.priority,
          })
          // Same set counts imply identical eventual set modifiers. ATK/priority/score dominance is
          // conservative for this monotone capped-ATK objective; keep topK equivalent identities.
          const added = bucket[bucket.length - 1]!
          const dominates = (a: PartialBuild, b: PartialBuild) =>
            a.attack! >= b.attack! &&
            a.priority! >= b.priority! &&
            a.score >= b.score &&
            (a.attack! > b.attack! ||
              a.priority! > b.priority! ||
              a.score > b.score ||
              comparePartial(a, b) < 0)
          if (bucket.filter((item) => item !== added && dominates(item, added)).length >= topK)
            bucket.pop()
          else {
            for (let index = bucket.length - 2; index >= 0; index -= 1) {
              const item = bucket[index]!
              if (
                dominates(added, item) &&
                bucket.filter((other) => other !== item && dominates(other, item)).length >= topK
              )
                bucket.splice(index, 1)
            }
          }
          if (bucket.length > Math.max(topK * 8, 24)) {
            objectiveLimited = true
            const canStillUseObjective =
              !requiredObjectiveSet || (setCounts[requiredObjectiveSet] ?? 0) + (6 - slot) >= 4
            bucket.sort(
              canStillUseObjective
                ? (a, b) =>
                    Math.min(objectiveTarget!.minimumAttack, baseAttack + b.attack!) -
                      Math.min(objectiveTarget!.minimumAttack, baseAttack + a.attack!) ||
                    b.priority! - a.priority! ||
                    comparePartial(a, b)
                : comparePartial,
            )
            bucket.length = Math.max(topK * 8, 24)
          }
          next.set(key, bucket)
        }
      }
    }
    states = next
  }

  const resolvedBuilds = [...states.values()].flat().flatMap((partial) => {
    if (!meetsMinimumTargets(partial.discs, knowledge)) return []
    const setPlan = resolveSetPlan(partial.setCounts, profile, knowledge)
    if (!setPlan) return []
    const usesPanelObjective =
      useObjective && candidatePanelObjectiveAppliesToSetPlan(objectiveTarget, setPlan)
    const panelObjective =
      usesPanelObjective && panelInput
        ? projectCandidatePanelObjective(
            objectiveTarget!,
            panelInput,
            partial.discs.map((item) => item.disc),
          )
        : undefined
    return [
      {
        usesPanelObjective,
        build: {
          rank: 0,
          discs: partial.discs,
          totalScore: round(partial.score + setPlan.score),
          discScore: partial.score,
          setScore: setPlan.score,
          effectiveRolls: partial.discs.reduce((sum, item) => sum + item.effectiveRolls, 0),
          setCounts: partial.setCounts,
          setPattern: setPlan.pattern,
          tieBreakKey: partial.tieBreakKey,
          ...(panelObjective ? { panelObjective } : {}),
        },
      },
    ]
  })
  const hasApplicablePhysicalBuild = resolvedBuilds.some((item) => item.usesPanelObjective)
  const hasOtherPhysicalBuild = resolvedBuilds.some((item) => !item.usesPanelObjective)
  const { status: resultObjectiveStatus, mixedBranches: mixedPhysicalBranches } =
    resolveCandidatePanelObjectiveStatus({
      requested: wantsPanelObjective,
      hasApplicableBuild: hasApplicablePhysicalBuild,
      hasOtherBuild: hasOtherPhysicalBuild,
      searchLimited: objectiveLimited,
    })
  const builds = resolvedBuilds
    .map(({ usesPanelObjective, build }) => ({
      ...build,
      ...(wantsPanelObjective
        ? {
            panelObjectiveStatus: usesPanelObjective
              ? resultObjectiveStatus
              : mixedPhysicalBranches
                ? ('limited' as const)
                : ('unsupported' as const),
          }
        : {}),
    }))
    .sort(
      (left, right) =>
        compareCandidatePanelObjective(left.panelObjective, right.panelObjective) ||
        right.totalScore - left.totalScore ||
        left.tieBreakKey.localeCompare(right.tieBreakKey),
    )
    .slice(0, topK)
    .map((build, index) => ({ ...build, rank: index + 1 }))

  return {
    ...baseResult,
    builds,
    elapsedMs: round(performance.now() - startedAt),
    ...(wantsPanelObjective
      ? {
          panelObjectiveStatus: resultObjectiveStatus!,
        }
      : {}),
    warnings: [
      ...(wantsPanelObjective
        ? [
            candidatePanelObjectiveWarning(
              requestedTarget!,
              resultObjectiveStatus!,
              mixedPhysicalBranches,
            ),
          ]
        : []),
      '仓库没有可验证的已装备状态；当前结果按“装备状态未知但允许参与”处理。',
      '综合分用于当前模板内比较，不是完整伤害仿真。',
    ],
  }
}
