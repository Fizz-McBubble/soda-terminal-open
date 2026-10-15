import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { attributePanelKeys } from '../domain/characterPanelStats'
export {
  attributePanelKeys,
  extendedPanelKeys,
  type ExtendedPanelKey,
} from '../domain/characterPanelStats'

export type CharacterPanelField = {
  key: string
  label: string
  unit: '%' | ''
  weightKey?: string
  detail?: boolean
}

const attributeLabels = {
  physical: '物理伤害加成',
  fire: '火属性伤害加成',
  ice: '冰属性伤害加成',
  electric: '电属性伤害加成',
  ether: '以太伤害加成',
  wind: '风属性伤害加成',
} as const

/** Presentation only. Display eligibility never creates a stat, target, or scoring weight. */
export function getCharacterPanelFields(agentId: string): CharacterPanelField[] {
  const identity = publicDevelopmentDirectoryCatalog.find((row) => row.stableId === agentId)
  const specialty = identity?.specialty
  const attribute = identity?.attribute as keyof typeof attributePanelKeys | 'lumiflux' | undefined
  const usesAdrenaline = agentId === 'agent-yixuan'
  const fields: CharacterPanelField[] = [
    { key: 'hp', label: '生命值', unit: '', weightKey: 'hp_percent' },
    { key: 'atk', label: '攻击力', unit: '', weightKey: 'atk_percent' },
    { key: 'def', label: '防御力', unit: '', weightKey: 'def_percent' },
    { key: 'impact', label: '冲击力', unit: '', weightKey: 'impact' },
    { key: 'critRate', label: '暴击率', unit: '%', weightKey: 'crit_rate' },
    specialty === 'armorer'
      ? { key: 'lacerationDamage', label: '锐暴伤害', unit: '%' }
      : { key: 'critDamage', label: '暴击伤害', unit: '%', weightKey: 'crit_dmg' },
    { key: 'anomalyMastery', label: '异常掌控', unit: '', weightKey: 'anomaly_mastery' },
    { key: 'anomalyProficiency', label: '异常精通', unit: '', weightKey: 'anomaly_proficiency' },
    { key: 'penRatio', label: '穿透率', unit: '%', weightKey: 'pen_ratio' },
    { key: 'pen', label: '穿透值', unit: '', weightKey: 'pen' },
    { key: 'energyRegen', label: '能量自动回复', unit: '', weightKey: 'energy_regen' },
  ]
  if (usesAdrenaline)
    fields.splice(
      fields.findIndex((field) => field.key === 'energyRegen'),
      1,
    )
  if (attribute && attribute !== 'lumiflux' && attributePanelKeys[attribute])
    fields.push({
      key: attributePanelKeys[attribute],
      label: attributeLabels[attribute],
      unit: '%',
      weightKey: `${attribute}_dmg`,
    })
  if (attribute === 'lumiflux')
    fields.push({ key: 'lumifluxDamageBonus', label: '辉光伤害加成', unit: '%' })
  if (specialty === 'rupture') fields.push({ key: 'sheerForce', label: '贯穿力', unit: '' })
  if (specialty === 'armorer')
    fields.push({ key: 'critDamage', label: '暴击伤害', unit: '%', detail: true })
  for (const [element, key] of Object.entries(attributePanelKeys)) {
    if (element !== attribute)
      fields.push({
        key,
        label: attributeLabels[element as keyof typeof attributeLabels],
        unit: '%',
        detail: true,
      })
  }
  if (usesAdrenaline)
    fields.push(
      { key: 'adrenalineRegen', label: '闪能自动累积', unit: '', detail: true },
      { key: 'adrenalineGenerationRate', label: '闪能获得效率', unit: '%', detail: true },
      { key: 'maxAdrenaline', label: '闪能上限', unit: '', detail: true },
    )
  else
    fields.push(
      { key: 'energyGenerationRate', label: '能量获得效率', unit: '%', detail: true },
      { key: 'maxEnergy', label: '能量上限', unit: '', detail: true },
    )
  return fields
}

export function formatCharacterPanelValue(
  field: Pick<CharacterPanelField, 'key' | 'unit'>,
  value: number | undefined,
) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const scale = field.unit === '%' || field.key === 'energyRegen' ? 10 : 1
  const rounded =
    field.key === 'hp' ? Math.ceil(value) : Math.floor((value + 1e-10) * scale) / scale
  return `${rounded}${field.unit}`
}
