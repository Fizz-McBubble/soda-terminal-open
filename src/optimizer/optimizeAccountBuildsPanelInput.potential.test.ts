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
import {
  candidatePanelInputForAgent,
  candidatePanelInputForSchemeAgent,
  type CandidateSchemeAgentPlanningState,
} from './optimizeAccountBuildsPanelInput'
import { candidatePanelInputsForScheme } from './optimizeAccountBuilds'
import { buildIntentFingerprintMatches, compileTeamBuildIntent } from '../decision/buildIntent'

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
      if (!candidate || candidate.mindscape == null)
        throw new Error('fixture requires a known mindscape')
      const calculated = projectOutOfCombatMenuPanel({
        ...candidate,
        mindscape: candidate.mindscape,
        discs,
      })
      expect(calculated.status).toBe('ok')
      expect(createAgentDevelopmentPanelProjection({ agent, discs }).result.values).toEqual(
        calculated.values,
      )
    },
  )

  it('uses one explicit planning state for scheme panels and preserves P0', () => {
    const agent = createEmptyRoster().agents.find((row) => row.agentId === 'agent-astra')!
    agent.level = 60
    agent.ascension = 5
    agent.skillLevels.core = 7
    agent.potentialImage = 5
    agent.wEngineDetails = {
      id: 'wengine-14102',
      name: null,
      level: 60,
      ascension: 5,
      refinement: 1,
    }
    const engine = { engineId: 'wengine-14102', refinement: 1, level: 60, ascension: 5 }
    const p0 = candidatePanelInputForSchemeAgent(agent, engine, { potentialImage: 0 })
    const p6 = candidatePanelInputForSchemeAgent(agent, engine, { potentialImage: 6 })
    expect(p0?.potentialImage).toBe(0)
    expect(p6?.potentialImage).toBe(6)
    expect(agent.potentialImage).toBe(5)
  })

  it('preserves an explicit unknown mindscape instead of substituting the account state', () => {
    const agent = createEmptyRoster().agents.find((row) => row.agentId === 'agent-nangong')!
    agent.level = 60
    agent.ascension = 5
    agent.skillLevels.core = 7
    agent.mindscape = 2
    agent.wEngineDetails = {
      id: 'wengine-14102',
      name: null,
      level: 60,
      ascension: 5,
      refinement: 1,
    }
    const input = candidatePanelInputForSchemeAgent(
      agent,
      { engineId: 'wengine-14102', refinement: 1, level: 60, ascension: 5 },
      { mindscape: null, potentialImage: 0 },
    )
    expect(input).toMatchObject({ mindscape: null, potentialImage: 0 })
    expect(agent.mindscape).toBe(2)
  })

  it('fingerprints one effective planning state across P0 and P6 panel/branch inputs', () => {
    const memberIds = ['agent-zhao', 'agent-astra', 'agent-pan-yinhu'] as const
    const agents = memberIds.map((agentId) => {
      const agent = createEmptyRoster().agents.find((row) => row.agentId === agentId)!
      agent.level = 60
      agent.ascension = 5
      agent.skillLevels.core = 7
      agent.wEngineDetails = {
        id: 'wengine-14102',
        name: null,
        level: 60,
        ascension: 5,
        refinement: 1,
      }
      return agent
    })
    agents[0]!.potentialImage = 5
    const engines = memberIds.map((agentId) => ({
      agentId,
      engineId: 'wengine-14102',
      refinement: 1,
      level: 60,
      ascension: 5,
    }))
    const compile = (agentState: CandidateSchemeAgentPlanningState) =>
      compileTeamBuildIntent({
        candidateId: 'planning-potential-single-variable',
        memberIds,
        bangbooId: 'bangboo-avocaboo',
        agentStateById: { 'agent-zhao': agentState },
        optimizerOptions: {
          panelInputsByAgent: candidatePanelInputsForScheme(agents, memberIds, engines, {
            'agent-zhao': agentState,
          }),
        },
      })
    const p0 = compile({ potentialImage: 0 })
    const p6 = compile({ potentialImage: 6 })
    const unknownMindscape = compile({ mindscape: null, potentialImage: 0 })
    expect(p0.constraints.panelInputsByAgent?.['agent-zhao']?.potentialImage).toBe(0)
    expect(p6.constraints.panelInputsByAgent?.['agent-zhao']?.potentialImage).toBe(6)
    expect(unknownMindscape.constraints.panelInputsByAgent?.['agent-zhao']?.mindscape).toBeNull()
    expect(p0.fingerprint).not.toBe(p6.fingerprint)
    expect(buildIntentFingerprintMatches(JSON.parse(JSON.stringify(p0)))).toBe(true)
    expect(buildIntentFingerprintMatches(JSON.parse(JSON.stringify(p6)))).toBe(true)
    expect(buildIntentFingerprintMatches(JSON.parse(JSON.stringify(unknownMindscape)))).toBe(true)
    expect(agents[0]!.potentialImage).toBe(5)
  })
})
