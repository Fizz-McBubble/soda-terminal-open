import { describe, expect, it } from 'vitest'
import {
  formatCharacterPanelValue,
  getCharacterPanelFields,
  isCharacterPanelDetailRelevant,
} from './characterPanelFields'

describe('shared character panel presentation', () => {
  it('uses twelve common fields with PEN and own damage, keeping all six bonuses findable', () => {
    const fields = getCharacterPanelFields('agent-billy')
    expect(fields.filter((field) => !field.detail)).toHaveLength(12)
    expect(fields.filter((field) => field.group === 'primary').map((field) => field.key)).toEqual([
      'hp',
      'atk',
      'def',
      'impact',
      'critRate',
      'critDamage',
      'anomalyMastery',
      'anomalyProficiency',
      'penRatio',
      'energyRegen',
    ])
    expect(
      fields
        .filter((field) => !field.detail && field.group === 'supplementary')
        .map((field) => field.key),
    ).toEqual(['pen', 'physicalDamageBonus'])
    expect(fields.find((field) => field.key === 'pen')?.detail).toBeUndefined()
    expect(fields.find((field) => field.key === 'physicalDamageBonus')?.detail).toBeUndefined()
    expect(fields.find((field) => field.key === 'fireDamageBonus')?.detail).toBe(true)
  })
  it('uses current identities for sharp, wind, and lumiflux instead of the legacy catalog alone', () => {
    const sharp = getCharacterPanelFields('agent-claret')
    expect(sharp.find((field) => field.key === 'lacerationDamage')).toMatchObject({
      label: '锐暴伤害',
    })
    expect(sharp.filter((field) => field.group === 'primary').map((field) => field.key)).toEqual([
      'hp',
      'lacerationDamage',
      'def',
      'impact',
      'critRate',
      'critDamage',
      'anomalyMastery',
      'anomalyProficiency',
      'penRatio',
      'sharpEnergyRegen',
    ])
    expect(sharp.find((field) => field.key === 'atk')).toMatchObject({
      detail: true,
      group: 'supplementary',
    })
    expect(sharp.filter((field) => field.group === 'resource').map((field) => field.key)).toEqual([
      'sharpEnergyGenerationRate',
      'maxSharpEnergy',
    ])
    expect(sharp.find((field) => field.key === 'lacerationDamage')?.presentationPriority).toBe(true)
    expect(
      sharp.some((field) =>
        ['energyRegen', 'energyGenerationRate', 'maxEnergy', 'adrenalineRegen'].includes(field.key),
      ),
    ).toBe(false)
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
    expect(fields.find((field) => field.key === 'sheerForce')?.presentationPriority).toBe(true)
    expect(fields.some((field) => field.key === 'energyRegen')).toBe(false)
    expect(fields.find((field) => field.key === 'adrenalineRegen')).toMatchObject({
      label: '闪能自动累积',
      group: 'primary',
    })
    expect(fields.filter((field) => field.group === 'primary').map((field) => field.key)).toEqual([
      'hp',
      'atk',
      'def',
      'impact',
      'critRate',
      'critDamage',
      'anomalyMastery',
      'anomalyProficiency',
      'sheerForce',
      'adrenalineRegen',
    ])
    expect(fields.find((field) => field.key === 'penRatio')).toMatchObject({
      detail: true,
      group: 'supplementary',
    })
    expect(fields.find((field) => field.key === 'adrenalineRegen')?.detail).toBeUndefined()
    expect(
      fields.some((field) =>
        ['sharpEnergyRegen', 'energyGenerationRate', 'maxEnergy'].includes(field.key),
      ),
    ).toBe(false)
  })
  it('only declares ordinary energy resources for an ordinary character', () => {
    const fields = getCharacterPanelFields('agent-billy')
    expect(fields.filter((field) => field.group === 'resource').map((field) => field.key)).toEqual([
      'energyGenerationRate',
      'maxEnergy',
    ])
    expect(
      fields.some((field) =>
        /^(adrenaline|sharpEnergy|maxAdrenaline|maxSharpEnergy)/.test(field.key),
      ),
    ).toBe(false)
    expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length)
  })
  it('formats known zero, missing, flat, and percentage values distinctly', () => {
    expect(formatCharacterPanelValue({ key: 'pen', unit: '' }, 9)).toBe('9')
    expect(formatCharacterPanelValue({ key: 'penRatio', unit: '%' }, 0)).toBe('0%')
    expect(formatCharacterPanelValue({ key: 'energyGenerationRate', unit: '%' }, undefined)).toBe(
      '—',
    )
    expect(formatCharacterPanelValue({ key: 'energyRegen', unit: '' }, 1.239)).toBe('1.2')
    expect(formatCharacterPanelValue({ key: 'sharpEnergyRegen', unit: '' }, undefined)).toBe('—')
    expect(formatCharacterPanelValue({ key: 'sharpEnergyRegen', unit: '' }, 1.5)).toBe('1.5')
    expect(formatCharacterPanelValue({ key: 'adrenalineRegen', unit: '' }, 2.5)).toBe('2.5')
  })
  it('keeps relevant known values and applicable unknown resources without assuming zero', () => {
    const detail = { key: 'fireDamageBonus', detail: true, group: 'supplementary' as const }
    expect(isCharacterPanelDetailRelevant(detail, 0, 0)).toBe(false)
    expect(isCharacterPanelDetailRelevant(detail, undefined, 0)).toBe(false)
    expect(isCharacterPanelDetailRelevant(detail, Number.NaN, undefined)).toBe(false)
    expect(isCharacterPanelDetailRelevant(detail, 0.001, 0)).toBe(true)
    expect(isCharacterPanelDetailRelevant(detail, undefined, 15)).toBe(true)
    expect(isCharacterPanelDetailRelevant({ ...detail, detail: false }, undefined)).toBe(true)
    expect(
      isCharacterPanelDetailRelevant(
        { key: 'maxSharpEnergy', detail: true, group: 'resource' },
        undefined,
      ),
    ).toBe(true)
  })
})
