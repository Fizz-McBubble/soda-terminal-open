import { r5WarehouseCandidateOverrides } from './r5WarehouseCandidateOverrides'
import { pageCandidateDirections } from './pageCandidateDirections'
import { agentCatalog } from '../assault/catalog'
import { applyReviewedDiscCorrections } from './reviewedDiscFieldCorrections'
import { buildKnowledge30Profiles } from './buildKnowledge'
import { stableContentHash } from './types'
import { reviewedGuideSkillDirections } from './reviewedGuideSkillDirections'
import { reviewedPotentialGuideReferences } from './reviewedPotentialGuideReferences'
import { reviewedGuideBuildDirections } from './reviewedGuideBuildDirections'
import { getArchivedGuideSetDirections } from './archivedGuideSetSections'
import { compileCandidateSetPlans } from './candidateSetPlans'
import {
  type PlayerBuildSource,
  type PlayerBuildField,
  type PlayerBuildProfile,
  checkedAt,
  officialCatalogSource,
  bwikiPageEvidence,
} from './playerBuildSources'
export {
  playerBuildFieldStatuses,
  type PlayerBuildFieldStatus,
  type PlayerBuildSource,
  type PlayerBuildField,
  type PlayerBuildProfile,
} from './playerBuildSources'

/**
 * Page-level directions are intentionally separate from the optimizer profile. They preserve the
 * source's own terminology for player reading and never become solver constraints without a
 * second normalization and same-version review.
 */

/**
 * R5 closes the remaining warehouse-constraint gaps with page-level, non-generic evidence.
 * These remain candidate directions: a community build page is never a formal game fact or a
 * direct-damage input. Keeping the override separate makes the source-specific upgrade auditable.
 */

function bwikiAgentSource(agentId: string, agentName: string): PlayerBuildSource {
  const url = `https://wiki.biligame.com/zzz/${encodeURIComponent(agentName)}`
  const page = bwikiPageEvidence[agentId]
  return {
    id: `bwiki-agent-${stableContentHash(agentName).slice(-12)}`,
    url,
    sourceVersion: null,
    checkedAt: page?.updatedAt ?? checkedAt,
    contentHash: stableContentHash({
      url,
      pageUpdatedAt: page?.updatedAt ?? null,
      purpose: 'page-level build intake locator',
    }),
    licenseBoundary: page
      ? 'CC BY-NC-SA 4.0：仅本地非商业候选、保留署名与同许可边界；不作为官方事实或正式计算输入。'
      : '尚未逐页核验的 BWIKI 定位入口；不能作为候选事实或正式计算输入。',
    verified: Boolean(page),
  }
}

function missing(path: string, source: PlayerBuildSource, reason: string): PlayerBuildField {
  return { path, status: 'missing', value: null, source, reason }
}

function formalCatalog(path: string, value: unknown): PlayerBuildField {
  return {
    path,
    status: 'formal',
    value,
    source: officialCatalogSource,
    reason: '3.0 正式目录已核验。',
  }
}

function candidateDirection(
  path: string,
  value: unknown,
  source: PlayerBuildSource,
): PlayerBuildField {
  return {
    path,
    status: 'candidate',
    value,
    source,
    reason: '页面级社区构筑候选；需同版本官方或游戏内核验后才能进入正式仓库求解。',
  }
}

function sourceFromBuildKnowledge(
  profile: (typeof buildKnowledge30Profiles)[number],
  fallback: PlayerBuildSource,
): PlayerBuildSource {
  const evidence =
    profile.sourceEvidence.find(
      (item) => item.status === 'candidate' && item.sourceVersion === '3.0',
    ) ?? profile.sourceEvidence.find((item) => item.status === 'candidate')
  return evidence
    ? {
        id: `build-knowledge-${stableContentHash(evidence.url).slice(-12)}`,
        url: evidence.url,
        sourceVersion: evidence.sourceVersion,
        checkedAt: evidence.checkedAt,
        contentHash: evidence.contentHash,
        licenseBoundary: evidence.licenseBoundary,
        verified: true,
      }
    : fallback
}

export const playerBuildProfiles30: PlayerBuildProfile[] = agentCatalog
  .filter((agent) => agent[7] === 'released')
  .map(([agentId, agentName, specialty, , rarity, attribute, faction]) => {
    const knowledge = buildKnowledge30Profiles.find((profile) => profile.agentId === agentId)!
    const candidateSource = bwikiAgentSource(agentId, agentName)
    const pageEvidence = bwikiPageEvidence[agentId]
    const recommendation = knowledge.recommendation
    const candidate = knowledge.status === 'candidate' && recommendation !== null
    const buildSource = sourceFromBuildKnowledge(knowledge, candidateSource)
    const pageCandidate = r5WarehouseCandidateOverrides[agentId] ?? pageCandidateDirections[agentId]
    const reviewedSkills = reviewedGuideSkillDirections[agentId]
    const reviewedBuild = reviewedGuideBuildDirections[agentId]
    const archivedSets =
      !reviewedBuild && pageCandidate && !compileCandidateSetPlans(pageCandidate.sets).length
        ? getArchivedGuideSetDirections(agentId)
        : null
    const fields: PlayerBuildField[] = [
      formalCatalog('identity', { rarity, specialty, attribute, faction }),
      pageEvidence?.lv60
        ? candidateDirection('progression.lv60_and_ascension', pageEvidence.lv60, candidateSource)
        : missing(
            'progression.lv60_and_ascension',
            candidateSource,
            '待逐页提取并交叉核验 LV60 面板与突破材料。',
          ),
      missing(
        'progression.skill_core_cinema',
        candidateSource,
        '待逐页提取技能、核心技和影画的版本化优先级。',
      ),
      reviewedPotentialGuideReferences[agentId]
        ? candidateDirection(
            'progression.potential_overlay',
            reviewedPotentialGuideReferences[agentId]!.value,
            reviewedPotentialGuideReferences[agentId]!.source,
          )
        : missing(
            'progression.potential_overlay',
            candidateSource,
            '潜能作为独立 overlay；未核验前不覆盖普通技能或影画。',
          ),
      reviewedBuild
        ? candidateDirection('build.wengines', reviewedBuild.wengines, reviewedBuild.source)
        : pageCandidate
          ? candidateDirection('build.wengines', pageCandidate.wengines, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection('build.wengines', recommendation.wEngines, buildSource)
            : missing('build.wengines', candidateSource, '缺少该角色可追溯的音擎优先级与替代。'),
      reviewedBuild
        ? candidateDirection('build.drive_disc_sets', reviewedBuild.sets, reviewedBuild.source)
        : archivedSets
          ? candidateDirection('build.drive_disc_sets', archivedSets.sets, archivedSets.source)
          : pageCandidate
            ? candidateDirection('build.drive_disc_sets', pageCandidate.sets, pageCandidate.source)
            : candidate && recommendation
              ? candidateDirection('build.drive_disc_sets', recommendation.sets, buildSource)
              : missing(
                  'build.drive_disc_sets',
                  candidateSource,
                  '缺少该角色可追溯的驱动盘套装组合。',
                ),
      reviewedBuild
        ? candidateDirection('build.main_sub_stats', reviewedBuild.stats, reviewedBuild.source)
        : pageCandidate
          ? candidateDirection('build.main_sub_stats', pageCandidate.stats, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection(
                'build.main_sub_stats',
                {
                  mainStats: recommendation.mainStats,
                  subStats: recommendation.subStats,
                },
                buildSource,
              )
            : missing(
                'build.main_sub_stats',
                candidateSource,
                '缺少该角色可追溯的主、副词条方向。',
              ),
      reviewedSkills
        ? candidateDirection('build.progression', reviewedSkills.directions, reviewedSkills.source)
        : pageCandidate
          ? candidateDirection('build.progression', pageCandidate.progression, pageCandidate.source)
          : candidate && recommendation
            ? candidateDirection(
                'build.progression',
                {
                  skillPriority: recommendation.skillPriority,
                  coreTarget: recommendation.coreTarget,
                },
                buildSource,
              )
            : missing(
                'build.progression',
                candidateSource,
                '缺少该角色可追溯的技能与核心技优先级。',
              ),
      pageCandidate
        ? candidateDirection(
            'build.team_bangboo_scenario',
            pageCandidate.team,
            pageCandidate.source,
          )
        : candidate && recommendation
          ? candidateDirection(
              'build.team_bangboo_scenario',
              {
                teammates: recommendation.teammates,
                bangboos: recommendation.bangboos,
                scenario: knowledge.scenario,
              },
              buildSource,
            )
          : missing(
              'build.team_bangboo_scenario',
              candidateSource,
              '缺少该角色可追溯的队伍、邦布与场景前提。',
            ),
      missing('build.target_panel', candidateSource, '缺少同版本、可量化毕业面板或不可量化理由。'),
      missing(
        'build.version_change_impact',
        candidateSource,
        '缺少当前版本变更对该角色构筑影响的逐字段核验。',
      ),
    ]
    const input = {
      agentId,
      agentName,
      gameVersion: '3.0' as const,
      profileVersion: '3.0.2',
      fields: fields.map((field) => applyReviewedDiscCorrections(agentId, field)),
    }
    return { ...input, contentHash: stableContentHash(input) }
  })

function hasCandidateDirection(profile: PlayerBuildProfile) {
  return [
    'build.wengines',
    'build.drive_disc_sets',
    'build.main_sub_stats',
    'build.progression',
    'build.team_bangboo_scenario',
  ].every((path) =>
    profile.fields.some((field) => field.path === path && field.status !== 'missing'),
  )
}

function hasCurrentVersionCandidateDirection(profile: PlayerBuildProfile) {
  return [
    'build.wengines',
    'build.drive_disc_sets',
    'build.main_sub_stats',
    'build.progression',
    'build.team_bangboo_scenario',
  ].every((path) => {
    const field = profile.fields.find((item) => item.path === path)
    return field?.status === 'candidate' && field.source?.sourceVersion === '3.0'
  })
}

export const playerBuildProfileCoverage = {
  total: playerBuildProfiles30.length,
  readable: playerBuildProfiles30.filter(hasCandidateDirection).length,
  currentVersionReadable: playerBuildProfiles30.filter(hasCurrentVersionCandidateDirection).length,
  candidateWarehouseConstraints: playerBuildProfiles30.filter(hasCandidateDirection).length,
  formalWarehouseSolvable: playerBuildProfiles30.filter((profile) =>
    profile.fields
      .filter((field) => field.path.startsWith('build.'))
      .every((field) => field.status === 'formal'),
  ).length,
  formalExactDamageSolvable: 0,
  verifiedCandidateFields: playerBuildProfiles30
    .flatMap((profile) => profile.fields)
    .filter((field) => field.status === 'candidate' && field.source?.verified).length,
  unfetchedSourceLocators: playerBuildProfiles30
    .flatMap((profile) => profile.fields)
    .filter((field) => field.status === 'missing' && field.source && !field.source.verified).length,
  missingByField: Object.fromEntries(
    [
      ...new Set(
        playerBuildProfiles30.flatMap((profile) => profile.fields.map((field) => field.path)),
      ),
    ].map((path) => [
      path,
      playerBuildProfiles30.filter(
        (profile) => profile.fields.find((field) => field.path === path)?.status === 'missing',
      ).length,
    ]),
  ),
}

export type PlayerBuildProfileDelta = {
  added: string[]
  changed: string[]
  deprecated: string[]
}
export function diffPlayerBuildProfiles(
  previous: PlayerBuildProfile[],
  next: PlayerBuildProfile[],
): PlayerBuildProfileDelta {
  const before = new Map(previous.map((profile) => [profile.agentId, profile.contentHash]))
  const after = new Map(next.map((profile) => [profile.agentId, profile.contentHash]))
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    changed: [...after.entries()]
      .filter(([id, hash]) => before.get(id) !== undefined && before.get(id) !== hash)
      .map(([id]) => id),
    deprecated: [...before.keys()].filter((id) => !after.has(id)),
  }
}
