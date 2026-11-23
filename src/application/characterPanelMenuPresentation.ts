export type CharacterPanelFieldBasis = 'total_percent' | 'bonus_percent' | 'flat'

export type CharacterPanelDisplayContract = {
  key: string
  unit: '%' | ''
  basis: CharacterPanelFieldBasis
  scale: number
  integer?: boolean
  ceil?: boolean
}

export type FormatCharacterPanelValueOptions = {
  basis?: CharacterPanelFieldBasis
  isDelta?: boolean
}

export const characterPanelFieldContracts: Record<string, CharacterPanelDisplayContract> = {
  hp: { key: 'hp', unit: '', basis: 'flat', scale: 1, integer: true, ceil: true },
  atk: { key: 'atk', unit: '', basis: 'flat', scale: 1, integer: true },
  def: { key: 'def', unit: '', basis: 'flat', scale: 1, integer: true },
  impact: { key: 'impact', unit: '', basis: 'flat', scale: 1, integer: true },
  critRate: { key: 'critRate', unit: '%', basis: 'bonus_percent', scale: 10 },
  critDamage: { key: 'critDamage', unit: '%', basis: 'bonus_percent', scale: 10 },
  anomalyMastery: { key: 'anomalyMastery', unit: '', basis: 'flat', scale: 1, integer: true },
  anomalyProficiency: {
    key: 'anomalyProficiency',
    unit: '',
    basis: 'flat',
    scale: 1,
    integer: true,
  },
  sheerForce: { key: 'sheerForce', unit: '', basis: 'flat', scale: 1, integer: true },
  penRatio: { key: 'penRatio', unit: '%', basis: 'bonus_percent', scale: 10 },
  pen: { key: 'pen', unit: '', basis: 'flat', scale: 1, integer: true },
  lacerationDamage: { key: 'lacerationDamage', unit: '%', basis: 'bonus_percent', scale: 10 },
  energyRegen: { key: 'energyRegen', unit: '', basis: 'flat', scale: 100 },
  adrenalineRegen: { key: 'adrenalineRegen', unit: '', basis: 'flat', scale: 100 },
  sharpEnergyRegen: { key: 'sharpEnergyRegen', unit: '', basis: 'flat', scale: 100 },
  namedResourceRegen: { key: 'namedResourceRegen', unit: '', basis: 'flat', scale: 100 },
  energyGenerationRate: {
    key: 'energyGenerationRate',
    unit: '%',
    basis: 'total_percent',
    scale: 10,
  },
  adrenalineGenerationRate: {
    key: 'adrenalineGenerationRate',
    unit: '%',
    basis: 'bonus_percent',
    scale: 10,
  },
  sharpEnergyGenerationRate: {
    key: 'sharpEnergyGenerationRate',
    unit: '%',
    basis: 'bonus_percent',
    scale: 10,
  },
  maxEnergy: { key: 'maxEnergy', unit: '', basis: 'flat', scale: 1, integer: true },
  maxAdrenaline: { key: 'maxAdrenaline', unit: '', basis: 'flat', scale: 1, integer: true },
  maxSharpEnergy: { key: 'maxSharpEnergy', unit: '', basis: 'flat', scale: 1, integer: true },
  physicalDamageBonus: { key: 'physicalDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
  fireDamageBonus: { key: 'fireDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
  iceDamageBonus: { key: 'iceDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
  electricDamageBonus: { key: 'electricDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
  etherDamageBonus: { key: 'etherDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
  windDamageBonus: { key: 'windDamageBonus', unit: '%', basis: 'bonus_percent', scale: 10 },
}

export function getCharacterPanelDisplayContract(
  key: string,
  fallbackUnit: '%' | '' = '',
): CharacterPanelDisplayContract {
  const existing = characterPanelFieldContracts[key]
  if (existing) return existing
  // A newly adopted field must supply its unit; its name cannot prove a basis.
  const unit = fallbackUnit
  const scale = unit === '%' ? 10 : 1
  return {
    key,
    unit,
    basis: unit === '%' ? 'bonus_percent' : 'flat',
    scale,
  }
}

/**
 * Apply the adopted menu field precision and display basis.
 * Preserves calculated canonical inputs while mapping display units, bases, and precision.
 * Unknown / non-finite values format distinctly as '—'.
 */
export function formatCharacterPanelValue(
  field: { key: string; unit?: '%' | ''; basis?: CharacterPanelFieldBasis },
  value: number | undefined | null,
  options?: FormatCharacterPanelValueOptions,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  const contract = getCharacterPanelDisplayContract(field.key, field.unit)
  const basis = options?.basis ?? field.basis ?? contract.basis
  const unit = field.unit ?? contract.unit

  // Map total-percent to bonus-percent when displaying total resource rates (e.g. energyGenerationRate: 100 -> 0%)
  const numericValue = !options?.isDelta && basis === 'total_percent' ? value - 100 : value

  if (contract.ceil) {
    return `${Math.ceil(numericValue)}${unit}`
  }

  const scale = contract.scale
  const rounded = Math.floor((numericValue + 1e-7) * scale) / scale
  return `${rounded}${unit}`
}
