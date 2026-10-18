/** Display percentages use percentage points; flat stats keep their game units. */
export const attributePanelKeys = {
  physical: 'physicalDamageBonus',
  fire: 'fireDamageBonus',
  ice: 'iceDamageBonus',
  electric: 'electricDamageBonus',
  ether: 'etherDamageBonus',
  wind: 'windDamageBonus',
} as const

export const extendedPanelKeys = [
  ...Object.values(attributePanelKeys),
  'lumifluxDamageBonus',
  'sheerForce',
  'energyGenerationRate',
  'maxEnergy',
  'namedResourceRegen',
  'namedResourceGenerationRate',
  'maxNamedResource',
  'adrenalineRegen',
  'adrenalineGenerationRate',
  'maxAdrenaline',
  'sharpEnergyRegen',
  'sharpEnergyGenerationRate',
  'maxSharpEnergy',
] as const
export type ExtendedPanelKey = (typeof extendedPanelKeys)[number]
