import { z } from 'zod'
import { agentCatalog, getAgentName } from '../assault/catalog'
import {
  currentBuildProfiles,
  getBuildRecommendation,
  type CurrentBuildProfileStatus,
} from '../assault/currentBuildProfiles'
import { stableContentHash } from './types'

export const buildKnowledgeStatuses = ['formal', 'candidate', 'missing'] as const

const constraintStatuses = ['formal', 'candidate', 'missing'] as const

const profileConstraintSchema = z.object({
  status: z.enum(constraintStatuses),
  note: z.string().min(1),
  values: z.array(z.string()),
})

const profileConstraintMatrixSchema = z.object({
  wEngineTrait: profileConstraintSchema,
  bangboo: profileConstraintSchema,
  driveDisc: profileConstraintSchema,
  progression: profileConstraintSchema,
  teamScenario: profileConstraintSchema,
  potentialOverlay: profileConstraintSchema,
})

const profileSourceEvidenceSchema = z.object({
  url: z.string().url(),
  sourceVersion: z.string().min(1),
  checkedAt: z.string().datetime(),
  contentHash: z.string().min(1),
  status: z.enum(['formal', 'candidate', 'missing']),
  licenseBoundary: z.string().min(1),
})

export const buildKnowledgeProfileSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  role: z.string().min(1),
  gameVersion: z.literal('3.0'),
  packageVersion: z.string().min(1),
  status: z.enum(buildKnowledgeStatuses),
  updatedAt: z.string().datetime(),
  scenario: z.string().min(1),
  assumptions: z.array(z.string()),
  gaps: z.array(z.string()),
  sources: z.array(
    z.object({
      label: z.string().min(1),
      url: z.string().url(),
      updatedAt: z.string().datetime(),
      kind: z.enum(['official_fact', 'community_candidate']),
    }),
  ),
  sourceEvidence: z.array(profileSourceEvidenceSchema).min(1),
  constraints: profileConstraintMatrixSchema,
  recommendation: z
    .object({
      wEngines: z.array(z.string()).min(1),
      sets: z.array(z.string()).min(1),
      mainStats: z.record(z.string(), z.array(z.string()).min(1)),
      subStats: z.array(z.string()).min(1),
      skillPriority: z.array(z.string()).min(1),
      coreTarget: z.number().int().min(1).max(7),
      teammates: z.array(z.string()),
      bangboos: z.array(z.string()),
    })
    .nullable(),
  contentHash: z.string().min(1),
})

export type BuildKnowledgeProfile = z.infer<typeof buildKnowledgeProfileSchema>

const updatedAt = '2026-07-19T00:00:00.000Z'
const officialCharacterSource = {
  label: '绝区零官方角色目录',
  url: 'https://zenless.hoyoverse.com/zh-cn/character?catchSpider=1&id=154605',
  updatedAt,
  kind: 'official_fact' as const,
}

const officialEvidence = {
  url: officialCharacterSource.url,
  sourceVersion: '3.0',
  checkedAt: updatedAt,
  contentHash: stableContentHash({ source: officialCharacterSource.url, version: '3.0' }),
  status: 'formal' as const,
  licenseBoundary: '仅用于可核验的游戏目录事实。',
}

function constraint(
  status: (typeof constraintStatuses)[number],
  note: string,
  values: string[] = [],
) {
  return { status, note, values }
}

function statusForCurrentProfile(
  status: CurrentBuildProfileStatus,
): (typeof buildKnowledgeStatuses)[number] {
  return status === 'formal'
    ? 'formal'
    : status === 'compatible_with_evidence'
      ? 'candidate'
      : 'missing'
}

function makeProfile(agent: (typeof agentCatalog)[number]): BuildKnowledgeProfile {
  const [agentId, agentName, role] = agent
  const existing = currentBuildProfiles.find((profile) => profile.agentId === agentId)
  const status = existing ? statusForCurrentProfile(existing.status) : 'missing'
  const recommendation = existing?.recommendation
    ? getBuildRecommendation(existing, existing.defaultBranchId)
    : null
  const evidence = [
    officialEvidence,
    ...(existing?.sources
      .filter((source) => source.tier !== 'official')
      .map((source) => ({
        url: source.url,
        sourceVersion: source.applicableVersion,
        checkedAt: source.updatedAt,
        contentHash: stableContentHash({ url: source.url, updatedAt: source.updatedAt }),
        status: 'candidate' as const,
        licenseBoundary:
          source.license === 'CC BY-NC-SA 4.0'
            ? 'CC BY-NC-SA 4.0：仅本地非商业候选、署名与同许可边界；不得作为官方事实。'
            : '社区来源只作为候选假设，不得升格为官方游戏事实。',
      })) ?? []),
  ]
  const recommendationStatus = recommendation ? status : 'missing'
  const constraints = {
    wEngineTrait: constraint(
      'formal',
      '音擎候选必须匹配代理人特性；目录事实来自3.0正式游戏目录。',
      [role],
    ),
    bangboo: recommendation
      ? constraint(
          recommendationStatus,
          '候选邦布方向受场景与队伍前提限制。',
          recommendation.teamConstraints.bangbooIds,
        )
      : constraint('missing', '缺少该角色的可追溯邦布方向资料。'),
    driveDisc: recommendation
      ? constraint(recommendationStatus, '套装、4/5/6号位主词条与关键副词条只在所列场景下适用。', [
          ...recommendation.sets.flatMap((set) => [...set.primary, ...set.secondary]),
          ...Object.values(recommendation.mainStats).flat(),
          ...Object.keys(recommendation.substatWeights),
        ])
      : constraint('missing', '缺少可追溯的套装、主词条与副词条约束。'),
    progression: recommendation
      ? constraint(
          recommendationStatus,
          '技能、核心技、影画和潜能前提需要按独立规则与实际账户状态确认。',
          [...recommendation.skillPriority, `核心技 ${recommendation.coreTarget}`],
        )
      : constraint('missing', '缺少技能、核心技、影画与潜能前提资料。'),
    teamScenario: recommendation
      ? constraint(
          recommendationStatus,
          existing?.scenario ?? '当前场景待补',
          recommendation.teamConstraints.teammateNotes,
        )
      : constraint('missing', '缺少可追溯的队伍关系或场景假设。'),
    potentialOverlay: constraint(
      'missing',
      '潜能是独立 overlay；当前未录入该角色的可核验潜能变更字段，不影响普通技能或影画事实。',
    ),
  }
  const input = {
    id: `build-knowledge-3.0-${agentId}`,
    agentId,
    agentName,
    role,
    gameVersion: '3.0' as const,
    packageVersion: '3.0.1',
    status,
    updatedAt,
    scenario: existing?.scenario ?? '当前版本资料待补',
    assumptions: existing?.recommendation
      ? ['建议会受队伍、音擎精炼和驱动盘副词条影响；不等同于精确伤害或唯一最优。']
      : ['尚无可用于正式计算的完整构筑资料。'],
    gaps:
      status === 'formal'
        ? []
        : existing?.blocker
          ? [existing.blocker]
          : [`${agentName} 缺少当前版本、来源和适用前提完整的构筑资料。`],
    sources: [
      officialCharacterSource,
      ...(existing?.sources
        .filter((source) => source.tier !== 'official')
        .map((source) => ({
          label: source.title,
          url: source.url,
          updatedAt: source.updatedAt,
          kind: 'community_candidate' as const,
        })) ?? []),
    ],
    sourceEvidence: evidence,
    constraints,
    recommendation: recommendation
      ? {
          wEngines: recommendation.wEngines,
          sets: recommendation.sets.flatMap((set) => [...set.primary, ...set.secondary]),
          mainStats: recommendation.mainStats,
          subStats: Object.keys(recommendation.substatWeights),
          skillPriority: recommendation.skillPriority,
          coreTarget: recommendation.coreTarget,
          teammates: recommendation.teamConstraints.teammateNotes,
          bangboos: recommendation.teamConstraints.bangbooIds,
        }
      : null,
  }
  return buildKnowledgeProfileSchema.parse({
    ...input,
    contentHash: stableContentHash(input),
  })
}

export const buildKnowledge30Profiles = agentCatalog
  .filter((agent) => agent[7] === 'released')
  .map(makeProfile)

export const buildKnowledge30Coverage = {
  total: buildKnowledge30Profiles.length,
  formal: buildKnowledge30Profiles.filter((profile) => profile.status === 'formal').length,
  candidate: buildKnowledge30Profiles.filter((profile) => profile.status === 'candidate').length,
  missing: buildKnowledge30Profiles.filter((profile) => profile.status === 'missing').length,
}

export const buildKnowledge30ConstraintCoverage = buildKnowledge30Profiles.map((profile) => {
  const constraints = Object.entries(profile.constraints)
  return {
    agentId: profile.agentId,
    status: profile.status,
    sourceStatus: profile.sourceEvidence.some((source) => source.status === 'formal')
      ? 'formal'
      : 'missing',
    completeConstraintGroups: constraints
      .filter(([, value]) => value.status !== 'missing')
      .map(([key]) => key),
    missingConstraintGroups: constraints
      .filter(([, value]) => value.status === 'missing')
      .map(([key]) => key),
    adviceEligible:
      profile.status === 'formal' && constraints.every(([, value]) => value.status === 'formal'),
    soloOptimizerEligible:
      profile.status === 'formal' && constraints.every(([, value]) => value.status === 'formal'),
    teamOptimizerEligible:
      profile.status === 'formal' && constraints.every(([, value]) => value.status === 'formal'),
    candidateDamageEligible: false,
  }
})

/** Only formal profile facts may shape the formal optimizer input. */
export function getFormalBuildKnowledgeProfile(agentId: string, gameVersion = '3.0') {
  return buildKnowledge30Profiles.find(
    (profile) =>
      profile.agentId === agentId &&
      profile.gameVersion === gameVersion &&
      profile.status === 'formal',
  )
}

export function getBuildKnowledgeProfile(agentId: string) {
  return (
    buildKnowledge30Profiles.find((profile) => profile.agentId === agentId) ?? {
      id: `build-knowledge-3.0-${agentId}`,
      agentId,
      agentName: getAgentName(agentId),
      role: '资料待补',
      gameVersion: '3.0' as const,
      packageVersion: '3.0.1',
      status: 'missing' as const,
      updatedAt,
      scenario: '当前版本资料待补',
      assumptions: ['尚无可用于正式计算的完整构筑资料。'],
      gaps: ['角色不在当前3.0已核验目录。'],
      sources: [officialCharacterSource],
      sourceEvidence: [officialEvidence],
      constraints: {
        wEngineTrait: constraint('missing', '角色不在当前3.0已核验目录。'),
        bangboo: constraint('missing', '角色不在当前3.0已核验目录。'),
        driveDisc: constraint('missing', '角色不在当前3.0已核验目录。'),
        progression: constraint('missing', '角色不在当前3.0已核验目录。'),
        teamScenario: constraint('missing', '角色不在当前3.0已核验目录。'),
        potentialOverlay: constraint('missing', '角色不在当前3.0已核验目录。'),
      },
      recommendation: null,
      contentHash: 'missing',
    }
  )
}
