import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { discs, member } from './teamExecutionAttributePanel.testFixture'
import {
  createTeamExecutionAttributePanel,
  resolveSuggestedWEngineParameters,
} from './teamExecutionAttributePanel'

describe('equipment growth in the player panel', () => {
  it('does not carry current level-30 ascension into the independent level-60 suggested engine', () => {
    const baseAgent = createEmptyRoster().agents.find((item) => item.agentId === 'agent-remielle')!
    const agent = {
      ...baseAgent,
      owned: true,
      level: 60,
      ascension: 5,
      mindscape: 2,
      progressionManuallySet: true,
      wEngineDetails: {
        id: 'wengine-14158',
        name: '空羽复归之诗',
        level: 30,
        ascension: 2,
        refinement: 1,
      },
      skillLevels: { ...baseAgent.skillLevels, core: 7 },
    }
    const executionMember = member('agent-remielle', {
      engineId: 'wengine-14158',
      copyId: null,
      refinement: 1,
      fact: 'confirmed',
    })
    executionMember.current.discIds = discs.map((disc) => disc.id)
    const view = createTeamExecutionAttributePanel({ agent, member: executionMember, discs })

    // Suggested contract uses Lv60. Observed Remielle white ATK 823 +
    // engine Lv60/5 white ATK 743, then its static ATK36%, followed by
    // slot2 316 and the recorded flat substat 42: (823 + 743) * 1.36 + 358.
    expect(view.rows.find((row) => row.label === '攻击力')).toMatchObject({
      current: '2487',
      currentStatus: 'exact',
    })
    // The current engine remains the player's explicit Lv30/2 equipment.
    expect(view.rows.find((row) => row.label === '攻击力')?.outOfCombat).not.toBe('2487')
  })

  it.each([
    [30, 2, '1830'],
    [10, 0, '1445'],
  ])(
    'preserves explicit suggested level %s / ascension %s in its final panel',
    (level, ascension, expectedAttack) => {
      const baseAgent = createEmptyRoster().agents.find(
        (item) => item.agentId === 'agent-remielle',
      )!
      const agent = {
        ...baseAgent,
        owned: true,
        level: 60,
        ascension: 5,
        mindscape: 2,
        progressionManuallySet: true,
        wEngineDetails: {
          id: 'wengine-14158',
          name: '空羽复归之诗',
          level: 60,
          ascension: 5,
          refinement: 1,
        },
        skillLevels: { ...baseAgent.skillLevels, core: 7 },
      }
      const suggested = {
        engineId: 'wengine-14158',
        copyId: null,
        level,
        ascension,
        refinement: 1,
        fact: 'confirmed' as const,
      }
      expect(resolveSuggestedWEngineParameters(suggested, null)).toEqual({
        engineId: 'wengine-14158',
        level,
        ascension,
        refinement: 1,
      })
      const executionMember = member('agent-remielle', suggested)
      executionMember.current.discIds = discs.map((disc) => disc.id)
      const view = createTeamExecutionAttributePanel({ agent, member: executionMember, discs })

      // At30/A2: (823 + menu white374)*(1+.144*1.6)+358 =1830.2928.
      // At10/A0: (823 + menu white128)*(1+.144)+358 =1445.944.
      expect(view.rows.find((row) => row.label === '攻击力')).toMatchObject({
        outOfCombat: '2487',
        current: expectedAttack,
        currentStatus: 'exact',
      })
    },
  )

  it('clears an unrelated stale ascension when resolving the current engine from a legacy account copy', () => {
    const baseAgent = createEmptyRoster().agents.find((item) => item.agentId === 'agent-remielle')!
    const agent = {
      ...baseAgent,
      owned: true,
      level: 60,
      ascension: 5,
      mindscape: 2,
      progressionManuallySet: true,
      wEngineCopyId: 'menu-copy',
      wEngineDetails: { id: null, name: null, level: null, ascension: 2, refinement: null },
      skillLevels: { ...baseAgent.skillLevels, core: 7 },
    }
    const executionMember = member('agent-remielle', null)
    executionMember.current = { wEngineCopyId: 'menu-copy', discIds: discs.map((disc) => disc.id) }
    const view = createTeamExecutionAttributePanel({
      agent,
      member: executionMember,
      discs,
      wEngines: [
        {
          copyId: 'menu-copy',
          engineId: 'wengine-14158',
          level: 60,
          refinement: 1,
          equippedAgentId: 'agent-remielle',
          manualSource: 'manual_override',
        },
      ],
    })
    expect(view.rows.find((row) => row.label === '攻击力')?.outOfCombat).toBe('2487')
  })
})
