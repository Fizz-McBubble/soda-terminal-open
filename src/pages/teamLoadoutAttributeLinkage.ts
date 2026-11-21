import type { DriveDisc } from '../domain/schemas'
import labels from '../application/publicCandidateLabels.data.json'
import type { TeamExecutionAttributeRow } from './teamExecutionAttributePanel'
import type { TeamExecutionDiscPresentation } from './teamExecutionPresentation'

// Only direct, recorded disc properties participate. Set effects and converted character stats
// require their own calculation context and cannot identify a matching physical slot here.
const attributes: [string, string, string[]][] = [
  ['hp', '生命值', ['hp_flat', 'hp_percent']],
  ['atk', '攻击力', ['atk_flat', 'atk_percent']],
  ['def', '防御力', ['def_flat', 'def_percent']],
  ['critRate', '暴击率', ['crit_rate']],
  ['critDamage', '暴击伤害', ['crit_dmg']],
  ['anomalyProficiency', '异常精通', ['anomaly_proficiency']],
  ['anomalyMastery', '异常掌控', ['anomaly_mastery']],
  ['pen', '穿透值', ['pen']],
  ['penRatio', '穿透率', ['pen_ratio']],
  ['impact', '冲击力', ['impact']],
  ['energyRegen', '能量自动回复', ['energy_regen']],
  ['physicalDamageBonus', '物理伤害加成', ['physical_dmg']],
  ['fireDamageBonus', '火属性伤害加成', ['fire_dmg']],
  ['iceDamageBonus', '冰属性伤害加成', ['ice_dmg']],
  ['electricDamageBonus', '电属性伤害加成', ['electric_dmg']],
  ['etherDamageBonus', '以太伤害加成', ['ether_dmg']],
  ['windDamageBonus', '风属性伤害加成', ['wind_dmg']],
]
const byAttribute = new Map<string, readonly string[]>()
const byDiscStat = new Map<string, string>()
const byLabel = new Map(Object.entries(labels.stats).map(([key, label]) => [label, key]))
for (const [key, label, stats] of attributes) {
  byAttribute.set(key, stats)
  byAttribute.set(label, stats)
  for (const stat of stats) byDiscStat.set(stat, key)
  if (stats.length === 1) byLabel.set(label, stats[0])
}

// Older snapshots carry formatted labels only.
export function parseStatLabelToKey(label: string, value?: string) {
  const stat = byLabel.get(label.trim())
  if (!stat) return null
  if (stat.endsWith('_flat') && /[%％]/.test(value ?? '')) return stat.replace('_flat', '_percent')
  return stat
}

export function extractDiscStatKeys(
  disc: TeamExecutionDiscPresentation,
  warehouseDiscs?: ReadonlyMap<string, DriveDisc>,
): Set<string> {
  const physical = warehouseDiscs?.get(disc.id)
  if (physical) return new Set([physical.mainStat, ...physical.subStats.map((sub) => sub.stat)])
  if (disc.recordedStatKeys) return new Set(disc.recordedStatKeys)
  const keys = [
    parseStatLabelToKey(disc.main, disc.mainValue),
    ...disc.subs.map((sub) => parseStatLabelToKey(sub.name, sub.value)),
  ]
  return new Set(keys.filter((key): key is string => Boolean(key)))
}

export function getMatchedAttributeKeysForDisc(disc: TeamExecutionDiscPresentation) {
  const matched = new Set<string>()
  for (const stat of extractDiscStatKeys(disc)) {
    const key = byDiscStat.get(stat)
    if (key) matched.add(key)
  }
  return matched
}

export function getStatKeysForAttributeKeyOrLabel(keyOrLabel: string) {
  return byAttribute.get(keyOrLabel) ?? []
}

export function isRowMatched(
  row: TeamExecutionAttributeRow,
  matchedPanelKeys: ReadonlySet<string>,
) {
  if (row.key) return matchedPanelKeys.has(row.key)
  return getStatKeysForAttributeKeyOrLabel(row.label).some((stat) =>
    matchedPanelKeys.has(byDiscStat.get(stat) ?? ''),
  )
}

export function isDiscMatchingAttribute(
  disc: TeamExecutionDiscPresentation,
  matchingStatKeys: readonly string[],
) {
  const keys = extractDiscStatKeys(disc)
  return matchingStatKeys.some((key) => keys.has(key))
}
