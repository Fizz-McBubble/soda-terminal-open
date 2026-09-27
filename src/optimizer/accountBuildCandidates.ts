import type { BuildProfile, DriveDisc, StatKey } from '../domain/schemas'
import type { AgentDiscProfile } from '../assault/engine'
import { contentHash } from '../evaluation/contentHash'
import {
  optimizeBuild,
  type OptimizerKnowledge,
  type DiscContribution,
  type OptimizedBuild,
  type CandidatePanelInput,
} from './optimizeBuild'
import type { AccountLoadout } from './optimizeAccountBuilds'

export type CandidateBuild = AccountLoadout & { discIds: Set<string> }

export function toBuildProfile(profile: AgentDiscProfile): BuildProfile {
  const now = '2026-07-04T00:00:00.000Z'
  return {
    id: `account:${profile.agentId}`,
    agentId: profile.agentId,
    name: profile.scenario ?? '角色候选配装',
    role: 'damage',
    statWeights: profile.statWeights,
    version: profile.version,
    isDefault: true,
    sourceTemplateId: null,
    archived: false,
    mainStatFit: profile.mainStatFit,
    setFit: profile.setFit,
    createdAt: now,
    updatedAt: now,
  }
}

/** Derive executable constraints only: AgentDiscProfile has no source provenance. */
export function createAccountOptimizerKnowledge(
  profile: AgentDiscProfile,
  mainStats: Record<string, StatKey[]>,
): OptimizerKnowledge {
  const core = {
    mainStats,
    minimumSubstatValues: {},
    setPlans: profile.setPlans?.length
      ? profile.setPlans
      : [
          {
            pattern: '2+2+2' as const,
            primarySets: Object.keys(profile.setFit),
            secondarySets: [],
          },
        ],
  }
  return { ...core, contentHash: contentHash({ profileVersion: profile.version, ...core }) }
}

function choiceFromContribution(item: DiscContribution, profile: AgentDiscProfile) {
  const effective = item.disc.subStats.filter((stat) => (profile.statWeights[stat.stat] ?? 0) > 0)
  return {
    ...item,
    effectiveLines: effective.length,
    effectiveRolls: effective.reduce((sum, stat) => sum + stat.upgrades + 1, 0),
    wastedUpgrades: item.disc.subStats
      .filter((stat) => (profile.statWeights[stat.stat] ?? 0) <= 0)
      .reduce((sum, stat) => sum + stat.upgrades, 0),
  }
}

export function toCandidate(
  build: OptimizedBuild,
  profile: AgentDiscProfile,
  degraded: boolean,
  degradeReasons: string[],
): CandidateBuild {
  const discs = build.discs.map((item) => choiceFromContribution(item, profile))
  return {
    agentId: profile.agentId,
    discs,
    totalScore: build.totalScore,
    ...(build.panelObjective ? { panelObjective: build.panelObjective } : {}),
    ...(build.panelObjectiveStatus ? { panelObjectiveStatus: build.panelObjectiveStatus } : {}),
    setCounts: build.setCounts,
    setPattern: build.setPattern,
    confidence: profile.confidence,
    scenario: profile.scenario ?? '角色候选配装',
    contextRationale: profile.contextRationale ?? [],
    teamAssumptions: profile.teamAssumptions ?? [],
    bangbooIds: profile.bangbooIds ?? [],
    degraded,
    degradeReasons,
    discIds: new Set(discs.map((item) => item.disc.id)),
  }
}

export function configuredMainStats(profile: AgentDiscProfile) {
  return Object.fromEntries(
    ['4', '5', '6'].map((slot) => [
      slot,
      (profile.mainStats?.[slot] ?? Object.keys(profile.mainStatFit[slot] ?? {})) as StatKey[],
    ]),
  )
}

export function fallbackMainStats(discs: DriveDisc[], profile: AgentDiscProfile) {
  const supportedSets = new Set(
    profile.setPlans?.flatMap((plan) => [...plan.primarySets, ...plan.secondarySets]) ??
      Object.keys(profile.setFit),
  )
  return Object.fromEntries(
    ['4', '5', '6'].map((slot) => {
      // A fallback can widen a source recommendation to other positively fitted
      // main stats, but it must never turn an arbitrary inventory element-damage
      // disc into a recommendation. Explicit source mainStats remain valid even
      // when they are cross-attribute for the profile's usual role.
      const supportedMainStats = new Set<StatKey>([
        ...((profile.mainStats?.[slot] ?? []) as StatKey[]),
        ...Object.entries(profile.mainStatFit[slot] ?? {})
          .filter(([, weight]) => weight > 0)
          .map(([stat]) => stat as StatKey),
      ])
      return [
        slot,
        [
          ...new Set(
            discs
              .filter(
                (disc) =>
                  String(disc.slot) === slot &&
                  supportedSets.has(disc.setId) &&
                  supportedMainStats.has(disc.mainStat),
              )
              .map((disc) => disc.mainStat),
          ),
        ],
      ]
    }),
  ) as Record<string, StatKey[]>
}

export function generateCandidates(
  discs: DriveDisc[],
  profile: AgentDiscProfile,
  options: {
    fixedDiscId?: string
    excludedDiscIds?: Set<string>
    allowLocked: boolean
    topK: number
    candidateLimitPerSlot?: number
    panelInput?: CandidatePanelInput
    warehouseSnapshot?: { discs: DriveDisc[]; hash: string }
  },
) {
  const available = options.excludedDiscIds?.size
    ? discs.filter((disc) => !options.excludedDiscIds?.has(disc.id))
    : discs
  const warehouseSnapshot =
    options.warehouseSnapshot?.discs === available
      ? options.warehouseSnapshot
      : { discs: available, hash: contentHash(available) }
  const strictMainStats = configuredMainStats(profile)
  const strict = optimizeBuild(
    available,
    toBuildProfile(profile),
    createAccountOptimizerKnowledge(profile, strictMainStats),
    'zzz-drive-disc-3.0-s4.1',
    {
      fixedDiscId: options.fixedDiscId,
      allowLocked: options.allowLocked,
      topK: options.topK,
      candidateLimitPerSlot: options.candidateLimitPerSlot ?? 20,
      panelInput: options.panelInput,
      warehouseSnapshot,
    },
  )
  if (strict.builds.length)
    return {
      candidates: strict.builds.map((build) =>
        toCandidate(
          build,
          profile,
          false,
          strict.panelObjectiveStatus ? strict.warnings.slice(0, 1) : [],
        ),
      ),
      strictCandidateCounts: strict.candidateCounts,
      relaxedCandidateCounts: strict.candidateCounts,
    }

  const relaxedMainStats = fallbackMainStats(available, profile)
  const relaxed = optimizeBuild(
    available,
    toBuildProfile(profile),
    createAccountOptimizerKnowledge(profile, relaxedMainStats),
    'zzz-drive-disc-3.0-s4.1',
    {
      fixedDiscId: options.fixedDiscId,
      allowLocked: options.allowLocked,
      topK: options.topK,
      candidateLimitPerSlot: options.candidateLimitPerSlot ?? 20,
      panelInput: options.panelInput,
      warehouseSnapshot,
    },
  )
  const relaxedSlots = ['4', '5', '6'].filter(
    (slot) =>
      relaxedMainStats[slot]?.some((stat) => !strictMainStats[slot]?.includes(stat)) ?? false,
  )
  const reasons = relaxedSlots.length
    ? [
        `库存无法同时满足推荐套装与${relaxedSlots.join('/')}号位主词条，保留合法套装组合并放宽主词条。`,
      ]
    : []
  return {
    candidates: relaxed.builds.map((build) =>
      toCandidate(build, profile, true, [
        ...reasons,
        ...(relaxed.panelObjectiveStatus ? relaxed.warnings.slice(0, 1) : []),
      ]),
    ),
    strictCandidateCounts: strict.candidateCounts,
    relaxedCandidateCounts: relaxed.candidateCounts,
  }
}
