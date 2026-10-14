import { describe, expect, it } from 'vitest'
import data from './skillInvestmentMaterials32.data.json'
import { currentAgentEventContracts } from './currentAgentMechanicContracts'
import {
  resolveSkillInvestmentMaterials,
  skillInvestmentMaterialsIdentity,
} from './skillInvestmentMaterials'

const skills = ['basic', 'dodge', 'assist', 'special', 'chain'] as const
describe('exact current-agent paid skill materials', () => {
  it('covers the exact 60 current game identities and independently hashed sources', () => {
    expect(data.rows).toHaveLength(60)
    expect(skillInvestmentMaterialsIdentity.supportedAgentCount).toBe(60)
    expect(new Set(data.rows.map((row) => row.agentId)).size).toBe(60)
    expect(data.rows.map((row) => row.gameId).sort()).toEqual(
      currentAgentEventContracts.map((row) => row.externalId).sort(),
    )
    for (const row of data.rows) {
      expect(row.status).toBe('supported')
      expect(row.source.sourceVersion).toBe('3.2')
      expect(row.source.sha256).toMatch(/^[A-F0-9]{64}$/)
      expect(row.source.url).toBe(
        `https://static.nanoka.cc/zzz/3.2/en/character/${row.gameId}.json`,
      )
    }
  })
  for (const actor of data.rows) {
    it(`${actor.agentId}: all six core and 55 combat paid upgrade rows`, () => {
      for (const skill of [...skills, 'core'] as const) {
        const table =
          skill === 'core'
            ? actor.coreCosts
            : actor.combatTables[actor.combatTableBySkill[skill] as keyof typeof actor.combatTables]
        for (let level = 1; level <= (skill === 'core' ? 6 : 11); level++) {
          const result = resolveSkillInvestmentMaterials({
            agentId: actor.agentId,
            skill,
            currentBaseLevel: level,
          })
          expect(result.status).toBe('supported')
          if (result.status !== 'supported') throw new Error(result.reason)
          expect(
            Object.fromEntries(result.materials.map((row) => [row.itemId, row.quantity])),
          ).toEqual(table[String(level) as keyof typeof table])
          expect(result.fromBaseLevel).toBe(level)
          expect(result.toBaseLevel).toBe(level + 1)
          const locator =
            skill === 'core' ? `passive.materials.${level}` : `skill.${skill}.material.${level}`
          expect(result.sourceRefs).toEqual([
            `${actor.source.url}#${actor.source.sha256}:${locator}`,
          ])
        }
      }
    })
  }
  it('retains character-specific recent core IDs and the first paid learning row', () => {
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-ye-shunguang',
        skill: 'core',
        currentBaseLevel: 1,
      }),
    ).toMatchObject({ status: 'supported', materials: [{ itemId: '10', quantity: 5000 }] })
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-ye-shunguang',
        skill: 'core',
        currentBaseLevel: 6,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110513', quantity: 30 },
        { itemId: '110008', quantity: 4 },
      ],
    })
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-remielle',
        skill: 'core',
        currentBaseLevel: 6,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110515', quantity: 30 },
        { itemId: '110010', quantity: 4 },
      ],
    })
  })
  it('consumes real wind and lumiflux owner tables instead of guessing chip identities', () => {
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-velina',
        skill: 'special',
        currentBaseLevel: 11,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 135000 },
        { itemId: '100136', quantity: 15, grade: 3, attribute: 'wind' },
        { itemId: '100941', quantity: 1 },
      ],
    })
    for (const actor of data.rows.filter((row) => row.attribute === 'lumiflux'))
      expect(
        resolveSkillInvestmentMaterials({
          agentId: actor.agentId,
          skill: 'basic',
          currentBaseLevel: 11,
        }),
      ).toMatchObject({
        status: 'supported',
        materials: [
          { itemId: '10', quantity: 135000 },
          { itemId: '100137', quantity: 15, attribute: 'lumiflux' },
          { itemId: '100941', quantity: 1 },
        ],
      })
  })
  it('does not invent costs for cap/effective levels or unknown identities', () => {
    for (const currentBaseLevel of [0, 7, 15, 16, 1.5, Number.NaN])
      expect(
        resolveSkillInvestmentMaterials({ agentId: 'agent-anby', skill: 'core', currentBaseLevel })
          .status,
      ).toBe('unknown')
    for (const currentBaseLevel of [0, 12, 15, 16, 1.5])
      expect(
        resolveSkillInvestmentMaterials({ agentId: 'agent-anby', skill: 'basic', currentBaseLevel })
          .status,
      ).toBe('unknown')
    expect(
      resolveSkillInvestmentMaterials({ agentId: 'missing', skill: 'core', currentBaseLevel: 1 })
        .status,
    ).toBe('unknown')
  })
})
