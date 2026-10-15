import { describe, expect, it } from 'vitest'
import { formatCharacterPanelValue, getCharacterPanelFields } from './characterPanelFields'

describe('shared character panel presentation', () => {
  it('uses twelve common fields with PEN and own damage, keeping all six bonuses findable', () => {
    const fields = getCharacterPanelFields('agent-billy')
    expect(fields.filter((field) => !field.detail)).toHaveLength(12)
    expect(fields.find((field) => field.key === 'pen')?.detail).toBeUndefined()
    expect(fields.find((field) => field.key === 'physicalDamageBonus')?.detail).toBeUndefined()
    expect(fields.find((field) => field.key === 'fireDamageBonus')?.detail).toBe(true)
  })
  it('uses current identities for sharp, wind, and lumiflux instead of the legacy catalog alone', () => {
    const sharp = getCharacterPanelFields('agent-claret')
    expect(sharp.find((field) => field.key === 'lacerationDamage')).toMatchObject({
      label: '锐暴伤害',
    })
    expect(sharp.find((field) => field.key === 'critDamage')?.detail).toBe(true)
    expect(
      getCharacterPanelFields('agent-roxy').find((field) => field.key === 'windDamageBonus')
        ?.detail,
    ).toBeUndefined()
    expect(
      getCharacterPanelFields('agent-remielle').find((field) => field.key === 'lumifluxDamageBonus')
        ?.label,
    ).toBe('辉光伤害加成')
  })
  it('does not disguise Yixuan ordinary zero energy as an observed adrenaline stat', () => {
    const fields = getCharacterPanelFields('agent-yixuan')
    expect(fields.some((field) => field.key === 'sheerForce')).toBe(true)
    expect(fields.some((field) => field.key === 'energyRegen')).toBe(false)
    expect(fields.find((field) => field.key === 'adrenalineRegen')).toMatchObject({
      label: '闪能自动累积',
      detail: true,
    })
  })
  it('formats known zero, missing, flat, and percentage values distinctly', () => {
    expect(formatCharacterPanelValue({ key: 'pen', unit: '' }, 9)).toBe('9')
    expect(formatCharacterPanelValue({ key: 'penRatio', unit: '%' }, 0)).toBe('0%')
    expect(formatCharacterPanelValue({ key: 'energyGenerationRate', unit: '%' }, undefined)).toBe(
      '—',
    )
    expect(formatCharacterPanelValue({ key: 'energyRegen', unit: '' }, 1.239)).toBe('1.2')
  })
})
