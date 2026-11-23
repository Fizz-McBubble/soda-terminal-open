import type { GoldenWorkbenchData } from './types'
import { getCharacterPanelFields } from '../../application/characterPanelFields'

type PanelFact = GoldenWorkbenchData['panelFacts'][number]
const optionalResourceEfficiency = new Set([
  'adrenalineGenerationRate',
  'sharpEnergyGenerationRate',
])

/** Game-menu positions are independent of recommendation, focus and numerical value. */
export function workbenchPanelPresentation(subject: GoldenWorkbenchData) {
  const fields = getCharacterPanelFields(subject.agentId)
  const available = subject.currentPanel?.availability !== 'unavailable'
  const all: PanelFact[] = fields.flatMap((field) => {
    const fact = subject.panelFacts.find(
      (item) => item.key === field.key || item.name === field.label,
    )
    // Unsupported special efficiencies have no useful panel row. A sourced zero
    // remains visible; the underlying field and unknown evidence are retained.
    if (optionalResourceEfficiency.has(field.key) && !Number.isFinite(fact?.currentValue)) return []
    return [
      {
        ...fact,
        key: field.key,
        name: field.label,
        group: field.group,
        detail: field.detail,
        value: available ? (fact?.value ?? '—') : '—',
        currentValue: available ? fact?.currentValue : undefined,
      },
    ]
  })
  const main = all.filter((fact) => fact.group === 'primary')
  const byKey = new Map(all.map((fact) => [fact.key, fact]))
  const resource = all.filter((fact) => fact.group === 'resource')
  const fullKeys = [
    'hp',
    'atk',
    'lacerationDamage',
    'def',
    'impact',
    'critRate',
    'critDamage',
    'anomalyMastery',
    'anomalyProficiency',
    'sheerForce',
    'penRatio',
    'pen',
    'energyRegen',
    'adrenalineRegen',
    'sharpEnergyRegen',
    ...resource.map((fact) => fact.key!),
    'physicalDamageBonus',
    'fireDamageBonus',
    'iceDamageBonus',
    'electricDamageBonus',
    'etherDamageBonus',
    'windDamageBonus',
  ]
  const full = fullKeys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : []))
  return {
    main,
    details: all.filter((fact) => fact.group !== 'primary'),
    full,
  }
}

/** Source references beyond the compact capacity remain in the existing disclosure. */
export function workbenchTargetPresentation(subject: GoldenWorkbenchData) {
  const candidates = subject.graduation.panel.filter(
    (fact) => fact.placement !== 'reference' && fact.semantic?.observation !== 'in_combat',
  )
  const main = candidates.slice(0, 4)
  const reference = subject.graduation.panel.filter((fact) => !main.includes(fact))
  return {
    main,
    reference,
    optionalOnly:
      main.length > 0 && main.every((fact) => fact.semantic?.requirement === 'optional'),
  }
}
