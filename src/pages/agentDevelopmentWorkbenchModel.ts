import {
  agentCatalog,
  bangbooCatalog,
  formatDevelopmentEntityText,
  getAgentSpecialtyLabel,
} from '../application/publicRosterNames'
import wEngineCatalog from '../assault/data/wEngineCatalog.3.0.json'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { getCurrentDriveDiscRecommendation } from '../gameDataPacks/currentDriveDiscRecommendationCatalog'
import { getRemielleEquipmentField } from '../gameDataPacks/gameData31RemielleEquipmentIntake'
import { l3TeamRecommendationSeeds } from '../gameDataPacks/l3TeamRecommendationSeedProjection'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { presentDiscFactFromChoice } from './discFactPresentation'
import { displayDiscMainValue, displayDriveDiscSet } from './publicDiscFacts'
import { createAgentDevelopmentPanelProjection } from './agentDevelopmentPanelProjection'
import { developmentPanelSummary } from './agentDevelopmentPublicDisplay'
import type { DriveDisc } from '../domain/schemas'
import type { AccountDiscChoice } from '../optimizer/optimizeAccountBuilds'
import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'

import {
  skillLabels,
  skillPriorityFromDirections,
  skillPriorityWithLegacyFallback,
  skillPrimaryPriorityWithLegacyFallback,
  skillTargetsFromDirections,
} from './agentDevelopmentSkillPriority'

function displayStat(stat: string) {
  return getCandidateStatLabels([stat], '副词条')[0] ?? '资料待补齐'
}

function displaySet(setId: string) {
  return displayDriveDiscSet(setId)
}

function wEngineVisual(name: string) {
  const current = currentAssetProjection.wEngines.find((item) => item.playerName === name)
  if (current) return { entityId: current.stableId, name: current.playerName }
  const catalog = wEngineCatalog.items.find((item) => item.name === name)
  return catalog ? { entityId: catalog.id, name: catalog.name } : undefined
}

function remielleSignatureBonus() {
  const stats = getRemielleEquipmentField('wengine-14158.stats.lv60')?.value
  const passive = getRemielleEquipmentField('wengine-14158.passive.refinement_p1')?.value
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return '加成资料待补齐'
  const statValues = stats as {
    baseAtk?: unknown
    secondary?: { stat?: unknown; value?: unknown }
  }
  const baseAttack =
    typeof statValues.baseAtk === 'number' ? `基础攻击力 ${statValues.baseAtk}` : null
  const attackPercent =
    statValues.secondary?.stat === 'atk_percent' && typeof statValues.secondary.value === 'number'
      ? `攻击力 ${statValues.secondary.value}%`
      : null
  const passiveValues =
    passive && typeof passive === 'object' && !Array.isArray(passive)
      ? (passive as { anomalyProficiency?: unknown })
      : null
  const anomalyProficiency =
    typeof passiveValues?.anomalyProficiency === 'number'
      ? `异常精通 +${passiveValues.anomalyProficiency}`
      : null
  return [baseAttack, attackPercent, anomalyProficiency].filter(Boolean).join(' · ')
}

function remielleFourPieceEffect() {
  const effect = getRemielleEquipmentField('set-34100.effect.four_piece')?.value
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return '4件套效果资料待补齐。'
  const values = effect as {
    anomalyProficiency?: unknown
    lumifluxAnomalyDamagePercent?: unknown
    durationSeconds?: unknown
    offFieldRetention?: unknown
  }
  const proficiency =
    typeof values.anomalyProficiency === 'number' ? `异常精通 +${values.anomalyProficiency}` : null
  const damage =
    typeof values.lumifluxAnomalyDamagePercent === 'number'
      ? `辉光属性异常伤害 +${values.lumifluxAnomalyDamagePercent}%`
      : null
  const duration =
    typeof values.durationSeconds === 'number' ? `持续${values.durationSeconds}秒` : null
  const retention = values.offFieldRetention === 'always' ? '后台保留' : null
  return [proficiency, damage, duration, retention].filter(Boolean).join('；')
}

function engineRecommendation(engineDirection: string) {
  const current = currentAssetProjection.wEngines.find(
    (item) => item.stableId === engineDirection || item.playerName === engineDirection,
  )
  const catalog = wEngineCatalog.items.find(
    (item) => item.id === engineDirection || item.name === engineDirection,
  )
  const name = current?.playerName ?? catalog?.name ?? formatDevelopmentEntityText(engineDirection)
  const rarity = current?.rarity ?? catalog?.rarity ?? null
  const specialty = current?.specialty ?? catalog?.specialty ?? null
  return {
    name,
    rarity,
    bonus: specialty ? `适配特性：${getAgentSpecialtyLabel(specialty)}` : '具体加成资料待补齐',
    visual: current
      ? { entityId: current.stableId, name: current.playerName }
      : catalog
        ? { entityId: catalog.id, name: catalog.name }
        : undefined,
  }
}

export type WorkbenchEngineRecommendation = {
  tier: '首选' | '替代' | '下位' | '候选方向'
  name: string
  bonus: string
  visual?: { entityId: string; name: string }
  isCurrent?: boolean
}

function resolveWorkbenchRecommendedEngines({
  agentId,
  resolution,
  directions = [],
}: {
  agentId: string
  resolution: {
    current?: { name: string; engineId: string } | null
    recommendedPrimary?: { name: string; engineId: string } | null
    recommendedAlternatives?: Array<{ name: string; engineId: string }>
  }
  directions?: readonly string[]
}): WorkbenchEngineRecommendation[] {
  const rawList = [
    ...(resolution.recommendedPrimary ? [resolution.recommendedPrimary] : []),
    ...(resolution.recommendedAlternatives ?? []),
  ].filter(
    (entry, index, entries) =>
      entries.findIndex((candidate) => candidate.engineId === entry.engineId) === index,
  )

  const currentId = resolution.current?.engineId
  const currentName = resolution.current?.name

  const mapped = rawList.slice(0, 3).map((entry, index) => {
    const engine = engineRecommendation(entry.engineId)
    const isCurrent = Boolean(
      (currentId && (engine.visual?.entityId === currentId || engine.name === currentName)) ||
      (currentName && engine.name === currentName),
    )
    return {
      // Position and rarity do not establish a lower tier. Only an explicit
      // source tier for this exact option may use that stronger comparison.
      tier:
        index === 0
          ? ('首选' as const)
          : directions.some((direction) => {
                const match = /^(?:下位|低配|过渡)\s*[：:]\s*(.+)$/.exec(direction.trim())
                return (
                  match?.[1]?.trim() === engine.name ||
                  match?.[1]?.trim() === engine.visual?.entityId
                )
              })
            ? ('下位' as const)
            : ('替代' as const),
      name: engine.name,
      bonus: agentId === 'agent-remielle' && index === 0 ? remielleSignatureBonus() : engine.bonus,
      visual: engine.visual ?? wEngineVisual(engine.name),
      isCurrent,
    }
  })

  return mapped.length
    ? mapped
    : [
        {
          tier: '候选方向' as const,
          name: '音擎方向资料待补齐',
          bonus: '没有可映射的音擎候选，不使用其他代理人的示例。',
        },
      ]
}

function knownTeamEntities() {
  const agents = [
    ...agentCatalog.map(([stableId, playerName]) => ({ stableId, playerName })),
    ...currentAssetProjection.agents
      .filter((item) => item.releaseState === 'released' && item.accountOwnable)
      .map(({ stableId, playerName }) => ({ stableId, playerName })),
  ]
  const bangboos = [
    ...bangbooCatalog.map(([stableId, playerName]) => ({ stableId, playerName })),
    ...currentAssetProjection.bangboos
      .filter((item) => item.releaseState === 'released' && item.accountOwnable)
      .map(({ stableId, playerName }) => ({ stableId, playerName })),
  ]
  return {
    agentsByName: new Map(agents.map((item) => [item.playerName, item])),
    agentsById: new Map(agents.map((item) => [item.stableId, item])),
    bangboosByName: new Map(bangboos.map((item) => [item.playerName, item])),
    bangboosById: new Map(bangboos.map((item) => [item.stableId, item])),
  }
}

function directionMentionsTeamEntity(direction: string, name: string) {
  if (Array.from(name).length !== 1) return direction.includes(name)
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `(?:^|[^\\p{Script=Han}\\p{L}\\p{N}])${escapedName}(?=$|[^\\p{Script=Han}\\p{L}\\p{N}])`,
    'u',
  ).test(direction)
}

type AuthorityTeamRecommendation = Pick<
  ReturnType<typeof authorityConsumerRecommendations>[number],
  'candidateId' | 'memberIds' | 'bangbooId'
> & {
  teamRating?: { ratingBand?: string; confidence?: string }
  mainstreamRecognition?: { historicalReferenceOnly?: boolean; conditions?: readonly string[] }
}

function teamDirectionsFromAuthority(
  agentId: string,
  recommendations: readonly AuthorityTeamRecommendation[],
) {
  const { agentsById, bangboosById } = knownTeamEntities()
  const seenExactTeams = new Set<string>()
  return recommendations
    .filter((recommendation) => recommendation.memberIds.includes(agentId))
    .filter((recommendation) => {
      const exactKey = `${[...recommendation.memberIds].toSorted().join('|')}:${recommendation.bangbooId ?? ''}`
      if (seenExactTeams.has(exactKey)) return false
      seenExactTeams.add(exactKey)
      return true
    })
    .filter(
      (recommendation) =>
        recommendation.memberIds.length === 3 &&
        recommendation.memberIds.every((memberId) => agentsById.has(memberId)) &&
        (!recommendation.bangbooId || bangboosById.has(recommendation.bangbooId)),
    )
    .slice(0, 3)
    .map((recommendation, index) => {
      const members = recommendation.memberIds.map((memberId) => agentsById.get(memberId)!)
      const bangboo = recommendation.bangbooId
        ? bangboosById.get(recommendation.bangbooId)!
        : undefined
      return {
        label: `当前账户配队 ${index + 1}`,
        note: [
          !recommendation.teamRating?.ratingBand ||
          recommendation.teamRating.ratingBand === 'Experimental' ||
          recommendation.teamRating.confidence === 'experimental'
            ? '强度尚未验证，不参与强弱比较。'
            : `队伍参考评级 ${recommendation.teamRating.ratingBand}。`,
          ...(recommendation.mainstreamRecognition?.historicalReferenceOnly
            ? ['既有攻略记录的搭配，当前适用性仍需核对。']
            : []),
        ].join(' '),
        conditions: [...new Set(recommendation.mainstreamRecognition?.conditions ?? [])],
        members: [
          ...members.map((member) => member.playerName),
          bangboo ? `邦布：${bangboo.playerName}` : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        visuals: [
          ...members.map((member) => ({
            entityType: 'agent' as const,
            entityId: member.stableId,
            name: member.playerName,
          })),
          ...(bangboo
            ? [
                {
                  entityType: 'bangboo' as const,
                  entityId: bangboo.stableId,
                  name: bangboo.playerName,
                },
              ]
            : []),
        ],
      }
    })
}

function teamDirectionsFromProfile(agentId: string, directions: readonly string[]) {
  const { agentsByName, agentsById, bangboosByName } = knownTeamEntities()
  const profileDirections = directions.slice(0, 3).map((direction, index) => ({
    label: `推荐配队 ${index + 1}`,
    members: direction,
    visuals: [
      ...[...agentsByName.values()]
        .filter(
          (item) =>
            item.stableId !== agentId && directionMentionsTeamEntity(direction, item.playerName),
        )
        .map((item) => ({
          entityType: 'agent' as const,
          entityId: item.stableId,
          name: item.playerName,
        })),
      ...[...bangboosByName.values()]
        .filter((item) => directionMentionsTeamEntity(direction, item.playerName))
        .map((item) => ({
          entityType: 'bangboo' as const,
          entityId: item.stableId,
          name: item.playerName,
        })),
    ].slice(0, 4),
  }))
  if (profileDirections.some((direction) => direction.visuals.length)) return profileDirections

  // Profile text can describe a role without naming a teammate. Only in that
  // zero-identity case, use the adopted current-limited seed whose members are
  // stable IDs, so the workbench never renders a named recommendation with an
  // empty avatar group.
  const sourcedDirections = l3TeamRecommendationSeeds
    .filter(
      (seed) =>
        seed.terminal === 'current_limited' &&
        seed.member_stable_ids.includes(agentId) &&
        seed.member_stable_ids.every((memberId) => agentsById.has(memberId)),
    )
    .slice(0, 3)
    .map((seed, index) => ({
      label: `产品配队参考 ${index + 1}`,
      members: seed.members_original.join(' · '),
      visuals: seed.member_stable_ids
        .filter((memberId) => memberId !== agentId)
        .map((memberId) => agentsById.get(memberId)!)
        .map((member) => ({
          entityType: 'agent' as const,
          entityId: member.stableId,
          name: member.playerName,
        })),
    }))
  return sourcedDirections.length ? sourcedDirections : profileDirections
}

function graduationTeamDirections(
  agentId: string,
  authorityRecommendations: readonly AuthorityTeamRecommendation[],
  profileDirections: readonly string[],
): GoldenWorkbenchData['graduation']['teams'] {
  const accountTeams = teamDirectionsFromAuthority(agentId, authorityRecommendations)
  return accountTeams.length ? accountTeams : teamDirectionsFromProfile(agentId, profileDirections)
}

function discSetRecommendation(setId: string) {
  const set = getCurrentDriveDiscRecommendation(setId)
  const currentVisualSet = currentAssetProjection.driveDiscSets.find(
    (item) => item.stableId === setId && item.releaseState === 'released',
  )
  return {
    entityId: set?.id ?? currentVisualSet?.stableId ?? '',
    name: set?.name ?? displayDriveDiscSet(setId),
    twoPieceEffect: set?.twoPieceEffect ?? '2件套效果资料待补齐。',
    fourPieceEffect: set?.fourPieceEffect ?? '4件套效果资料待补齐。',
  }
}

function discFactFromChoice(
  agentId: string,
  choice: AccountDiscChoice | null,
  disc: DriveDisc,
  _source: GoldenWorkbenchData['discSource'] | '已保存方案',
) {
  // Source provenance belongs to the section heading, not the numerical stat slot.
  void _source
  const set = displayDriveDiscSet(disc.setId)
  return presentDiscFactFromChoice({
    agentId,
    choice,
    disc,
    set,
    mainValue: displayDiscMainValue(disc),
  })
}

function currentPanelSummary(projection: ReturnType<typeof createAgentDevelopmentPanelProjection>) {
  return developmentPanelSummary(projection)
}

export {
  currentPanelSummary,
  discFactFromChoice,
  discSetRecommendation,
  displaySet,
  displayStat,
  engineRecommendation,
  graduationTeamDirections,
  remielleFourPieceEffect,
  remielleSignatureBonus,
  resolveWorkbenchRecommendedEngines,
  skillLabels,
  skillPriorityFromDirections,
  skillPriorityWithLegacyFallback,
  skillPrimaryPriorityWithLegacyFallback,
  skillTargetsFromDirections,
  teamDirectionsFromAuthority,
  teamDirectionsFromProfile,
  wEngineVisual,
}
