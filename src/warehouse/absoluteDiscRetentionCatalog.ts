import { currentAgentDirectory } from '../assault/catalog'
import { driveDiscData } from '../data/gameData'
import type { DriveDisc } from '../domain/schemas'
import {
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { candidateSetIdsInSourceOrder } from '../gameDataPacks/candidateSetPlans'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentAssetCatalog } from '../gameDataPacks/currentAssetCatalog'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { reviewedTeamDiscDirections } from '../gameDataPacks/reviewedTeamDiscConditions'
import { stableContentHash } from '../gameDataPacks/types'
import { sourcedFunctionalMains } from './absoluteDiscRetentionFunctions'
import { retentionCondition } from './absoluteDiscRetentionConditions'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import {
  resolveRetentionQualityWeights,
  retentionWeightParameters,
  retentionWeightPolicyId,
} from './absoluteDiscRetentionWeights'
import type {
  Applicability,
  Catalog,
  Disc,
  Profile,
  QualityPolicy,
  CoverageGap,
  UtilityEvidence,
} from './absoluteDiscRetentionKernel'

const policyVersion = 'absolute-disc-retention-3.1-stage-r4'
const calibratedCutoffs = { cleanupBelow: 48, keepFrom: 60, premiumFrom: 67 } as const
const calibratedRarities = ['S'] as const

const released = currentAgentDirectory.filter(
  (entry) => entry.releaseState === 'released' && entry.accountOwnable,
)
const releasedAgentIds = [
  ...new Set(released.map((entry) => resolveCurrentReleasedIdentity(entry.id))),
]

function sourceIds(constraint: CandidateWarehouseConstraint) {
  return constraint.sources
    .filter((source) => source.verified)
    .map((source) => `${source.id}:${source.contentHash}`)
}

function applicability(evidence: UtilityEvidence): Applicability {
  return evidence.state === 'incidental' || evidence.state === 'incompatible'
    ? 'incompatible'
    : evidence.state === 'valid'
      ? 'valid'
      : 'conditional'
}

function profile(
  constraint: CandidateWarehouseConstraint,
  branchId: string,
  fourPieceIds: readonly string[],
  availability: Applicability,
  condition?: string | CandidateSetPlan['condition'],
  mainAvailability: Applicability = 'valid',
): Profile {
  const agentId = resolveCurrentReleasedIdentity(constraint.agentId)
  const sources = sourceIds(constraint)
  const facts = resolveRetentionUseFacts(constraint, agentId)
  const quality = resolveRetentionQualityWeights(constraint, agentId, facts)
  const mainStatsBySlot = Object.fromEntries(
    (['4', '5', '6'] as const).map((slot) => [
      slot,
      Object.fromEntries(
        (driveDiscData?.rules.mainStatsBySlot[slot] ?? []).map((stat): [string, Applicability] => [
          stat,
          (constraint.mainStats[slot] ?? []).includes(stat)
            ? 'valid'
            : constraint.status === 'candidate' &&
                sources.length > 0 &&
                constraint.mainStats[slot]?.length
              ? 'incompatible'
              : 'conditional',
        ]),
      ),
    ]),
  )
  // Recommendations define the main-stat gate for this build only. Other guide and
  // conditional alternatives are separate profiles; no other build's weights leak in.
  const functionalMains = sourcedFunctionalMains(
    constraint,
    agentId,
    fourPieceIds,
    sources[0] ?? '',
    facts.goal,
  )
  return {
    id: `${agentId}:${branchId}`,
    agentId,
    sourceIds: [
      ...new Set([
        ...sources,
        ...facts.sourceIds,
        ...functionalMains.map((entry) => entry.sourceId),
      ]),
    ],
    verified:
      constraint.status === 'candidate' &&
      sources.length > 0 &&
      Object.values(constraint.mainStats).every((stats) => stats.length > 0) &&
      Object.values(constraint.subStatWeights).some((weight) => (weight ?? 0) > 0),
    ...quality,
    goal: facts.goal,
    mainStatsBySlot,
    effectUtility: Object.fromEntries(
      Object.entries(facts.effects).map(([stat, evidence]) => [stat, applicability(evidence)]),
    ),
    actionUtility: Object.fromEntries(
      Object.entries(facts.actions).map(([stat, evidence]) => [stat, applicability(evidence)]),
    ),
    utilityEvidence: {
      ...facts.effects,
      ...Object.fromEntries(
        Object.entries(facts.actions).map(([key, value]) => [`action:${key}`, value]),
      ),
    },
    conditionEvidence: retentionCondition(condition, `${agentId}:${branchId}:condition`, sources),
    fourPieceUses: Object.fromEntries(fourPieceIds.map((id) => [id, availability])),
    functionalMains,
    availability,
    mainAvailability,
  }
}

function buildProfiles() {
  const profiles: Profile[] = []
  const missingAgentIds: string[] = []
  const unresolvedBranchIds: string[] = []
  const coverageGaps: CoverageGap[] = []
  for (const agentId of releasedAgentIds) {
    const base = getCandidateWarehouseConstraint(agentId)
    if (!base) {
      missingAgentIds.push(agentId)
      coverageGaps.push({
        agentId,
        field: `profiles.${agentId}`,
        detail: '该已发布角色缺少已审阅的构筑方向，无法证明与此盘无关。',
        sourceIds: [],
      })
      continue
    }
    if (base.status !== 'candidate') {
      missingAgentIds.push(agentId)
      coverageGaps.push({
        agentId,
        field: `profiles.${agentId}`,
        detail: '角色攻略分支未闭合。',
        sourceIds: sourceIds(base),
      })
    }
    const plans = candidateSetPlansForConstraint(base)
    if (!plans.length) profiles.push(profile(base, 'two-piece-only', [], 'valid'))
    else
      plans.forEach((plan, index) =>
        profiles.push(
          profile(
            base,
            `base-${index}:${stableContentHash(plan).slice(0, 10)}`,
            plan.pattern === '4+2' ? plan.primarySetIds : [],
            plan.condition || (plan.purpose && plan.purpose !== 'recommended')
              ? 'conditional'
              : 'valid',
            plan.condition ??
              (plan.purpose && plan.purpose !== 'recommended'
                ? `来源构筑用途：${plan.purpose}`
                : undefined),
          ),
        ),
      )
    for (const [index, alternative] of (base.mainStatAlternatives ?? []).entries()) {
      const branch = {
        ...base,
        mainStats: { ...base.mainStats, [alternative.slot]: [...alternative.stats] },
        sources: [...base.sources, alternative.source],
      } satisfies CandidateWarehouseConstraint
      profiles.push(
        profile(
          branch,
          `main-alt-${index}:${alternative.purpose}`,
          [],
          'conditional',
          alternative.condition ?? `来源主词替代用途：${alternative.purpose}`,
          'conditional',
        ),
      )
    }
    for (const [index, direction] of (base.unresolvedSetDirections ?? []).entries()) {
      const setIds = candidateSetIdsInSourceOrder(direction)
      const fourPieceIds = /4\s*件/.test(direction)
        ? setIds.length === 1
          ? setIds
          : /时使用/.test(direction)
            ? setIds.slice(-1)
            : []
        : []
      if (!setIds.length || (/4\s*件/.test(direction) && !fourPieceIds.length)) {
        unresolvedBranchIds.push(`${agentId}:${index}`)
        coverageGaps.push({
          agentId,
          field: `branches.${agentId}.${index}`,
          detail: direction,
          ...(setIds.length ? { setIds } : {}),
          sourceIds: sourceIds(base),
        })
        continue
      }
      profiles.push(
        profile(
          base,
          `condition-${index}:${stableContentHash(direction).slice(0, 10)}`,
          fourPieceIds,
          'conditional',
          direction,
        ),
      )
    }
    for (const direction of reviewedTeamDiscDirections.filter(
      (row) => resolveCurrentReleasedIdentity(row.agentId) === agentId,
    )) {
      const branch = {
        ...base,
        mainStats: { ...base.mainStats, ...direction.mainStats },
        subStatWeights: direction.subStatWeights ?? base.subStatWeights,
        sources: [
          ...base.sources,
          ...(direction.additionalSources ?? []),
          {
            id: `reviewed-team-disc-${direction.id}`,
            contentHash: direction.source.contentHash,
            url: direction.source.url,
            checkedAt: '2026-09-28T00:00:00.000Z',
            sourceVersion: direction.source.sourceVersion,
            licenseBoundary: direction.boundary,
            verified: true,
          },
        ],
      } satisfies CandidateWarehouseConstraint
      profiles.push(
        profile(
          branch,
          `reviewed-${direction.id}`,
          direction.setPlan.pattern === '4+2' ? direction.setPlan.primarySetIds : [],
          'conditional',
          direction.source.locator.text,
          direction.mainStats ? 'conditional' : 'valid',
        ),
      )
    }
  }
  return { profiles, missingAgentIds, unresolvedBranchIds, coverageGaps }
}

const built = buildProfiles()

const rules = driveDiscData?.rules
// Locked upstream consts/disc.ts: discSubstatRollData. Lower rarity spends more
// enhancement nodes unlocking lines; it must not inherit S-rarity's 3/4-line start.
const initialLineCountsByRarity = { B: [1, 2], A: [2, 3], S: [3, 4] }
const rarities = Object.fromEntries(
  (['B', 'A', 'S'] as const).map((rarity) => [
    rarity,
    {
      maxLevel: rules?.maxLevelByRarity[rarity] ?? 0,
      initialLineCounts: initialLineCountsByRarity[rarity],
      steps: Object.fromEntries(
        (rules?.subStatStepsByRarity[rarity] ?? []).map((row) => [row.stat, row.baseValue]),
      ),
    },
  ]),
)

const catalog: Catalog = {
  rules: {
    sourceIds: [
      ...(driveDiscData?.sources ?? []).map((source) => source.id),
      `genshin-optimizer:${currentDriveDiscFormulaCatalog.generatedFrom.commit}:libs/zzz/consts/src/disc.ts:discSubstatRollData`,
    ],
    standardRarity: 'S',
    enhancementInterval: 3,
    maxSubStats: 4,
    mainStatsBySlot: rules?.mainStatsBySlot ?? {},
    rarities,
  },
  sets: currentDriveDiscFormulaCatalog.items.map((item) => ({
    id: item.stableId,
    verified: true,
    sourceIds: [
      `${currentDriveDiscFormulaCatalog.generatedFrom.repository}:${currentDriveDiscFormulaCatalog.generatedFrom.commit}:${item.gameId}`,
    ],
    twoPieceEffects: item.twoPieceModifiers,
  })),
  profiles: built.profiles,
  releasedAgentIds,
  factsGameVersion: '3.1',
  assessmentGameVersion: '3.1',
  reviewedUseScope: '3.1:released-source-backed-guide-and-mechanic-reserve-objectives:r4',
  coverageGaps: built.coverageGaps,
  branchCoverageComplete:
    built.missingAgentIds.length === 0 &&
    built.unresolvedBranchIds.length === 0 &&
    releasedAgentIds.every((id) =>
      built.profiles.some((item) => item.agentId === id && item.verified),
    ),
}

/** Frozen policy identity includes the live branch, set-effect and game-rule inputs. */
export const absoluteDiscRetentionCatalogHash = stableContentHash({
  profiles: catalog.profiles,
  sets: catalog.sets,
  rules: catalog.rules,
  releasedAgentIds,
  missingAgentIds: built.missingAgentIds,
  unresolvedBranchIds: built.unresolvedBranchIds,
  coverageGaps: built.coverageGaps,
  reviewedUseScope: catalog.reviewedUseScope,
  weightPolicy: { id: retentionWeightPolicyId, parameters: retentionWeightParameters },
  factsVersion: catalog.factsGameVersion,
  sourceVersions: [
    currentAssetCatalog.gameVersion,
    driveDiscData?.dataVersion,
    currentDriveDiscFormulaCatalog.gameVersion,
  ],
})

/**
 * Independent S-rarity calibration and holdout fix the cleanup and strong-keep lines.
 * The premium line is a sufficient high-score signal, not a claim to catch every
 * excellent disc. Other rarities still receive quality/growth evidence but no cleanup.
 */
export const absoluteDiscRetentionPolicy: QualityPolicy = {
  id: `${policyVersion}:${absoluteDiscRetentionCatalogHash}`,
  calibration: 'approved',
  calibratedRarities,
  investment: {
    id: 'source-goal-stage-investment-r1',
    calibration: 'approved',
    meaningfulWeightFrom: 0.5,
    leftSlotMinimumLines: 2,
    rightSlotMinimumLines: 1,
    minimumCoreLines: 1,
    growthTarget: 'keepFrom',
    progressFloorBySpentNode: { '0': 0, '1': 0.25, '2': 0.45, '3': 0.65, '4': 0.85, '5': 1 },
  },
  byProfile: Object.fromEntries(
    catalog.profiles.map((item) => [
      item.id,
      Object.fromEntries([1, 2, 3, 4, 5, 6].map((slot) => [String(slot), calibratedCutoffs])),
    ]),
  ),
}

export const absoluteDiscRetentionCatalog = catalog
export const absoluteDiscRetentionCoverage = {
  releasedAgentCount: releasedAgentIds.length,
  profileCount: built.profiles.length,
  missingAgentIds: built.missingAgentIds,
  unresolvedBranchIds: built.unresolvedBranchIds,
  complete: catalog.branchCoverageComplete,
} as const

export function toAbsoluteRetentionDisc(disc: DriveDisc): Disc {
  return {
    id: disc.id,
    setId: disc.setId,
    slot: disc.slot,
    rarity: disc.rarity ?? 'S',
    level: disc.level,
    mainStat: disc.mainStat,
    subStats: disc.subStats,
  }
}
