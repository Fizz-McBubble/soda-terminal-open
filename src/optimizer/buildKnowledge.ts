import { z } from 'zod'
import rawKnowledge from '../data/build-knowledge.v1.json'
import type { BuildProfile, StatKey } from '../domain/schemas'
import { statKeySchema } from '../domain/schemas'
import { contentHash } from '../evaluation/contentHash'

const sourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  tier: z.enum(['official', 'structured', 'community-chinese', 'community-international']),
  gameVersion: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
  status: z.enum(['current', 'historical']).default('historical'),
  claim: z.string().min(1),
})

const coverageStatusSchema = z.enum(['current', 'compatible_with_evidence', 'stale', 'missing'])

const knowledgeProfileSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  name: z.string().min(1),
  scenario: z.string().min(1),
  assumptions: z.object({
    team: z.string().min(1),
    wEngine: z.string().min(1),
    mindscape: z.string().min(1),
    combatMode: z.string().min(1),
    objective: z.string().min(1),
  }),
  gameVersion: z.string().min(1),
  coverageStatus: coverageStatusSchema,
  sourceUpdatedAt: z.string().datetime(),
  collectedAt: z.string().datetime(),
  confidence: z.enum(['low', 'medium', 'high']),
  claim: z.enum(['current_version_recommendation', 'old_version_reference']),
  mainStats: z.record(z.string(), z.array(statKeySchema).min(1)),
  minimumSubstatValues: z.partialRecord(statKeySchema, z.number().nonnegative()).default({}),
  setPlans: z.array(
    z.object({
      pattern: z.enum(['4+2', '2+2+2']),
      primarySets: z.array(z.string().min(1)).min(1),
      secondarySets: z.array(z.string().min(1)),
    }),
  ),
  sources: z.array(sourceSchema).min(1),
  conflicts: z.array(z.string().min(1)),
})

const manifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  dataVersion: z.string().min(1),
  gameVersion: z.string().min(1),
  updatedAt: z.string().datetime(),
  freshnessPolicy: z.object({
    maxSourceAgeDays: z.number().int().positive(),
    reviewGraceDays: z.number().int().nonnegative(),
  }),
  coverage: z.array(
    z.object({
      agentId: z.string().min(1),
      profileId: z.string().min(1),
      status: coverageStatusSchema,
      gameVersion: z.string().min(1),
      latestReviewedAt: z.string().datetime().nullable(),
      reason: z.string().min(1),
    }),
  ),
  profiles: z.array(knowledgeProfileSchema),
})

type ParsedProfile = z.infer<typeof knowledgeProfileSchema>
type ParsedSource = z.infer<typeof sourceSchema>
export type BuildKnowledgeProfile = Omit<ParsedProfile, 'sources'> & {
  contentHash: string
  sources: Array<ParsedSource & { contentHash: string }>
}

const parsed = manifestSchema.parse(rawKnowledge)

export const buildKnowledgeManifest = {
  ...parsed,
  contentHash: contentHash(parsed),
  profiles: parsed.profiles.map((profile) => ({
    ...profile,
    contentHash: contentHash(profile),
    sources: profile.sources.map((source) => ({ ...source, contentHash: contentHash(source) })),
  })) as BuildKnowledgeProfile[],
}

export function getBuildKnowledgeProfiles(profile: Pick<BuildProfile, 'id' | 'agentId'>) {
  return buildKnowledgeManifest.profiles.filter(
    (knowledge) => knowledge.profileId === profile.id && knowledge.agentId === profile.agentId,
  )
}

export function getBuildKnowledgeCoverage(profileId: string) {
  return buildKnowledgeManifest.coverage.find((coverage) => coverage.profileId === profileId)
}

function ageInDays(value: string, now: Date) {
  return Math.max(0, (now.getTime() - new Date(value).getTime()) / 86_400_000)
}

export function getKnowledgeFreshness(
  knowledge: BuildKnowledgeProfile,
  currentGameVersion: string,
  profile: Pick<BuildProfile, 'isDefault' | 'version'>,
  now = new Date(),
) {
  const coverage = getBuildKnowledgeCoverage(knowledge.profileId)
  const stale =
    knowledge.gameVersion !== currentGameVersion ||
    knowledge.coverageStatus === 'stale' ||
    knowledge.coverageStatus === 'missing'
  const customTemplate = !profile.isDefault
  const sourceWarnings = knowledge.sources
    .filter((source) => source.status === 'current')
    .flatMap((source) => {
      const warnings: string[] = []
      if (source.gameVersion && source.gameVersion !== currentGameVersion) {
        warnings.push(`${source.title} 版本为 ${source.gameVersion}`)
      }
      if (
        ageInDays(source.updatedAt, now) > buildKnowledgeManifest.freshnessPolicy.maxSourceAgeDays
      ) {
        warnings.push(`${source.title} 已超过复核时限`)
      }
      return warnings
    })
  const canClaimCommunityVersionRecommendation =
    !stale &&
    !customTemplate &&
    sourceWarnings.length === 0 &&
    knowledge.confidence === 'high' &&
    knowledge.claim === 'current_version_recommendation' &&
    (knowledge.coverageStatus === 'current' ||
      knowledge.coverageStatus === 'compatible_with_evidence')
  return {
    stale,
    customTemplate,
    sourceWarnings,
    coverage,
    conclusion: canClaimCommunityVersionRecommendation
      ? '当前版本推荐'
      : stale
        ? '旧版本参考'
        : sourceWarnings.length
          ? '来源待复核'
          : customTemplate
            ? '当前自定义模板最优'
            : '资料不足，仅模板数学最优',
    canClaimCommunityVersionRecommendation,
  }
}

export function checkBuildKnowledgeUpdates(currentGameVersion: string, now = new Date()) {
  return buildKnowledgeManifest.coverage.map((coverage) => {
    const profile = buildKnowledgeManifest.profiles.find(
      (knowledge) => knowledge.profileId === coverage.profileId,
    )
    if (!profile) return { ...coverage, effectiveStatus: 'missing' as const, warnings: [] }
    const freshness = getKnowledgeFreshness(
      profile,
      currentGameVersion,
      { isDefault: true, version: '' },
      now,
    )
    return {
      ...coverage,
      effectiveStatus: freshness.stale ? ('stale' as const) : coverage.status,
      warnings: freshness.sourceWarnings,
    }
  })
}

export function isAllowedMainStat(
  knowledge: Pick<BuildKnowledgeProfile, 'mainStats'>,
  slot: number,
  stat: StatKey,
) {
  return slot <= 3 || (knowledge.mainStats[String(slot)] as StatKey[] | undefined)?.includes(stat)
}
