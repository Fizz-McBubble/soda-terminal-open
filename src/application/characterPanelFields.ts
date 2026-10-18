import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { attributePanelKeys } from '../domain/characterPanelStats'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
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
  group?: 'primary' | 'supplementary' | 'resource'
  presentationPriority?: boolean
}

const attributeLabels = {
  physical: '物理伤害加成',
  fire: '火属性伤害加成',
  ice: '冰属性伤害加成',
  electric: '电属性伤害加成',
  ether: '以太伤害加成',
  wind: '风属性伤害加成',
} as const

const namedResourceLabels: Readonly<Record<string, string>> = {
  technique_points: '术法点',
  determination: '决意',
  wrathful_fires: '忿火',
  decibels: '喧响值',
  blazing_heart: '炽心',
}

function resolveNamedRuptureResource(agentId: string, specialty: string | undefined) {
  if (specialty !== 'rupture') return null
  const resources =
    getCurrentAgentDecisionMechanicContract(agentId)?.resourceContract?.resourceFlow.resources ?? []
  if (resources.length !== 1) return null
  const resourceId = resources[0]!.resource
  return {
    resourceId,
    label: namedResourceLabels[resourceId] ?? `具名资源（${resourceId}）`,
  }
}

/** Presentation only. Display eligibility never creates a stat, target, or scoring weight. */
export function getCharacterPanelFields(agentId: string): CharacterPanelField[] {
  const identity = publicDevelopmentDirectoryCatalog.find((row) => row.stableId === agentId)
  const specialty = identity?.specialty
  const attribute = identity?.attribute as keyof typeof attributePanelKeys | 'lumiflux' | undefined
  const namedRuptureResource = resolveNamedRuptureResource(agentId, specialty)
  const usesSharpEnergy = Boolean(
    getCurrentAgentDecisionMechanicContract(agentId)?.resourceContract?.resourceFlow.resources.some(
      (resource) => resource.resource === 'sharpness',
    ),
  )
  const fields: CharacterPanelField[] = [
    { key: 'hp', label: '生命值', unit: '', weightKey: 'hp_percent' },
    usesSharpEnergy
      ? { key: 'lacerationDamage', label: '锐暴伤害', unit: '%', presentationPriority: true }
      : { key: 'atk', label: '攻击力', unit: '', weightKey: 'atk_percent' },
    { key: 'def', label: '防御力', unit: '', weightKey: 'def_percent' },
    { key: 'impact', label: '冲击力', unit: '', weightKey: 'impact' },
    { key: 'critRate', label: '暴击率', unit: '%', weightKey: 'crit_rate' },
    { key: 'critDamage', label: '暴击伤害', unit: '%', weightKey: 'crit_dmg' },
    { key: 'anomalyMastery', label: '异常掌控', unit: '', weightKey: 'anomaly_mastery' },
    { key: 'anomalyProficiency', label: '异常精通', unit: '', weightKey: 'anomaly_proficiency' },
    specialty === 'rupture'
      ? { key: 'sheerForce', label: '贯穿力', unit: '', presentationPriority: true }
      : { key: 'penRatio', label: '穿透率', unit: '%', weightKey: 'pen_ratio' },
    namedRuptureResource
      ? {
          key: 'namedResourceRegen',
          label: `${namedRuptureResource.label}自动累积`,
          unit: '',
        }
      : usesSharpEnergy
        ? { key: 'sharpEnergyRegen', label: '锐能自动累积', unit: '' }
        : { key: 'energyRegen', label: '能量自动回复', unit: '', weightKey: 'energy_regen' },
  ]
  for (const field of fields) field.group = 'primary'
  fields.push({ key: 'pen', label: '穿透值', unit: '', weightKey: 'pen', group: 'supplementary' })
  if (attribute && attribute !== 'lumiflux' && attributePanelKeys[attribute])
    fields.push({
      key: attributePanelKeys[attribute],
      label: attributeLabels[attribute],
      unit: '%',
      weightKey: `${attribute}_dmg`,
      group: 'supplementary',
    })
  if (attribute === 'lumiflux')
    fields.push({
      key: 'lumifluxDamageBonus',
      label: '辉光伤害加成',
      unit: '%',
      group: 'supplementary',
    })
  if (specialty === 'rupture')
    fields.push({
      key: 'penRatio',
      label: '穿透率',
      unit: '%',
      weightKey: 'pen_ratio',
      detail: true,
      group: 'supplementary',
    })
  if (usesSharpEnergy)
    fields.push({
      key: 'atk',
      label: '攻击力',
      unit: '',
      weightKey: 'atk_percent',
      detail: true,
      group: 'supplementary',
    })
  for (const [element, key] of Object.entries(attributePanelKeys)) {
    if (element !== attribute)
      fields.push({
        key,
        label: attributeLabels[element as keyof typeof attributeLabels],
        unit: '%',
        detail: true,
        group: 'supplementary',
      })
  }
  if (namedRuptureResource)
    fields.push(
      {
        key: 'namedResourceGenerationRate',
        label: `${namedRuptureResource.label}获得效率`,
        unit: '%',
        detail: true,
        group: 'resource',
      },
      {
        key: 'maxNamedResource',
        label: `${namedRuptureResource.label}上限`,
        unit: '',
        detail: true,
        group: 'resource',
      },
    )
  else if (usesSharpEnergy)
    fields.push(
      {
        key: 'sharpEnergyGenerationRate',
        label: '锐能获得效率',
        unit: '%',
        detail: true,
        group: 'resource',
      },
      { key: 'maxSharpEnergy', label: '锐能上限', unit: '', detail: true, group: 'resource' },
    )
  else
    fields.push(
      {
        key: 'energyGenerationRate',
        label: '能量获得效率',
        unit: '%',
        detail: true,
        group: 'resource',
      },
      { key: 'maxEnergy', label: '能量上限', unit: '', detail: true, group: 'resource' },
    )
  return fields
}

/** Only applicable descriptors are supplied; unknown values never become observed zeroes. */
export function isCharacterPanelDetailRelevant(
  field: Pick<CharacterPanelField, 'key' | 'detail' | 'group'>,
  currentValue: number | undefined,
  baselineValue?: number,
) {
  if (!field.detail || field.group === 'resource') return true
  // Preserve resource semantics for older presentation records without group metadata.
  if (
    /^(?:energyGenerationRate|maxEnergy|namedResourceGenerationRate|maxNamedResource|adrenalineGenerationRate|maxAdrenaline|sharpEnergyGenerationRate|maxSharpEnergy)$/.test(
      field.key,
    )
  )
    return true
  const currentKnown = currentValue !== undefined && Number.isFinite(currentValue)
  const baselineKnown = baselineValue !== undefined && Number.isFinite(baselineValue)
  return (
    (currentKnown && currentValue !== 0) ||
    (baselineKnown && baselineValue !== 0) ||
    (currentKnown && baselineKnown && currentValue !== baselineValue)
  )
}

export function formatCharacterPanelValue(
  field: Pick<CharacterPanelField, 'key' | 'unit'>,
  value: number | undefined,
) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const scale =
    field.unit === '%' ||
    ['energyRegen', 'namedResourceRegen', 'adrenalineRegen', 'sharpEnergyRegen'].includes(field.key)
      ? 10
      : 1
  const rounded =
    field.key === 'hp' ? Math.ceil(value) : Math.floor((value + 1e-10) * scale) / scale
  return `${rounded}${field.unit}`
}
