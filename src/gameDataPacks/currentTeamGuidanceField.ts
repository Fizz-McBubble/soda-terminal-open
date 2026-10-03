import { currentScopeManifest } from './currentScopeManifest'
import type { AgentProfileField } from './agentProfile'
import { currentTeamArchetypeProjection } from './currentTeamArchetypeProjection'
import { currentVersionProjection } from './currentVersionProjection'
import { stableContentHash } from './types'
import { currentReviewedTeamSourceDirections } from './reviewedTeamSourceDirections'

/** Reuse the adopted team source, not account-dependent rankings or a page-local fallback. */
export function currentTeamGuidanceField(agentId: string): AgentProfileField | undefined {
  const released = currentScopeManifest.entries.filter(
    (entry) => entry.releaseState === 'released' && entry.accountOwnable,
  )
  const releasedAgents = new Set(
    released.filter((entry) => entry.domain === 'agent').map((entry) => entry.stableId),
  )
  const bangboos = new Map(
    released
      .filter((entry) => entry.domain === 'bangboo')
      .map((entry) => [entry.stableId, entry.displayName]),
  )
  const agentNames = new Map(
    released
      .filter((entry) => entry.domain === 'agent')
      .map((entry) => [entry.stableId, entry.displayName]),
  )
  const teams = currentTeamArchetypeProjection.archetypes.filter(
    (team) =>
      team.gameVersion === currentVersionProjection.gameVersion &&
      team.releaseState === 'released' &&
      team.members.some((member) => member.agentId === agentId) &&
      team.members.every((member) => releasedAgents.has(member.agentId)) &&
      bangboos.has(team.bangbooId) &&
      team.sources.some((source) => source.layer === 'guide' && source.status === 'candidate'),
  )
  const existingKeys = new Set(
    teams.map((team) =>
      team.members
        .map((member) => member.agentId)
        .sort()
        .join('|'),
    ),
  )
  const allDirections = currentReviewedTeamSourceDirections().filter(
    (direction) =>
      direction.memberIds.includes(agentId) &&
      !existingKeys.has([...direction.memberIds].sort().join('|')),
  )
  const isHistoricalReference = (direction: (typeof allDirections)[number]) =>
    direction.sourceRefs.length > 0 &&
    direction.sourceRefs.every(
      (ref) => ref.verificationStatus === 'historical_membership_reference',
    )
  const currentDirections = allDirections.filter((direction) => !isHistoricalReference(direction))
  // Preserve current profile guidance. Historical fallback is used only when
  // current guidance is absent; BOX retains the complete source catalogue.
  const directions = teams.length || currentDirections.length ? currentDirections : allDirections
  if (!teams.length && !directions.length) return undefined
  const sources = new Map(
    teams.flatMap((team) => team.sources.map((source) => [source.id, source] as const)),
  )
  const conditions = [
    ...new Set([
      ...teams.flatMap((team) => team.prerequisites),
      ...directions.flatMap((direction) => direction.conditions),
    ]),
  ]
  const sourceVersions = new Set([
    ...[...sources.values()].map((source) => source.version),
    ...directions.flatMap((direction) =>
      direction.sourceRefs.map((source) => source.sourceVersion),
    ),
  ])
  return {
    group: 'build_guidance',
    path: 'build.team_bangboo_scenario',
    value: [
      ...teams.map((team) => {
        const members = team.members.map((member) => agentNames.get(member.agentId)).join('、')
        const bangboo = bangboos.get(team.bangbooId)!
        return `${members}；邦布：${bangboo}。${team.prerequisites.join('；')}。适用：${team.scenarios.join('、')}。`
      }),
      ...directions.map((direction) => {
        const prefix = isHistoricalReference(direction) ? '历史攻略参考：' : ''
        const choices = (direction.sourceBangbooOptionIds ?? [])
          .map((id) => bangboos.get(id))
          .filter(Boolean)
        const bangbooText = choices.length
          ? `攻略可选邦布：${choices.join('、')}，额外能力需另行核对。`
          : '邦布需按队伍条件选择。'
        return `${prefix}${direction.memberIds.map((id) => agentNames.get(id)).join('、')}；${bangbooText}${direction.conditions.join('；')}`
      }),
    ],
    status: 'candidate',
    gameVersion: currentVersionProjection.gameVersion,
    originalSourceVersion: sourceVersions.size === 1 ? [...sourceVersions][0]! : null,
    lastChangeVersion: teams.length
      ? currentTeamArchetypeProjection.gameVersion
      : currentVersionProjection.gameVersion,
    currentApplicability: directions.some(isHistoricalReference) ? 'unknown' : 'continuous',
    sourceRefs: [
      ...[...sources.values()].map((source) => ({
        id: source.id,
        url: source.url,
        sourceVersion: source.version,
        checkedAt: source.updatedAt,
        contentHash: stableContentHash({
          source,
          teams: teams.filter((team) => team.sources.some((ref) => ref.id === source.id)),
        }),
        licenseBoundary: '已采用队伍来源的最小事实投影，不复制原文或媒体，不提升为精确强度。',
      })),
      ...directions.flatMap((direction) =>
        direction.sourceRefs.map((source) => ({
          ...source,
          licenseBoundary: '已审阅配队的最小成员事实；不复制整篇攻略，不提供强度或邦布默认。',
        })),
      ),
    ],
    verifiedAt:
      [
        ...[...sources.values()].map((source) => source.updatedAt),
        ...directions.flatMap((direction) => direction.sourceRefs.map((ref) => ref.checkedAt)),
      ]
        .sort()
        .at(-1) ?? null,
    conflict: null,
    conditions,
    reason:
      '与队伍分析共用已审阅的三人搭配来源；已有邦布与场景条件保留，不把缺少这些条件当作没有队伍指导。',
  }
}
