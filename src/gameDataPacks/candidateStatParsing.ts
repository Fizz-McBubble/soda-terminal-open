import { driveDiscData } from '../data/gameData'
import type { StatKey } from '../domain/schemas'
import { statKeySchema } from '../domain/schemas'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
const statAliases: Array<[StatKey, string[]]> = [
  ['crit_rate', ['暴击率', '暴击']],
  ['crit_dmg', ['暴击伤害']],
  ['anomaly_proficiency', ['异常精通']],
  ['anomaly_mastery', ['异常掌控']],
  ['energy_regen', ['能量自动回复', '能量回复']],
  ['pen_ratio', ['穿透率']],
  ['pen', ['穿透值', '穿透']],
  ['impact', ['冲击力']],
  ['atk_flat', ['固定攻击力', '攻击力固定值', '小攻击']],
  ['def_flat', ['固定防御力', '防御力固定值', '小防御']],
  ['hp_flat', ['固定生命值', '生命值固定值', '小生命']],
  ['atk_percent', ['攻击力%', '攻击力％', '攻击力百分比', '攻击力']],
  ['def_percent', ['防御力%', '防御力％', '防御力百分比', '防御力']],
  ['hp_percent', ['生命值%', '生命值％', '生命值百分比', '生命值']],
  ['physical_dmg', ['物理伤害', '物理属性伤害', '物伤']],
  ['fire_dmg', ['火伤', '火属性伤害']],
  ['ice_dmg', ['冰伤', '冰属性伤害']],
  ['electric_dmg', ['电伤', '电属性伤害']],
  ['wind_dmg', ['风伤', '风属性伤害']],
  ['ether_dmg', ['以太伤害', '以太属性伤害']],
]

export function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(asStrings)
}

/** Match complete canonical tokens and consume the longest Chinese alias first. */
export function candidateStatKeys(text: string): StatKey[] {
  text = text.replaceAll('双暴', '暴击率/暴击伤害')
  const tokens = [
    ...statKeySchema.options.map((key) => ({ key, alias: key, canonical: true })),
    ...statAliases.flatMap(([key, aliases]) =>
      aliases.map((alias) => ({ key, alias, canonical: false })),
    ),
  ].sort((left, right) => right.alias.length - left.alias.length)
  const found: StatKey[] = []
  for (let index = 0; index < text.length; ) {
    const token = tokens.find(
      ({ alias, canonical }) =>
        text.startsWith(alias, index) &&
        (!canonical ||
          (!/[a-zA-Z0-9_]/.test(text[index - 1] ?? '') &&
            !/[a-zA-Z0-9_]/.test(text[index + alias.length] ?? ''))),
    )
    if (token) {
      found.push(token.key)
      index += token.alias.length
    } else index += 1
  }
  return [...new Set(found)]
}

export function candidateSubStatWeights(
  value: unknown,
): CandidateWarehouseConstraint['subStatWeights'] {
  // Main-stat prose is not substat evidence. Source adapters use either
  // main/sub or mainStats/subStats; preserve both existing contracts.
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? 'subStats' in value
        ? asStrings((value as { subStats: unknown }).subStats)
        : 'sub' in value
          ? asStrings((value as { sub: unknown }).sub)
          : []
      : asStrings(value)
  const legalSubstats = new Set(
    Object.values(driveDiscData?.rules.subStatStepsByRarity ?? {}).flatMap((rules) =>
      rules.map((rule) => rule.stat),
    ),
  )
  const typed = raw.map((entry) => statKeySchema.safeParse(entry))
  if (typed.length && typed.every((entry) => entry.success)) {
    const keys = [
      ...new Set(
        typed.flatMap((entry) =>
          entry.success && legalSubstats.has(entry.data) ? [entry.data] : [],
        ),
      ),
    ]
    return Object.fromEntries(keys.map((key, index) => [key, Math.max(0.35, 1 - index * 0.12)]))
  }
  const text = raw.join('；')
  const keys = candidateStatKeys(text).filter((key) => legalSubstats.has(key))
  // Only an unqualified strict chain declares an order. Equal, conditional,
  // mixed or unordered prose declares useful stats, not a total priority order.
  const groups = text.split(/[>＞]/).map((part) => part.trim())
  const strictOrder =
    groups.length > 1 &&
    groups.every((part) => {
      const key = candidateStatKeys(part)
      return (
        key.length === 1 &&
        (statKeySchema.options.includes(part as StatKey) ||
          statAliases.some(([stat, aliases]) => stat === key[0] && aliases.includes(part)))
      )
    }) &&
    new Set(groups.map((part) => candidateStatKeys(part)[0])).size === groups.length
  return Object.fromEntries(
    keys.map((key, index) => [key, strictOrder ? Math.max(0.35, 1 - index * 0.12) : 1]),
  )
}
