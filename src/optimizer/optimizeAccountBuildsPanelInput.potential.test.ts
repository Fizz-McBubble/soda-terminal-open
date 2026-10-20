import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import { convertAssetSnapshot } from '../assetQuickRead/snapshotAdapter'
import {
  present,
  syntheticAssetSnapshot,
} from '../assetQuickRead/syntheticAssetSnapshotTestFixture'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import { projectOutOfCombatMenuPanel } from '../calculation/outOfCombatPanel'
import { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'

const discs: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `synthetic-potential-panel-${slot}`,
  slot: slot as DriveDisc['slot'],
  setId: 'set-swing-jazz',
  rarity: 'S',
  level: 15,
  mainStat: (
    ['hp_flat', 'atk_flat', 'def_flat', 'atk_percent', 'pen_ratio', 'energy_regen'] as const
  )[slot - 1],
  subStats: [],
  locked: false,
  favorite: false,
  tags: [],
  createdAt: '2026-10-10T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
  dataVersion: 'synthetic',
}))

describe('observed potential and shared panel inputs', () => {
  it('carries the exact Rina P5 observation to current, saved and trial display projections', () => {
    const raw = syntheticAssetSnapshot()
    raw.assets.agents[0].catalog_id = present(1211)
    Object.assign(raw.assets.agents[0], { potential_detail_id: present(121104) })
    const converted = convertAssetSnapshot(raw, { snapshotSha256: 'a'.repeat(64) })
    expect(converted.importable).toBe(true)
    const agent = {
      ...createEmptyRoster().agents.find((row) => row.agentId === 'agent-rina')!,
      ...converted.agents[0].fields,
      level: 60,
      ascension: 5,
      skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
      wEngineDetails: { id: 'wengine-13001', name: null, level: 60, ascension: 5, refinement: 1 },
      equippedDiscIds: discs.map((disc) => disc.id),
    }
    expect(agent.potentialImage).toBe(5)
    const direct = projectOutOfCombatMenuPanel({
      agentId: agent.agentId,
      level: 60,
      ascension: 5,
      core: 5,
      mindscape: agent.mindscape,
      potentialImage: agent.potentialImage,
      wEngine: { id: 'wengine-13001', level: 60, ascension: 5, refinement: 1 },
      discs,
    })
    expect(direct.status).toBe('ok')
    expect(direct.values.penRatio).toBeCloseTo(38.4, 9)
    for (const selection of [
      {},
      { planDiscIds: agent.equippedDiscIds },
      { candidateDiscIds: agent.equippedDiscIds },
    ]) {
      expect(
        createAgentDevelopmentPanelProjection({ agent, discs, ...selection }).result.values,
      ).toEqual(direct.values)
    }
    // Exact progression may feed declared fixed events; it does not invent a
    // panel threshold or an active event policy for this character.
    expect(candidatePanelInputForAgent(agent)).toMatchObject({ potentialImage: 5, core: 5 })
  })

  it.each([0, 5, undefined])(
    'uses the same maintained potential %s for eligible optimizer and display inputs',
    (potentialImage) => {
      const agent = createEmptyRoster().agents.find((row) => row.agentId === 'agent-astra')!
      Object.assign(agent, {
        level: 60,
        ascension: 5,
        potentialImage,
        equippedDiscIds: discs.map((disc) => disc.id),
      })
      agent.skillLevels.core = 7
      agent.wEngineDetails = {
        id: 'wengine-14102',
        name: null,
        level: 60,
        ascension: 5,
        refinement: 1,
      }
      const candidate = candidatePanelInputForAgent(agent)
      expect(candidate).toBeDefined()
      expect(candidate?.potentialImage).toBe(potentialImage)
      const calculated = projectOutOfCombatMenuPanel({ ...candidate!, discs })
      expect(calculated.status).toBe('ok')
      expect(createAgentDevelopmentPanelProjection({ agent, discs }).result.values).toEqual(
        calculated.values,
      )
    },
  )
})
