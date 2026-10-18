import { describe, expect, it } from 'vitest'
import {
  formatCharacterPanelValue,
  getCharacterPanelFields,
  isCharacterPanelDetailRelevant,
} from './characterPanelFields'
import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'

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
      getCharacterPanelFields('agent-roxy').find((field) => field.key === 'energyRegen'),
    ).toMatchObject({ label: '能量自动回复' })
    expect(
      getCharacterPanelFields('agent-remielle').find((field) => field.key === 'lumifluxDamageBonus')
        ?.label,
    ).toBe('辉光伤害加成')
  })
  it('labels every rupture agent with its own resource contract instead of shared adrenaline', () => {
    const ruptureAgentIds = publicDevelopmentDirectoryCatalog
      .filter((agent) => agent.specialty === 'rupture')
      .map((agent) => agent.stableId)
    expect(ruptureAgentIds).toEqual(
      expect.arrayContaining([
        'agent-starlight-billy',
        'agent-banyue',
        'agent-yidhari',
        'agent-yixuan',
        'agent-manato',
      ]),
    )
    const expectedLabels: Readonly<Record<string, string>> = {
      'agent-yixuan': '术法点自动累积',
      'agent-starlight-billy': '决意自动累积',
      'agent-banyue': '忿火自动累积',
      'agent-yidhari': '喧响值自动累积',
      'agent-manato': '炽心自动累积',
    }
    for (const agentId of ruptureAgentIds) {
      const fields = getCharacterPanelFields(agentId)
      expect(fields.some((field) => field.key === 'sheerForce')).toBe(true)
      expect(fields.find((field) => field.key === 'sheerForce')?.presentationPriority).toBe(true)
      expect(fields.some((field) => field.key === 'energyRegen')).toBe(false)
      expect(fields.find((field) => field.key === 'namedResourceRegen')).toMatchObject({
        label: expectedLabels[agentId],
        group: 'primary',
      })
      expect(fields.find((field) => field.key === 'penRatio')).toMatchObject({
        detail: true,
        group: 'supplementary',
      })
      expect(fields.find((field) => field.key === 'namedResourceRegen')?.detail).toBeUndefined()
      expect(
        fields.some((field) =>
          ['sharpEnergyRegen', 'energyGenerationRate', 'maxEnergy'].includes(field.key),
        ),
      ).toBe(false)
    }
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
  it('assigns every released agent to exactly one primary resource family', () => {
    for (const agent of publicDevelopmentDirectoryCatalog) {
      const fields = getCharacterPanelFields(agent.stableId)
      const primaryKeys = fields
        .filter((field) => field.group === 'primary')
        .map((field) => field.key)
      const familyKeys = [
        primaryKeys.includes('namedResourceRegen'),
        primaryKeys.includes('sharpEnergyRegen'),
        primaryKeys.includes('energyRegen'),
      ]
      expect(familyKeys.filter(Boolean), agent.stableId).toHaveLength(1)
      if (agent.specialty === 'rupture')
        expect(primaryKeys, agent.stableId).toContain('namedResourceRegen')
      else if (
        getCurrentAgentDecisionMechanicContract(
          agent.stableId,
        )?.resourceContract?.resourceFlow.resources.some(
          (resource) => resource.resource === 'sharpness',
        )
      )
        expect(primaryKeys, agent.stableId).toContain('sharpEnergyRegen')
      else expect(primaryKeys, agent.stableId).toContain('energyRegen')
    }
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
    expect(formatCharacterPanelValue({ key: 'namedResourceRegen', unit: '' }, 2.5)).toBe('2.5')
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
