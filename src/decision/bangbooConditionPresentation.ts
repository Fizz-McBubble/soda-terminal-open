import { agentCatalog, currentAgentDirectory, getBangbooName } from '../assault/catalog'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { currentBangbooAgentCompositionKey } from '../calculation/currentBangbooCompositionIdentity'
import { definitionsByGameId } from '../calculation/currentBangbooMechanicDefinitions'
import { resolveCurrentBangbooAdditionalActivation } from '../calculation/currentBangbooMechanicContracts'
import { getCurrentBangbooNumericData } from '../gameDataPacks/currentBangbooNumericCatalog'
import display from '../gameDataPacks/data/current-bangboo-display.3.1.json'
import { projectCurrentBangbooComposition } from './exhaustiveBangbooScoring'
import type {
  BangbooConditionPresentation,
  BangbooConditionRequirement,
} from '../application/publicBangbooConditionPresentation'

export type { BangbooConditionPresentation, BangbooConditionRequirement }

const labels: Record<string, string> = {
  'attribute:physical': '物理属性成员',
  'attribute:fire': '火属性成员',
  'attribute:ice': '冰属性成员',
  'attribute:electric': '电属性成员',
  'attribute:ether': '以太属性成员',
  'attribute:wind': '风属性成员',
  'specialty:attack': '强攻成员',
  'specialty:stun': '击破成员',
  'specialty:anomaly': '异常成员',
  'specialty:support': '支援成员',
  'specialty:defense': '防护成员',
  'specialty:rupture': '命破成员',
  'attack_type:pierce': '擅长穿透类型招式的成员',
}
for (const [id, , , , , , faction] of agentCatalog) {
  const composition = projectCurrentBangbooComposition([id])
  const factionKey = Object.keys(composition ?? {}).find((key) => key.startsWith('faction:'))
  if (factionKey) labels[factionKey] = `「${faction}」成员`
}
for (const agent of currentAgentDirectory)
  labels[currentBangbooAgentCompositionKey(agent.id)] = agent.name

const stripRole = (text: string) => text.replace(/^\[[^\]]+\]\s*/, '')

/** Composition is modeled for identity categories, not an absent attack-type field.
 * Missing field data must stay unknown instead of becoming a zero-member failure. */
function isKnownKey(key: string) {
  return /^(attribute|specialty|faction|agent):/.test(key)
}

/** A read-only explanation for ANY selected released Bangboo, independently of
 * the recommendation shortlist, ownership, or team strength rating. */
export function describeBangbooConditions(input: {
  memberIds: readonly string[]
  bangbooId: string
  stars: number
  skillLevel?: number
}): BangbooConditionPresentation {
  const numeric = getCurrentBangbooNumericData(input.bangbooId)
  const definition = numeric ? definitionsByGameId[numeric.gameId] : undefined
  const text = display.items.find((item) => item.stableId === input.bangbooId)
  const validStars = Number.isInteger(input.stars) && input.stars >= 1 && input.stars <= 5
  const validTeam =
    input.memberIds.length === 3 &&
    new Set(input.memberIds).size === 3 &&
    input.memberIds.every((id) => getCurrentAgentEventContract(id))
  const composition = validTeam ? projectCurrentBangbooComposition(input.memberIds) : null
  const additional = text?.skills
    .find((skill) => skill.slot === 'b')
    ?.levels.find((level) => level.level === input.stars)
  const additionalDescription = additional ? stripRole(additional.description) : ''
  const skillLevel = input.skillLevel ?? 1
  const baseSkills: BangbooConditionPresentation['baseSkills'] = (text?.skills ?? [])
    .filter((skill) => skill.slot !== 'b')
    .flatMap((skill) => {
      const row = skill.levels.find((level) => level.level === skillLevel)
      if (!row) return []
      const kind = skill.slot === 'a' ? ('active' as const) : ('chain' as const)
      return [
        {
          kind,
          label: kind === 'active' ? '主动技' : '邦布连携技',
          name: row.name,
          description: stripRole(row.description),
        },
      ]
    })
  const parameterRow = numeric?.skills.find((skill) => skill.role === 'additional_ability')
    ?.levelParams[input.stars - 1]
  const override =
    definition?.conditionMinimumIndex === undefined
      ? undefined
      : Number(parameterRow?.split('|')[definition.conditionMinimumIndex])
  const validThreshold = override === undefined || (Number.isInteger(override) && override > 0)
  const raw = definition
    ? [
        ...(definition.agentPresent
          ? [{ key: definition.agentPresent, minimum: 1, group: 'all' as const }]
          : []),
        ...(definition.allOf ?? []).map((row) => ({
          ...row,
          minimum: override ?? row.minimum,
          group: 'all' as const,
        })),
        ...(definition.anyOf ?? []).map((row) => ({ ...row, group: 'any' as const })),
      ]
    : []
  const requirements: BangbooConditionRequirement[] = raw.map((row) => {
    const known = composition && validThreshold && validStars && isKnownKey(row.key)
    const current = known ? (composition[row.key] ?? 0) : null
    return {
      key: row.key,
      label: labels[row.key] ?? '指定条件的成员',
      required: row.minimum,
      current,
      missing: current === null ? null : Math.max(0, row.minimum - current),
      met: current === null ? null : current >= row.minimum,
      group: row.group,
      matchingMemberIds:
        current === null
          ? []
          : input.memberIds.filter(
              (id) => (projectCurrentBangbooComposition([id])?.[row.key] ?? 0) > 0,
            ),
    }
  })
  const all = requirements.filter((row) => row.group === 'all')
  const any = requirements.filter((row) => row.group === 'any')
  const known =
    Boolean(definition && composition && validStars && validThreshold) &&
    requirements.every((row) => row.met !== null)
  const active = known && all.every((row) => row.met) && (!any.length || any.some((row) => row.met))
  const activationStatus = known ? (active ? 'active' : 'inactive') : 'unknown'
  const requirementText = (row: BangbooConditionRequirement) =>
    `至少 ${row.required} 名${row.label}`
  const requirementSummary =
    [
      ...all.map(requirementText),
      ...(any.length ? [`${any.map(requirementText).join('，或')}（满足其中一项）`] : []),
    ].join('；') || '暂无可核对的队伍条件'
  const missing = all.filter((row) => row.met === false)
  const progressSummary = !known
    ? !validTeam
      ? '选择三名不同的代理人后可核对。'
      : !validStars
        ? '选择 1–5 星后可核对。'
        : !definition
          ? '暂无可核对的额外能力资料。'
          : '成员的穿透招式类型尚未记录，暂不能判断是否满足。'
    : active
      ? '队伍条件已满足，额外能力已激活。'
      : [
          ...missing.map((row) => `还需 ${row.missing} 名${row.label}`),
          ...(any.length && !any.some((row) => row.met)
            ? [`还需${any.map((row) => ` ${row.missing} 名${row.label}`).join('，或')}`]
            : []),
        ].join('；') + '。基础技能仍可使用。'
  const minimumActivatingStars =
    known && composition
      ? ([1, 2, 3, 4, 5].find((star) => {
          const result = resolveCurrentBangbooAdditionalActivation({
            stableId: input.bangbooId,
            additionalAbilityLevel: star,
            composition,
          })
          return result.status === 'supported' && result.active
        }) ?? null)
      : null
  return {
    bangbooId: input.bangbooId,
    name: getBangbooName(input.bangbooId),
    stars: input.stars,
    activationStatus,
    requirementSummary,
    progressSummary,
    requirements,
    minimumActivatingStars,
    baseSkills,
    additionalAbility: additional
      ? {
          name: additional.name,
          description: additionalDescription,
          effectDescription:
            additionalDescription
              .split(/时触发[：:]/)
              .slice(1)
              .join('时触发：') || additionalDescription,
        }
      : null,
    sourceVersion: display.gameVersion,
    sourceUrl: text?.source.url ?? null,
  }
}
