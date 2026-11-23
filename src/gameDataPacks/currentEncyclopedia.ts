import rawDisplay from './currentEncyclopediaData'
import {
  projectCurrentBangbooStats,
  resolveCurrentBangbooSkillProperty,
} from './currentBangbooNumericCatalog'
import { getReviewedAgentMenuBaseStats } from './panel/reviewedMenuBaseStats'
import {
  formatEncyclopediaCalculatedText,
  formatEncyclopediaProperty,
} from './encyclopediaPropertyFormat'

export type CatalogStat = { label: string; value: string }
export type CatalogEffect = { name: string; description: string; properties: CatalogStat[] }
export type CatalogSkillGroup = { slot: string; title: string; effects: CatalogEffect[] }
type Property = {
  label: string
  template: string
  parameters: { skillId: string; main: number; growth: number; format: string }[]
  potentialIds: number[]
}
type Effect = { name: string; description: string; properties: Property[]; potentialIds?: number[] }
type Agent = {
  stableId: string
  fullName: string
  faction: string
  attribute: string
  specialty: string
  specialAttribute: string | null
  baseStats60: Record<string, number>
  skills: { slot: string; effects: Effect[] }[]
  core: { level: number; potentialIds: number[]; effects: CatalogEffect[] }[]
  mindscapes: CatalogEffect[]
  potentialStages: {
    id: number
    level: number
    name: string
    description: string
    properties: CatalogStat[]
  }[]
}
type Bangboo = {
  stableId: string
  skills: {
    slot: string
    levels: { level: number; name: string; description: string; properties: Property[] }[]
  }[]
}
const display = rawDisplay as unknown as { agents: Agent[]; bangboos: Bangboo[] }
const agents = new Map(display.agents.map((x) => [x.stableId, x]))
const bangboos = new Map(display.bangboos.map((x) => [x.stableId, x]))
const number = (value: number) => String(Number(value.toFixed(2)))
const skills: Record<string, string> = {
  basic: '普通攻击',
  dodge: '闪避',
  assist: '支援技',
  special: '特殊技',
  chain: '连携技与终结技',
  a: '主动技',
  b: '额外能力',
  c: '邦布连携技',
}
const agentSkillSlots = ['basic', 'dodge', 'assist', 'special', 'chain'] as const
export function getAgentCatalogSkillOptions(id: string) {
  return agents.has(id)
    ? agentSkillSlots.map((slot) => ({ value: slot, label: skills[slot]! }))
    : []
}
const statLabels: Record<string, string> = {
  hp: '基础生命值',
  atk: '基础攻击力',
  def: '基础防御力',
  impact: '冲击力',
  critRate: '暴击率',
  critDamage: '暴击伤害',
  anomalyMastery: '异常掌控',
  anomalyProficiency: '异常精通',
  penRatio: '穿透率',
  energyRegen: '能量自动回复',
  adrenalineRegen: '闪能自动累积',
  maxAdrenaline: '闪能最大值',
  sharpEnergyRegen: '锐能自动累积',
  maxSharpEnergy: '锐能上限',
  lacerationDamage: '锐暴伤害',
}
const percentStats = new Set(['critRate', 'critDamage', 'penRatio', 'lacerationDamage'])
const statRows = (values: Record<string, number>, keys: string[]): CatalogStat[] =>
  keys
    .filter((k) => Number.isFinite(values[k]))
    .map((k) => ({
      label: statLabels[k] ?? k,
      value:
        number(values[k]! * (percentStats.has(k) ? 100 : 1)) + (percentStats.has(k) ? '%' : ''),
    }))
export function getAgentEncyclopedia(id: string) {
  return agents.get(id)
}
export function getAgentCatalogBaseStats(id: string): CatalogStat[] {
  const agent = agents.get(id)
  if (!agent) return []
  const values = { ...agent.baseStats60, ...getReviewedAgentMenuBaseStats(id, 60, 5)?.values }
  const resource =
    agent.specialty === 'rupture'
      ? ['adrenalineRegen', 'maxAdrenaline']
      : agent.specialty === 'armorer'
        ? ['lacerationDamage', 'sharpEnergyRegen', 'maxSharpEnergy']
        : ['energyRegen']
  // The catalog shows source-backed intrinsic stats, not the complete menu
  // projection. Efficiency effects remain in skill/core/equipment text and
  // retain their own evidence/state in the out-of-combat panel consumer.
  return statRows(values, [
    'hp',
    'atk',
    'def',
    'impact',
    'critRate',
    'critDamage',
    'anomalyMastery',
    'anomalyProficiency',
    'penRatio',
    ...resource,
  ])
}
function includesPotential(ids: number[] | undefined, id: number) {
  return !ids?.length || ids.includes(id)
}
function potentialId(agent: Agent, level: number) {
  return level === 0 ? 0 : (agent.potentialStages.find((x) => x.level === level)?.id ?? -1)
}
function propertyValue(p: Property, level: number, bangbooId?: string): string {
  const value = formatEncyclopediaProperty(p.template, level, (skillId, propertyKey) => {
    if (bangbooId) {
      const result = resolveCurrentBangbooSkillProperty({
        stableId: bangbooId,
        skillId,
        propertyKey,
        skillLevel: level,
      })
      if (result.status !== 'supported')
        throw Error(`Missing Bangboo property ${skillId}/${propertyKey}`)
      return { value: result.value * 100, format: result.format }
    }
    const v = p.parameters.find((x) => x.skillId === skillId)
    if (!v) throw Error(`Missing agent property ${skillId}`)
    return { value: (v.main + v.growth * (level - 1)) / 100, format: v.format }
  })
  return p.label === '能量消耗' && /^\d+(?:\.\d+)?$/.test(value) ? `${value}点` : value
}
export function getAgentCatalogSkills(
  id: string,
  level: number,
  potential: number,
  selectedSlot?: string,
): CatalogSkillGroup[] {
  const agent = agents.get(id)
  if (
    !agent ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 16 ||
    !Number.isInteger(potential) ||
    potential < 0 ||
    potential > agent.potentialStages.length
  )
    return []
  const pid = potentialId(agent, potential)
  return agentSkillSlots
    .filter((slot) => selectedSlot === undefined || slot === selectedSlot)
    .map((slot) => ({
      slot,
      title: skills[slot]!,
      effects: (agent.skills.find((x) => x.slot === slot)?.effects ?? [])
        .filter((e) => includesPotential(e.potentialIds, pid))
        .map((e) => ({
          name: e.name,
          description: formatEncyclopediaCalculatedText(e.description, level),
          properties: e.properties
            .filter((p) => includesPotential(p.potentialIds, pid))
            .map((p) => ({ label: p.label, value: propertyValue(p, level) })),
        })),
    }))
}
export function getAgentCatalogCore(id: string, level: number, potential: number): CatalogEffect[] {
  const agent = agents.get(id)
  if (
    !agent ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 7 ||
    !Number.isInteger(potential) ||
    potential < 0 ||
    potential > agent.potentialStages.length
  )
    return []
  return (
    agent.core
      .find(
        (x) =>
          x.level === level && includesPotential(x.potentialIds, potentialId(agent, potential)),
      )
      ?.effects.map((effect) => ({
        ...effect,
        description: formatEncyclopediaCalculatedText(effect.description),
      })) ?? []
  )
}
export function getAgentCatalogMindscapes(id: string): CatalogEffect[] {
  return (
    agents.get(id)?.mindscapes.map((effect) => ({
      ...effect,
      description: formatEncyclopediaCalculatedText(effect.description),
    })) ?? []
  )
}
export function getAgentCatalogPotential(id: string): CatalogEffect[] {
  return (
    agents.get(id)?.potentialStages.map((x) => ({
      name: `潜能${x.level} · ${x.name}`,
      description: formatEncyclopediaCalculatedText(x.description),
      properties: x.properties,
    })) ?? []
  )
}
export function getBangbooCatalogBaseStats(id: string): CatalogStat[] {
  const result = projectCurrentBangbooStats({ stableId: id, level: 60, ascensionLevelCap: 60 })
  if (result.status !== 'supported') return []
  return statRows(
    {
      hp: result.hp,
      atk: result.attack,
      def: result.defence,
      impact: result.breakStun,
      critRate: result.critRate,
      critDamage: result.critDamage,
      anomalyMastery: result.anomalyMastery,
      penRatio: result.penetrationRatio,
    },
    ['hp', 'atk', 'def', 'impact', 'critRate', 'critDamage', 'anomalyMastery', 'penRatio'],
  )
}
export function getBangbooCatalogSkills(id: string, stars: number): CatalogSkillGroup[] {
  const entry = bangboos.get(id)
  if (!entry || !Number.isInteger(stars) || stars < 1 || stars > 5) return []
  return entry.skills.map((s) => {
    const level = s.slot === 'b' ? stars : stars + 5
    const e = s.levels.find((x) => x.level === level)
    return {
      slot: s.slot,
      title: `${skills[s.slot]} · Lv.${level}`,
      effects: e
        ? [
            {
              name: e.name,
              description: formatEncyclopediaCalculatedText(e.description),
              properties: e.properties.map((p) => ({
                label: p.label,
                value: propertyValue(p, level, id),
              })),
            },
          ]
        : [],
    }
  })
}
