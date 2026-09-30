import { buildKnowledge30Profiles } from './buildKnowledge'
import { currentVersionProjection } from './currentVersionProjection'
import { stableContentHash } from './types'
import type {
  AgentProfile,
  AgentProfileField,
  ProjectedBuildKnowledgeProfile,
} from './agentProfileFieldProjection'
const playerReadablePaths = [
  'build.wengines',
  'build.drive_disc_sets',
  'build.main_sub_stats',
  'build.progression',
  'build.team_bangboo_scenario',
] as const

export function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (!value || typeof value !== 'object') return typeof value === 'string' ? [value] : []
  return Object.values(value).flatMap(strings)
}

export function buildField(profile: AgentProfile, path: string) {
  return profile.fields.find((field) => field.path === path)
}

function buildMainStats(value: unknown) {
  const lines = strings(value)
  return Object.fromEntries(
    (['4', '5', '6'] as const).map((slot) => [
      slot,
      lines.filter((line) => line.includes(`${slot}号位`)),
    ]),
  )
}

export function projectBuildKnowledgeProfile(
  agentId: string,
  unified: AgentProfile,
): ProjectedBuildKnowledgeProfile {
  const legacy = buildKnowledge30Profiles.find((item) => item.agentId === agentId)
  const required = playerReadablePaths.map((path) => buildField(unified, path))
  const readable = required.every((field) => field && field.status !== 'missing')
  const missing = required.filter((field) => !field || field.status === 'missing')
  const wEngines = strings(buildField(unified, 'build.wengines')?.value)
  const sets = strings(buildField(unified, 'build.drive_disc_sets')?.value)
  const mainSub = buildField(unified, 'build.main_sub_stats')?.value
  const progression = strings(buildField(unified, 'build.progression')?.value)
  const team = strings(buildField(unified, 'build.team_bangboo_scenario')?.value)
  const sourceFields = required.filter((field): field is AgentProfileField => Boolean(field))
  const constraintStatus: 'candidate' | 'missing' = readable ? 'candidate' : 'missing'
  const potentialStatus: 'formal' | 'missing' =
    buildField(unified, 'progression.potential_overlay')?.status === 'formal' ? 'formal' : 'missing'
  const input = {
    id: `agent-profile-projection-${currentVersionProjection.gameVersion}-${agentId}`,
    agentId,
    agentName: unified.agentName,
    role: legacy?.role ?? '资料待补',
    gameVersion: currentVersionProjection.gameVersion,
    packageVersion: `${currentVersionProjection.packageVersion}-agent-projected`,
    status: readable ? ('candidate' as const) : ('missing' as const),
    updatedAt:
      sourceFields
        .map((field) => field.verifiedAt)
        .filter((item): item is string => Boolean(item))
        .sort()
        .at(-1) ?? '2026-07-27T00:00:00.000Z',
    scenario: team.join('；') || legacy?.scenario || '当前版本资料待补',
    assumptions: [
      '候选方向按字段来源投影；缺少的计算字段只限制精确伤害，不清空已验证的养成与仓库方向。',
      `早期来源若没有对应补丁变更证据则连续有效；建议与仓库候选按当前 ${currentVersionProjection.gameVersion} 目录重新比较。`,
    ],
    gaps: missing.map((field) => field?.reason ?? '当前角色缺少可追溯构筑方向。'),
    sources: sourceFields.flatMap((field) =>
      field.sourceRefs.map((source) => ({
        label: source.id,
        url: source.url,
        updatedAt: source.checkedAt ?? '2026-07-27T00:00:00.000Z',
        kind: source.id.startsWith('official')
          ? ('official_fact' as const)
          : ('community_candidate' as const),
      })),
    ),
    sourceEvidence: sourceFields.flatMap((field) =>
      field.sourceRefs.map((source) => ({
        url: source.url,
        sourceVersion: source.sourceVersion ?? 'unknown',
        checkedAt: source.checkedAt ?? '2026-07-27T00:00:00.000Z',
        contentHash: source.contentHash ?? stableContentHash(source),
        status: field.status === 'formal' ? ('formal' as const) : ('candidate' as const),
        licenseBoundary: source.licenseBoundary,
      })),
    ),
    constraints: {
      wEngineTrait: { status: constraintStatus, note: '来源化音擎方向。', values: wEngines },
      bangboo: { status: constraintStatus, note: '来源化邦布与队伍方向。', values: team },
      driveDisc: {
        status: constraintStatus,
        note: '来源化套装与词条方向。',
        values: [...sets, ...strings(mainSub)],
      },
      progression: { status: constraintStatus, note: '来源化养成优先级。', values: progression },
      teamScenario: { status: constraintStatus, note: '来源化场景前提。', values: team },
      potentialOverlay: {
        status: potentialStatus,
        note: '潜能保持独立 overlay；缺失不覆盖影画或普通技能。',
        values: [],
      },
    },
    recommendation: readable
      ? {
          wEngines,
          sets,
          mainStats: buildMainStats(mainSub),
          subStats: strings(mainSub).filter((item) => !/[456]号位/.test(item)),
          skillPriority: progression,
          coreTarget: 1,
          teammates: team,
          bangboos: [],
        }
      : null,
  }
  return { ...input, contentHash: stableContentHash(input) }
}
