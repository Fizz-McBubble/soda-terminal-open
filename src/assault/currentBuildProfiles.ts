import { targetAgents, seeds } from './currentBuildProfileSeeds'
export { unverifiedLegacyDirections } from './currentBuildProfileLegacyDirections'
import { contentHash } from '../evaluation/contentHash'
import { statKeySchema } from '../domain/schemas'
import { z } from 'zod'
import type { AgentDiscProfile } from './engine'
import type { AccountRoster, RosterAgent } from './types'

export type CurrentBuildProfileStatus = 'formal' | 'compatible_with_evidence' | 'stale' | 'missing'

const skillTargetSchema = z.object({
  basic: z.number().int().min(1).max(12).nullable(),
  dodge: z.number().int().min(1).max(12).nullable(),
  assist: z.number().int().min(1).max(12).nullable(),
  special: z.number().int().min(1).max(12).nullable(),
  chain: z.number().int().min(1).max(12).nullable(),
  core: z.number().int().min(1).max(7).nullable(),
})

export const currentBuildProfileSchema = z.object({
  schemaVersion: z.literal(1),
  profileVersion: z.string().min(1),
  gameVersion: z.literal('3.0'),
  collectedAt: z.string().datetime(),
  agentId: z.string().min(1),
  status: z.enum(['formal', 'compatible_with_evidence', 'stale', 'missing']),
  recommendationKind: z.literal('current_best_available'),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.array(z.string().min(1)).min(1),
  scenario: z.string().min(1),
  defaultBranchId: z.string().min(1),
  playstyleBranches: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      scenario: z.string().min(1),
      primarySetOverride: z.string().min(1).nullable(),
    }),
  ),
  recommendation: z
    .object({
      wEngines: z.array(z.string().min(1)).min(1),
      skillPriority: z.array(z.enum(['basic', 'dodge', 'assist', 'special', 'chain', 'core'])),
      skillTargets: skillTargetSchema,
      coreTarget: z.number().int().min(1).max(7),
      sets: z.array(
        z.object({
          pattern: z.enum(['4+2', '2+2+2']),
          primary: z.array(z.string().min(1)),
          secondary: z.array(z.string().min(1)),
        }),
      ),
      mainStats: z.object({
        '4': z.array(statKeySchema).min(1),
        '5': z.array(statKeySchema).min(1),
        '6': z.array(statKeySchema).min(1),
      }),
      substatWeights: z
        .record(z.string(), z.number().nonnegative())
        .refine((weights) =>
          Object.keys(weights).every((key) => statKeySchema.safeParse(key).success),
        ),
      teamConstraints: z.object({
        teammateNotes: z.array(z.string()),
        bangbooIds: z.array(z.string()),
      }),
    })
    .nullable(),
  sources: z.array(
    z.object({
      url: z.string().url(),
      updatedAt: z.string().datetime(),
      applicableVersion: z.string().min(1),
      publishedAt: z.string().datetime(),
      verifiedAt: z.string().datetime(),
    }),
  ),
  conflicts: z.array(z.string()),
  blocker: z.string().nullable(),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})

/**
 * Historical direction records retained as migration evidence. A record can enter the candidate
 * layer only through an explicit, agent-specific source assignment below; the map itself is never
 * a roster-wide fallback and never becomes formal optimizer input.
 */

/**
 * Creates a candidate only for an explicitly named page evidence row. This does not iterate over
 * the roster and never supplies a fallback for a missing profile.
 */

export const currentBuildProfiles = targetAgents.map((agentId) => {
  const seed = seeds[agentId]
  const core = {
    schemaVersion: 1 as const,
    profileVersion: '3.0.0',
    gameVersion: '3.0',
    collectedAt: '2026-07-03T00:00:00.000Z',
    agentId,
    recommendationKind: 'current_best_available' as const,
    ...seed,
    sources: seed.sources.map((source) => ({
      ...source,
      applicableVersion: source.sourceVersion ?? '3.0',
      publishedAt: source.updatedAt,
      verifiedAt: '2026-07-03T00:00:00.000Z',
    })),
  }
  return { ...core, contentHash: contentHash(core) }
})

export function getCurrentBuildProfile(agentId: string) {
  return currentBuildProfiles.find((profile) => profile.agentId === agentId)
}

export function resolveBuildProfileAvailability(
  profile: (typeof currentBuildProfiles)[number],
  gameVersion: string,
) {
  if (profile.gameVersion !== gameVersion)
    return { status: 'stale' as const, calculable: false, reason: `仅适用于${profile.gameVersion}` }
  if (!profile.recommendation || profile.status === 'stale' || profile.status === 'missing')
    return { status: profile.status, calculable: false, reason: profile.blocker ?? '资料不足' }
  if (profile.status !== 'formal')
    return {
      status: profile.status,
      calculable: false,
      reason: '候选构筑仅供玩家阅读和仓库约束参考，未进入正式求解。',
    }
  return { status: profile.status, calculable: true, reason: null }
}

export function applyCurrentBuildDefaults(agent: RosterAgent): RosterAgent {
  const profile = getCurrentBuildProfile(agent.agentId)
  return profile?.status === 'formal'
    ? applyBuildRecommendation(agent, profile.defaultBranchId)
    : agent
}

export function selectBuildBranch(agent: RosterAgent, branchId: string): RosterAgent {
  return applyBuildRecommendation(agent, branchId)
}

function applyBuildRecommendation(agent: RosterAgent, branchId: string): RosterAgent {
  const profile = getCurrentBuildProfile(agent.agentId)
  if (!profile || profile.status !== 'formal') return agent
  const recommendation = getBuildRecommendation(profile, branchId)
  if (!recommendation) return agent
  const locked = new Set(agent.lockedFields)
  const preferredEngine = recommendation.wEngines[0]
  const engineName = preferredEngine
    ? (getEngineName(preferredEngine) ?? agent.wEngineDetails.name)
    : agent.wEngineDetails.name
  const next = { ...agent }
  if (!locked.has('skillLevels')) {
    next.skillLevels = { ...recommendation.skillTargets }
    next.skills = '当前最佳可用目标'
  }
  if (!locked.has('wEngineDetails') && !locked.has('wEngine')) {
    next.wEngineDetails = {
      id: preferredEngine ?? null,
      name: engineName,
      level: 60,
      refinement: 0,
    }
    next.wEngine = engineName ?? '待选择'
    next.refinement = 0
  }
  next.lockedFields = [
    ...next.lockedFields.filter((field) => !field.startsWith(`buildBranch:${profile.agentId}:`)),
    `buildBranch:${profile.agentId}:${branchId}`,
  ]
  return next
}

function getEngineName(engineId: string) {
  const knownNames: Record<string, string> = {
    'wengine-14156': '琳琅鎏心',
    'wengine-14154': '朔月裁霜',
    'wengine-14143': '云霓孤光',
    'wengine-14125': '玉壶青冰',
    'wengine-14119': '深海访客',
    'wengine-14110': '燃狱齿轮',
    'wengine-14104': '硫磺石',
    'wengine-13128': '轰鸣座驾',
    'wengine-13115': '好斗的阿炮',
    'wengine-13113': '含羞恶面',
    'wengine-13103': '聚宝箱',
    'wengine-13112': '比格气缸',
    'wengine-13101': '德玛拉电池Ⅱ型',
    'wengine-14155': '日冕遗蜕',
    'wengine-13108': '仿制星徽引擎',
    'wengine-13135': '裁纸刀',
    'wengine-13111': '旋钻机-赤轴',
    'wengine-13106': '家政员',
    'wengine-14102': '钢铁肉垫',
    'wengine-13142': '震元奇枢',
  }
  return knownNames[engineId] ?? null
}

export function getSelectedBuildBranchId(agent: RosterAgent) {
  const profile = getCurrentBuildProfile(agent.agentId)
  if (!profile) return null
  const prefix = `buildBranch:${profile.agentId}:`
  return (
    agent.lockedFields.find((field) => field.startsWith(prefix))?.slice(prefix.length) ??
    profile.defaultBranchId
  )
}

export function getBuildRecommendation(
  profile: (typeof currentBuildProfiles)[number],
  branchId: string,
) {
  if (!profile.recommendation) return null
  const branch = profile.playstyleBranches.find((item) => item.id === branchId)
  if (!branch?.primarySetOverride) return profile.recommendation
  return {
    ...profile.recommendation,
    sets: profile.recommendation.sets.map((plan, index) =>
      index === 0 ? { ...plan, primary: [branch.primarySetOverride!] } : plan,
    ),
  }
}

export function toAgentDiscProfile(
  profile: (typeof currentBuildProfiles)[number],
  branchId = profile.defaultBranchId,
): AgentDiscProfile | null {
  if (profile.status !== 'formal') return null
  const recommendation = getBuildRecommendation(profile, branchId)
  if (!recommendation) return null
  const mainStatFit = Object.fromEntries(
    Object.entries(recommendation.mainStats).map(([slot, stats]) => [
      slot,
      Object.fromEntries(stats.map((stat, index) => [stat, Math.max(0.7, 1 - index * 0.12)])),
    ]),
  )
  const setFit: Record<string, number> = {}
  for (const plan of recommendation.sets) {
    for (const setId of plan.primary) setFit[setId] = Math.max(setFit[setId] ?? 0, 1)
    for (const setId of plan.secondary) setFit[setId] = Math.max(setFit[setId] ?? 0, 0.78)
  }
  return {
    agentId: profile.agentId,
    version: profile.profileVersion,
    statWeights: recommendation.substatWeights,
    mainStatFit,
    setFit,
    confidence: profile.confidence,
    gameVersion: profile.gameVersion,
    scenario:
      profile.playstyleBranches.find((branch) => branch.id === branchId)?.scenario ??
      profile.scenario,
    setPlans: recommendation.sets.map((plan) => ({
      pattern: plan.pattern,
      primarySets: [...plan.primary],
      secondarySets: [...plan.secondary],
    })),
    mainStats: Object.fromEntries(
      Object.entries(recommendation.mainStats).map(([slot, stats]) => [slot, [...stats]]),
    ),
  }
}

export function getCalculableBuildProfiles(roster: AccountRoster, gameVersion = '3.0') {
  return currentBuildProfiles.flatMap((profile) => {
    const agent = roster.agents.find((item) => item.agentId === profile.agentId)
    if (!agent?.owned) return []
    // This is a warehouse-adaptation profile, not an exact damage source. Formal damage
    // calculations have a separate versioned gate and never promote this material to a
    // "highest damage" result.
    if (!resolveBuildProfileAvailability(profile, gameVersion).calculable) return []
    const calculable = toAgentDiscProfile(profile, getSelectedBuildBranchId(agent) ?? undefined)
    return calculable ? [calculable] : []
  })
}

export const currentBuildCoverage = {
  total: currentBuildProfiles.length,
  formal: currentBuildProfiles.filter((profile) => profile.status === 'formal').length,
  compatible: currentBuildProfiles.filter(
    (profile) => profile.status === 'compatible_with_evidence',
  ).length,
  stale: currentBuildProfiles.filter((profile) => profile.status === 'stale').length,
  missing: currentBuildProfiles.filter((profile) => profile.status === 'missing').length,
  high: currentBuildProfiles.filter((profile) => profile.confidence === 'high').length,
  medium: currentBuildProfiles.filter((profile) => profile.confidence === 'medium').length,
  low: currentBuildProfiles.filter((profile) => profile.confidence === 'low').length,
}
