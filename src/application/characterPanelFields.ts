import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { attributePanelKeys } from '../domain/characterPanelStats'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  type CharacterPanelFieldBasis,
  type CharacterPanelDisplayContract,
  type FormatCharacterPanelValueOptions,
  characterPanelFieldContracts,
  getCharacterPanelDisplayContract,
  formatCharacterPanelValue,
} from './characterPanelMenuPresentation'

export {
  attributePanelKeys,
  extendedPanelKeys,
  type ExtendedPanelKey,
} from '../domain/characterPanelStats'

export {
  type CharacterPanelFieldBasis,
  type CharacterPanelDisplayContract,
  type FormatCharacterPanelValueOptions,
  characterPanelFieldContracts,
  getCharacterPanelDisplayContract,
  formatCharacterPanelValue,
}

export type CharacterPanelField = {
  key: string
  label: string
  unit: '%' | ''
  weightKey?: string
  detail?: boolean
  group?: 'primary' | 'supplementary' | 'resource'
  presentationPriority?: boolean
  basis?: CharacterPanelFieldBasis
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
  const usesAdrenaline = specialty === 'rupture'
  const usesSharpEnergy = Boolean(
    getCurrentAgentDecisionMechanicContract(agentId)?.resourceContract?.resourceFlow.resources.some(
      (resource) => resource.resource === 'sharpness',
    ),
  )
  const fields: CharacterPanelField[] = [
    { key: 'hp', label: '生命值', unit: '', weightKey: 'hp_percent', basis: 'flat' },
    usesSharpEnergy
      ? {
          key: 'lacerationDamage',
          label: '锐暴伤害',
          unit: '%',
          presentationPriority: true,
          basis: 'bonus_percent',
        }
      : { key: 'atk', label: '攻击力', unit: '', weightKey: 'atk_percent', basis: 'flat' },
    { key: 'def', label: '防御力', unit: '', weightKey: 'def_percent', basis: 'flat' },
    { key: 'impact', label: '冲击力', unit: '', weightKey: 'impact', basis: 'flat' },
    { key: 'critRate', label: '暴击率', unit: '%', weightKey: 'crit_rate', basis: 'bonus_percent' },
    {
      key: 'critDamage',
      label: '暴击伤害',
      unit: '%',
      weightKey: 'crit_dmg',
      basis: 'bonus_percent',
    },
    {
      key: 'anomalyMastery',
      label: '异常掌控',
      unit: '',
      weightKey: 'anomaly_mastery',
      basis: 'flat',
    },
    {
      key: 'anomalyProficiency',
      label: '异常精通',
      unit: '',
      weightKey: 'anomaly_proficiency',
      basis: 'flat',
    },
    specialty === 'rupture'
      ? { key: 'sheerForce', label: '贯穿力', unit: '', presentationPriority: true, basis: 'flat' }
      : {
          key: 'penRatio',
          label: '穿透率',
          unit: '%',
          weightKey: 'pen_ratio',
          basis: 'bonus_percent',
        },
    usesAdrenaline
      ? { key: 'adrenalineRegen', label: '闪能自动累积', unit: '', basis: 'flat' }
      : usesSharpEnergy
        ? { key: 'sharpEnergyRegen', label: '锐能自动累积', unit: '', basis: 'flat' }
        : {
            key: 'energyRegen',
            label: '能量自动回复',
            unit: '',
            weightKey: 'energy_regen',
            basis: 'flat',
          },
  ]
  for (const field of fields) field.group = 'primary'
  fields.push({
    key: 'pen',
    label: '穿透值',
    unit: '',
    weightKey: 'pen',
    group: 'supplementary',
    basis: 'flat',
  })
  if (attribute && attribute !== 'lumiflux' && attributePanelKeys[attribute])
    fields.push({
      key: attributePanelKeys[attribute],
      label: attributeLabels[attribute],
      unit: '%',
      weightKey: `${attribute}_dmg`,
      group: 'supplementary',
      basis: 'bonus_percent',
    })
  if (specialty === 'rupture')
    fields.push({
      key: 'penRatio',
      label: '穿透率',
      unit: '%',
      weightKey: 'pen_ratio',
      group: 'supplementary',
      basis: 'bonus_percent',
    })
  if (usesSharpEnergy)
    fields.push({
      key: 'atk',
      label: '攻击力',
      unit: '',
      weightKey: 'atk_percent',
      group: 'supplementary',
      basis: 'flat',
    })
  for (const [element, key] of Object.entries(attributePanelKeys)) {
    if (element !== attribute)
      fields.push({
        key,
        label: attributeLabels[element as keyof typeof attributeLabels],
        unit: '%',
        detail: true,
        group: 'supplementary',
        basis: 'bonus_percent',
      })
  }
  if (usesAdrenaline)
    fields.push(
      {
        key: 'adrenalineGenerationRate',
        label: '闪能获得效率',
        unit: '%',
        detail: true,
        group: 'resource',
        basis: 'bonus_percent',
      },
      {
        key: 'maxAdrenaline',
        label: '闪能最大值',
        unit: '',
        detail: true,
        group: 'resource',
        basis: 'flat',
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
        basis: 'bonus_percent',
      },
      {
        key: 'maxSharpEnergy',
        label: '锐能上限',
        unit: '',
        detail: true,
        group: 'resource',
        basis: 'flat',
      },
    )
  else
    fields.push(
      {
        key: 'energyGenerationRate',
        label: '能量获得效率',
        unit: '%',
        detail: true,
        group: 'resource',
        basis: 'total_percent',
      },
      {
        key: 'maxEnergy',
        label: '能量上限',
        unit: '',
        detail: true,
        group: 'resource',
        basis: 'flat',
      },
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
