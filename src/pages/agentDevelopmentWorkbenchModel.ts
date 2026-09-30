import {
  agentCatalog,
  bangbooCatalog,
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

const skillLabels = {
  basic: '普攻',
  dodge: '闪避',
  assist: '支援',
  special: '特殊',
  chain: '连携',
  core: '核心技',
} as const

const fallbackSkillPriority = ['special', 'core', 'chain', 'assist', 'dodge', 'basic'] as const

type SkillPriorityKey = (typeof fallbackSkillPriority)[number]

const skillPriorityAliases: Record<SkillPriorityKey, readonly string[]> = {
  basic: ['普通攻击', '普攻'],
  dodge: ['闪避'],
  assist: ['快速支援', '支援'],
  special: ['强化特殊技', '强化特殊', '特殊技', '特殊'],
  chain: ['终结技', '连携技', '连携'],
  core: ['核心被动', '核心技'],
}

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

function skillPriorityFromDirections(directions: readonly string[]) {
  const explicitPriorities = directions.flatMap((direction) => {
    const normalized = direction.toLowerCase()
    const trimmed = direction.trim()
    const exactKeys = fallbackSkillPriority.filter(
      (key) => normalized === key || trimmed === skillLabels[key],
    )
    if (exactKeys.length) return exactKeys

    // Mechanic/rotation prose can name many actions without recommending a
    // level-up order. A source that explicitly defers priority verification
    // must remain empty rather than being inferred from those action names.
    if (
      /(?:技能|核心).{0,12}(?:优先级|等级)?(?:需|需要|仍需|另行).{0,12}(?:独立)?核验/.test(
        direction,
      )
    )
      return []

    // Damage contribution and combat execution order are not upgrade advice.
    if (/(?:伤害窗口|输出占比|伤害占比)/.test(direction) && !/(?:升级|加点|投入)/.test(direction))
      return []
    const orderMarker =
      /(?:>|优先|其次|次之|先拉满|可先提高(?=[^。；]*等级)|按页面顺序投入|加点(?:顺序)?)/
    if (!orderMarker.test(direction)) return []

    // Restrict the scan to clauses that themselves declare an order. This
    // excludes subsequent rotation/condition clauses, such as “支援技取决于…”,
    // which name a skill without placing it in the investment sequence.
    const source = direction
      .split(/[；。]|，(?=[^，。；]*(?:根据需求|根据自身需求|酌情))/u)
      .filter((clause) => orderMarker.test(clause))
      .join('；')

    return fallbackSkillPriority
      .flatMap((key) =>
        skillPriorityAliases[key]
          .map((alias) => source.indexOf(alias))
          .filter((index) => index >= 0)
          .map((index) => ({ key, index })),
      )
      .reduce<Array<{ key: SkillPriorityKey; index: number }>>((matches, candidate) => {
        const existing = matches.find((match) => match.key === candidate.key)
        if (!existing) matches.push(candidate)
        else if (candidate.index < existing.index) existing.index = candidate.index
        return matches
      }, [])
      .sort((left, right) => left.index - right.index)
      .map((item) => item.key)
  })
  return explicitPriorities.filter((key, index, values) => values.indexOf(key) === index)
}

/**
 * A nonempty source field is authoritative even when it only records targets
 * or conditional prose. Legacy rankings are used solely when this source field
 * is absent, never to fill in an omitted order.
 */
function skillPriorityWithLegacyFallback(
  sourceDirections: readonly string[],
  legacyPriority: readonly string[],
) {
  return sourceDirections.length ? skillPriorityFromDirections(sourceDirections) : legacyPriority
}

/** Explicit target clauses are independent of investment order (11+ is not a rank). */
function skillTargetsFromDirections(directions: readonly string[]) {
  const targets: Partial<Record<SkillPriorityKey, string>> = {}
  const labels: Record<string, SkillPriorityKey> = {
    普攻: 'basic',
    普通攻击: 'basic',
    闪避: 'dodge',
    支援技: 'assist',
    特殊技: 'special',
    终结技: 'chain',
    连携技: 'chain',
    核心技: 'core',
  }
  for (const direction of directions) {
    const match =
      /^(普通攻击|普攻|闪避|支援技|特殊技|终结技|连携技|核心技)\s*(?:优先升至\s*)?(F|(?:1[0-5]|[1-9])\+?)$/.exec(
        direction.trim(),
      )
    if (!match || (match[2] === 'F' && match[1] !== '核心技')) continue
    targets[labels[match[1]!]!] = match[2]!
  }
  return targets
}

function engineRecommendation(engineDirection: string) {
  const current = currentAssetProjection.wEngines.find(
    (item) => item.stableId === engineDirection || item.playerName === engineDirection,
  )
  const catalog = wEngineCatalog.items.find(
    (item) => item.id === engineDirection || item.name === engineDirection,
  )
  const name = current?.playerName ?? catalog?.name ?? engineDirection
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
  skillLabels,
  skillPriorityFromDirections,
  skillPriorityWithLegacyFallback,
  skillTargetsFromDirections,
  teamDirectionsFromAuthority,
  teamDirectionsFromProfile,
  wEngineVisual,
}
