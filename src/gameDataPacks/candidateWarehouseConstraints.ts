import type { AgentDiscProfile } from '../assault/engine'
import {
  evaluateCandidateSetPlanEligibility,
  qualifyCandidateSetPlan,
} from './candidateSetPlanEligibility'
import { getBuildRecommendation, getCurrentBuildProfile } from '../assault/currentBuildProfiles'
import { driveDiscData } from '../data/gameData'
import type { DriveDisc, StatKey } from '../domain/schemas'
import {
  playerBuildProfiles30,
  type PlayerBuildField,
  type PlayerBuildSource,
} from './playerBuildProfiles'
import { candidateWarehouseConstraints31 } from './gameData31CatalogIntake'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import { stableContentHash } from './types'
import {
  candidateSetIdsInSourceOrder,
  compileCandidateSetPlans,
  type CandidateSetPlan,
} from './candidateSetPlans'
import {
  resolveReviewedTeamDiscDirections,
  type AppliedReviewedTeamDiscDirection,
  type ReviewedTeamDiscConditionContext,
} from './reviewedTeamDiscConditions'
import { asStrings, candidateStatKeys, candidateSubStatWeights } from './candidateStatParsing'
import { getReviewedAdditionalDiscPlans } from './reviewedAdditionalDiscDirections'
import {
  getReviewedMainStatAlternatives,
  type ReviewedMainStatAlternative,
} from './reviewedMainStatAlternatives'
export { candidateStatKeys, candidateSubStatWeights } from './candidateStatParsing'

export type CandidateWarehouseConstraint = {
  agentId: string
  agentName: string
  gameVersion: '3.0' | '3.1'
  status: 'candidate' | 'missing'
  setPlanReadiness:
    | {
        status: 'executable'
        pattern: CandidateSetPlan['pattern']
        primarySetIds: string[]
        secondarySetIds: string[]
      }
    | {
        status: 'non_executable'
        reason: 'missing_secondary_set' | 'unresolved_set_roles'
        missingEvidence: string
      }
  sources: PlayerBuildSource[]
  setIds: string[]
  /** Explicit source branches; readiness is the first-branch compatibility projection. */
  setPlans?: CandidateSetPlan[]
  unresolvedSetDirections?: string[]
  mainStats: Partial<Record<'4' | '5' | '6', StatKey[]>>
  /** Sourced purpose-specific guidance; never flattened into automatic eligibility. */
  mainStatAlternatives?: ReviewedMainStatAlternative[]
  subStatWeights: Partial<Record<StatKey, number>>
  wEngineDirections: string[]
  teamAndBangbooPreconditions: string[]
  progressionDirection: string[]
  targetPanel?: {
    level: 60
    values: Partial<
      Record<
        'atk' | 'hp' | 'def' | 'critRate' | 'critDamage',
        number | { min: number; max?: number; upperOpen?: boolean }
      >
    >
    conditions: string[]
    sourceIds: string[]
    label: 'guide_reference_range'
  }
  gaps: string[]
  boundary: string
  contentHash: string
}

/** Frozen recommendation payload compiled into a solve-specific Build Intent. */
export type CandidateWarehouseRecommendation = {
  agentId: string
  constraint: CandidateWarehouseConstraint | null
}

export function deriveCandidateSetPlanReadiness(
  plans: readonly CandidateSetPlan[],
): CandidateWarehouseConstraint['setPlanReadiness'] {
  const firstPlan = plans[0]
  if (firstPlan)
    return {
      status: 'executable',
      pattern: firstPlan.pattern,
      primarySetIds: firstPlan.primarySetIds,
      secondarySetIds: firstPlan.secondarySetIds,
    }
  return {
    status: 'non_executable',
    reason: 'missing_secondary_set',
    missingEvidence:
      '来源只明确了一个驱动盘套装，缺少可验证的副套装；保留 Candidate 方向，但不得伪造 4+2 或 2+2+2。',
  }
}

function buildField(profileId: string, path: string): PlayerBuildField {
  const profile = playerBuildProfiles30.find((item) => item.agentId === profileId)
  const field = profile?.fields.find((item) => item.path === path)
  if (!field) throw new Error(`缺少 ${profileId}.${path} 的字段账本。`)
  return field
}

function sourceList(fields: PlayerBuildField[]) {
  return fields.flatMap((field) => (field.source ? [field.source] : []))
}

function setIdsFrom(text: string[]) {
  return [...new Set(text.flatMap(candidateSetIdsInSourceOrder))]
}

function mainStatsFrom(value: unknown): CandidateWarehouseConstraint['mainStats'] {
  const mainStats: CandidateWarehouseConstraint['mainStats'] = {}
  // Text aliases also serve substats (e.g. 穿透值). Only canonical legal
  // main stats may cross the recommendation -> solver boundary for this slot.
  const legalKeys = (slot: '4' | '5' | '6', text: string) => {
    const allowed = driveDiscData?.rules.mainStatsBySlot[slot] ?? []
    return candidateStatKeys(text).filter((key) => allowed.includes(key))
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && 'mainStats' in value) {
    const explicit = (value as { mainStats?: Record<string, unknown> }).mainStats ?? {}
    for (const slot of ['4', '5', '6'] as const) {
      const keys = legalKeys(slot, asStrings(explicit[slot]).join('；'))
      if (keys.length) mainStats[slot] = [...new Set(keys)]
    }
  }
  const text = asStrings(value)
  for (const slot of ['4', '5', '6'] as const) {
    if (mainStats[slot]?.length) continue
    const fragments = text.filter((item) => item.includes(`${slot}号位`))
    const keys = legalKeys(slot, fragments.join('；'))
    if (keys.length) mainStats[slot] = [...new Set(keys)]
  }
  return mainStats
}

function candidateConstraint(agentId: string): CandidateWarehouseConstraint {
  const profile = playerBuildProfiles30.find((item) => item.agentId === agentId)
  if (!profile) throw new Error(`未知代理人 ${agentId}`)
  const fields = [
    buildField(agentId, 'build.wengines'),
    buildField(agentId, 'build.drive_disc_sets'),
    buildField(agentId, 'build.main_sub_stats'),
    buildField(agentId, 'build.progression'),
    buildField(agentId, 'build.team_bangboo_scenario'),
  ]
  // Historical supplements remain readable in Authority. Their textual prerequisites
  // are not executable eligibility gates, so they must not broaden solver/scoring inputs.
  const setIds = [...new Set(setIdsFrom(asStrings(fields[1].value)))]
  const originalProfile = getCurrentBuildProfile(agentId)
  const originalRecommendation = originalProfile
    ? getBuildRecommendation(originalProfile, originalProfile.defaultBranchId)
    : null
  const reviewedAdditionalPlans = getReviewedAdditionalDiscPlans(agentId)
  const reviewedSourceTexts = new Set(
    reviewedAdditionalPlans.flatMap((plan) => (plan.sourceText ? [plan.sourceText] : [])),
  )
  const compiledSetPlans = [
    ...compileCandidateSetPlans(
      asStrings(fields[1].value),
      originalRecommendation?.sets.map((plan) => ({
        pattern: plan.pattern,
        primarySets: plan.primary,
        secondarySets: plan.secondary,
      })),
    ).filter((plan) => !plan.sourceText || !reviewedSourceTexts.has(plan.sourceText)),
    ...reviewedAdditionalPlans,
  ]
  // The archived Grace Thunder 4 branch requires Shock coverage. This generic
  // entry has no verified Shock context; preserve Freedom 4 and the source union.
  const setPlans =
    agentId === 'agent-grace'
      ? compiledSetPlans.filter(
          (plan) => !(plan.pattern === '4+2' && plan.primarySetIds.includes('set-thunder-metal')),
        )
      : agentId === 'agent-banyue'
        ? compiledSetPlans.filter((plan) => !plan.secondarySetIds.includes('set-inferno-metal'))
        : compiledSetPlans
  const unresolvedSetDirections = asStrings(fields[1].value).filter(
    (direction) =>
      !setIds.includes(direction) &&
      !compiledSetPlans.some((plan) => plan.sourceText === direction),
  )
  const setPlanReadiness: CandidateWarehouseConstraint['setPlanReadiness'] = setPlans.length
    ? deriveCandidateSetPlanReadiness(setPlans)
    : setIds.length <= 1
      ? deriveCandidateSetPlanReadiness([])
      : {
          status: 'non_executable',
          reason: 'unresolved_set_roles',
          missingEvidence: '来源尚未明确完整搭配的主套与副套；不得把已知的 2 件套替代为 4 件套。',
        }
  const mainStats = mainStatsFrom(fields[2].value)
  const mainStatAlternatives = getReviewedMainStatAlternatives(agentId)
  const weights = candidateSubStatWeights(fields[2].value)
  const gaps = [
    ...(setIds.length ? [] : ['未能从来源字段归一化为现有驱动盘套装。']),
    ...(Object.keys(mainStats).length === 3
      ? []
      : ['未能从来源字段归一化完整的 4/5/6 号位主词条。']),
    ...(Object.keys(weights).length ? [] : ['未能从来源字段归一化有效副词条优先级。']),
  ]
  const status: CandidateWarehouseConstraint['status'] =
    gaps.length === 0 &&
    fields.every((field) => field.status === 'candidate' && field.source?.verified)
      ? 'candidate'
      : 'missing'
  const input = {
    agentId,
    agentName: profile.agentName,
    gameVersion: '3.0' as const,
    status,
    sources: [...sourceList(fields), ...mainStatAlternatives.map((entry) => entry.source)],
    setIds,
    setPlans,
    unresolvedSetDirections,
    setPlanReadiness,
    mainStats,
    ...(mainStatAlternatives.length ? { mainStatAlternatives } : {}),
    subStatWeights: weights,
    wEngineDirections: asStrings(fields[0].value),
    teamAndBangbooPreconditions: asStrings(fields[4].value),
    progressionDirection: asStrings(fields[3].value),
    gaps,
    boundary:
      '候选仓库评分仅比较来源明确的套装、词条与盘面匹配，不是精确伤害、最高伤害、正式最优或自动写入。',
  }
  return { ...input, contentHash: stableContentHash(input) }
}

export const candidateWarehouseConstraints30 = playerBuildProfiles30.map((profile) =>
  candidateConstraint(profile.agentId),
)

export function getCandidateWarehouseConstraint(agentId: string) {
  const releasedAgentId = resolveCurrentReleasedIdentity(agentId)
  return (
    candidateWarehouseConstraints30.find(
      (constraint) => resolveCurrentReleasedIdentity(constraint.agentId) === releasedAgentId,
    ) ??
    candidateWarehouseConstraints31.find(
      (constraint) => resolveCurrentReleasedIdentity(constraint.agentId) === releasedAgentId,
    )
  )
}

function sourceForReviewedTeamDiscDirection(
  direction: AppliedReviewedTeamDiscDirection,
): PlayerBuildSource {
  return {
    id: `reviewed-team-disc-${direction.id}`,
    url: direction.source.url,
    sourceVersion: direction.source.sourceVersion,
    checkedAt: '2026-09-08T00:00:00.000Z',
    contentHash: direction.source.contentHash,
    licenseBoundary:
      '米游社原帖的精确队伍条件化候选构筑方向；仅用于本地 candidate 盘套分支，不作为 Formal、精确伤害、最高伤害或自动写入。',
    verified: true,
  }
}

/**
 * Compiles a source-declared team condition into the existing candidate
 * warehouse shape.  No agent-specific branch lives here: additional reviewed
 * directions can be declared in reviewedTeamDiscConditions.ts.
 */
export function getCandidateWarehouseConstraintForTeam(
  agentId: string,
  context: ReviewedTeamDiscConditionContext,
): CandidateWarehouseConstraint | undefined {
  const base = getCandidateWarehouseConstraint(agentId)
  if (!base) return undefined
  const directions = resolveReviewedTeamDiscDirections(base.agentId, context)
  if (!directions.length) {
    const plans = candidateSetPlansForConstraint(base)
    const retained = plans.filter(
      (plan) =>
        evaluateCandidateSetPlanEligibility(base.agentId, plan, context).status !==
        'condition-not-met',
    )
    if (retained.length === plans.length) return base
    const input = {
      ...base,
      setPlans: retained,
      setPlanReadiness: deriveCandidateSetPlanReadiness(retained),
      setIds: [
        ...new Set(retained.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds])),
      ],
    }
    return { ...input, contentHash: stableContentHash(input) }
  }
  if (directions.length !== 1)
    throw new Error(`代理人 ${base.agentId} 的精确队伍条件匹配到多个冲突盘套分支。`)
  const direction = directions[0]!
  const setPlans = [
    direction.setPlan,
    ...(direction.retainBasePlans ? candidateSetPlansForConstraint(base) : []),
  ]
  const input = {
    ...base,
    ...(direction.mainStats ? { mainStats: { ...base.mainStats, ...direction.mainStats } } : {}),
    ...(direction.subStatWeights ? { subStatWeights: direction.subStatWeights } : {}),
    sources: [
      ...base.sources,
      sourceForReviewedTeamDiscDirection(direction),
      ...(direction.additionalSources ?? []),
    ],
    setIds: [
      ...new Set(setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds])),
    ],
    setPlans,
    unresolvedSetDirections: [],
    setPlanReadiness: deriveCandidateSetPlanReadiness(setPlans),
    teamAndBangbooPreconditions: [
      ...base.teamAndBangbooPreconditions,
      `精确队伍条件盘套：${direction.id}；${direction.source.locator.text}`,
    ],
    boundary: `${base.boundary} ${direction.boundary}`,
  }
  return { ...input, contentHash: stableContentHash(input) }
}

/** Adapts sourced candidate directions to the existing optimizer input without making it formal. */
export function candidateConstraintToDiscProfile(
  constraint: CandidateWarehouseConstraint,
): AgentDiscProfile | null {
  if (constraint.status !== 'candidate' || constraint.setPlanReadiness.status !== 'executable')
    return null
  const setFit = Object.fromEntries(constraint.setIds.map((setId) => [setId, 1]))
  return {
    agentId: constraint.agentId,
    version: `candidate-${constraint.contentHash.slice(0, 12)}`,
    statWeights: constraint.subStatWeights,
    mainStatFit: {
      1: { hp_flat: 1 },
      2: { atk_flat: 1 },
      3: { def_flat: 1 },
      4: Object.fromEntries((constraint.mainStats['4'] ?? []).map((stat) => [stat, 1])),
      5: Object.fromEntries((constraint.mainStats['5'] ?? []).map((stat) => [stat, 1])),
      6: Object.fromEntries((constraint.mainStats['6'] ?? []).map((stat) => [stat, 1])),
    },
    setFit,
    setPlans: candidateSetPlansForConstraint(constraint).map((plan) => ({
      pattern: plan.pattern,
      primarySets: plan.primarySetIds,
      secondarySets: plan.secondarySetIds,
    })),
    confidence: 'low',
    gameVersion: constraint.gameVersion,
    scenario: constraint.teamAndBangbooPreconditions.join('；'),
    teamAssumptions: constraint.teamAndBangbooPreconditions,
    contextRationale: [
      constraint.boundary,
      ...candidateSetPlansForConstraint(constraint).flatMap((plan) =>
        plan.sourceText ? [plan.sourceText] : [],
      ),
    ],
  }
}

/** One branch-preserving read for the solver and player-facing recommendation. */
export function candidateSetPlansForConstraint(
  constraint: CandidateWarehouseConstraint,
): CandidateSetPlan[] {
  if (constraint.setPlanReadiness.status !== 'executable') return []
  const plans = constraint.setPlans ?? [
    {
      pattern: constraint.setPlanReadiness.pattern,
      primarySetIds: constraint.setPlanReadiness.primarySetIds,
      secondarySetIds: constraint.setPlanReadiness.secondarySetIds,
    },
  ]
  return plans.flatMap((plan) =>
    plan.pattern === '4+2'
      ? plan.primarySetIds.flatMap((primarySetId) => {
          const secondarySetIds = plan.secondarySetIds.filter(
            (secondarySetId) => secondarySetId !== primarySetId,
          )
          return secondarySetIds.length
            ? [
                qualifyCandidateSetPlan(constraint.agentId, {
                  ...plan,
                  primarySetIds: [primarySetId],
                  secondarySetIds,
                }),
              ]
            : []
        })
      : [qualifyCandidateSetPlan(constraint.agentId, plan)],
  )
}

export type CandidateDiscScore = {
  discId: string
  score: number
  setMatch: number
  mainStatMatch: number
  effectiveSubstatRolls: number
  boundary: string
}

export function scoreDiscForCandidateConstraint(
  disc: DriveDisc,
  constraint: CandidateWarehouseConstraint,
): CandidateDiscScore | null {
  const profile = candidateConstraintToDiscProfile(constraint)
  if (!profile) return null
  const setMatch = profile.setFit[disc.setId] ?? 0
  const mainStatMatch = profile.mainStatFit[String(disc.slot)]?.[disc.mainStat] ?? 0
  const effectiveSubstatRolls = disc.subStats.reduce(
    (total, subStat) => total + (profile.statWeights[subStat.stat] ?? 0) * (subStat.upgrades + 1),
    0,
  )
  return {
    discId: disc.id,
    score:
      Math.round((setMatch * 30 + mainStatMatch * 35 + effectiveSubstatRolls * 10) * 100) / 100,
    setMatch,
    mainStatMatch,
    effectiveSubstatRolls: Math.round(effectiveSubstatRolls * 100) / 100,
    boundary: constraint.boundary,
  }
}

export const candidateWarehouseCoverage30 = {
  total: candidateWarehouseConstraints30.length,
  candidate: candidateWarehouseConstraints30.filter((item) => item.status === 'candidate').length,
  missing: candidateWarehouseConstraints30.filter((item) => item.status === 'missing').length,
  executable: candidateWarehouseConstraints30.filter(
    (item) => item.status === 'candidate' && item.setPlanReadiness.status === 'executable',
  ).length,
  nonExecutable: candidateWarehouseConstraints30.filter(
    (item) => item.status === 'candidate' && item.setPlanReadiness.status === 'non_executable',
  ).length,
  formal: 0,
  exactDamage: 0,
  contentHash: stableContentHash(candidateWarehouseConstraints30),
} as const

/** Machine-readable handoff for the few profiles that remain non-scoreable after source normalization. */
export const candidateWarehouseGapReport30 = candidateWarehouseConstraints30
  .filter((constraint) => candidateConstraintToDiscProfile(constraint) === null)
  .map((constraint) => ({
    agentId: constraint.agentId,
    agentName: constraint.agentName,
    missing: [
      ...constraint.gaps,
      ...(constraint.setPlanReadiness.status === 'non_executable'
        ? [constraint.setPlanReadiness.missingEvidence]
        : []),
    ],
    checkedSources: constraint.sources.map((source) => ({
      url: source.url,
      sourceVersion: source.sourceVersion,
      checkedAt: source.checkedAt,
      licenseBoundary: source.licenseBoundary,
    })),
    nextEvidence:
      constraint.setPlanReadiness.status === 'non_executable' &&
      constraint.setPlanReadiness.reason === 'unresolved_set_roles'
        ? constraint.setPlanReadiness.missingEvidence
        : constraint.setPlanReadiness.status === 'non_executable'
          ? '需补可验证的副套装来源；在此之前只保留方向，不生成 optimizer profile。'
          : '需补可验证的驱动盘套装与 4/5/6 号位来源字段；不得按特性或文本定位自动生成评分约束。',
  }))

export const candidateWarehouse31DeltaBoundary = {
  gameVersion: '3.1',
  status: 'candidate' as const,
  operation: 'add/change/deprecate',
  invalidation:
    '只重跑新增角色或受影响字段的来源归一化；未变化的 3.0 candidate 约束保留其来源身份，不能自动升格为 formal。',
  rollback: '回滚只切换候选约束 manifest，不写入玩家资产、锁定、标签或仓库。',
}
