import { describe, expect, it } from 'vitest'
import type {
  AccountRoster,
  ObservedAgentFacts,
  ObservedAgentField,
  RosterAgent,
} from '../assault/types'
import { createEmptyRoster, hydrateRosterDefaults } from './rosterHydration'
import { rosterAgentRarity } from './rosterFacts'
import { hasObservedAgentField, normalizeObservedAgentFacts } from './observedAgentFacts'
import { createRosterSnapshotAdapter, rosterSnapshotSchema } from './rosterSnapshotCore'
import { restoreBackupRoster } from './restoreBackupRoster'
import { normalizeWEngineInstances } from './publicWEngineInstances'

const now = '2026-10-10T00:00:00.000Z'
const marker = { capturedAt: now, snapshotSha256: 'a'.repeat(64) }
function observations(...fields: ObservedAgentField[]): ObservedAgentFacts {
  return {
    schemaVersion: 1,
    source: 'asset_quick_read',
    protocolVersion: '3.2',
    fields: Object.fromEntries(fields.map((field) => [field, { ...marker }])),
  }
}
function syntheticAgent(change: Partial<RosterAgent> = {}): RosterAgent {
  const base = createEmptyRoster(now).agents.find(
    (agent) => rosterAgentRarity(agent.agentId) === 'A',
  )!
  return {
    ...base,
    owned: true,
    mindscape: 1,
    skillLevels: { basic: 2, dodge: 3, assist: 4, special: 5, chain: 6, core: 2 },
    ...change,
  }
}
function rosterWith(agent: RosterAgent): AccountRoster {
  const roster = createEmptyRoster(now)
  return {
    ...roster,
    agents: roster.agents.map((existing) =>
      existing.agentId === agent.agentId ? agent : existing,
    ),
  }
}
function reload(agent: RosterAgent) {
  const roster = hydrateRosterDefaults(JSON.parse(JSON.stringify(rosterWith(agent))), now)
  return roster.agents.find((entry) => entry.agentId === agent.agentId)!
}
const progressionFields: ObservedAgentField[] = [
  'mindscape',
  'skillLevels.basic',
  'skillLevels.dodge',
  'skillLevels.assist',
  'skillLevels.special',
  'skillLevels.chain',
  'skillLevels.core',
]
const adapter = createRosterSnapshotAdapter({
  agentIds: new Set(createEmptyRoster(now).agents.map((agent) => agent.agentId)),
  bangbooIds: new Set(),
  normalizeWEngineInstances,
})

describe('confirmed per-field observations', () => {
  it.each([1, 6])(
    'retains A-rank M%i with distinct observed skills across save-like refreshes',
    (mindscape) => {
      const original = syntheticAgent({
        source: 'asset_quick_read',
        mindscape,
        observedFacts: observations(...progressionFields),
        skillLevels: { basic: 4, dodge: 7, assist: 8, special: 10, chain: 9, core: 7 },
      })
      let current = original
      for (let i = 0; i < 3; i++) current = reload(current)
      expect(current.mindscape).toBe(mindscape)
      expect(current.skillLevels).toEqual(original.skillLevels)
      expect(current.observedFacts).toEqual(original.observedFacts)
      expect(current.manualSource).toBeNull()
    },
  )

  it('protects only one observed skill while filling the remaining baseline', () => {
    const current = reload(syntheticAgent({ observedFacts: observations('skillLevels.basic') }))
    expect(current.mindscape).toBe(6)
    expect(current.skillLevels).toEqual({
      basic: 2,
      dodge: 15,
      assist: 15,
      special: 15,
      chain: 15,
      core: 7,
    })
  })

  it('uses observed mindscape for unobserved skill defaults', () => {
    const current = reload(syntheticAgent({ observedFacts: observations('mindscape') }))
    expect(current.mindscape).toBe(1)
    expect(current.skillLevels).toEqual({
      basic: 11,
      dodge: 11,
      assist: 11,
      special: 11,
      chain: 11,
      core: 7,
    })
  })

  it('never repairs the observed part of a legacy split-skill fingerprint', () => {
    const current = reload(
      syntheticAgent({
        owned: false,
        mindscape: 5,
        observedFacts: observations('skillLevels.special'),
        skillLevels: { basic: 13, dodge: 13, assist: 13, special: 11, chain: 11, core: 3 },
      }),
    )
    expect(current.skillLevels.special).toBe(11)
    expect(current.skillLevels.chain).toBe(15)
  })

  it.each([{ progressionManuallySet: true }, { manualSource: 'manual_override' as const }])(
    'preserves deliberate manual progression %j over defaults',
    (manual) => {
      const agent = syntheticAgent({
        ...manual,
        observedFacts: observations(...progressionFields),
        mindscape: 2,
      })
      const current = reload(agent)
      expect(current.mindscape).toBe(2)
      expect(current.skillLevels).toEqual(agent.skillLevels)
    },
  )

  it('respects individual and group manual locks', () => {
    const current = reload(
      syntheticAgent({ lockedFields: ['mindscape', 'skillLevels.basic', 'skillLevels.core'] }),
    )
    expect(current.mindscape).toBe(1)
    expect(current.skillLevels.basic).toBe(2)
    expect(current.skillLevels.core).toBe(2)
    expect(current.skillLevels.dodge).toBe(11)
    const all = syntheticAgent({ lockedFields: ['skillLevels'] })
    expect(reload(all).skillLevels).toEqual(all.skillLevels)
  })

  it('preserves manually edited fingerprint-like skills after observations, while retaining the old legacy repair', () => {
    const agent = syntheticAgent({
      manualSource: 'manual_override',
      mindscape: 6,
      skillLevels: { basic: 15, dodge: 15, assist: 15, special: 14, chain: 14, core: 7 },
    })
    expect(reload(agent).skillLevels.special).toBe(15)
    expect(reload({ ...agent, observedFacts: observations('level') }).skillLevels).toEqual(
      agent.skillLevels,
    )
  })

  it('keeps legacy owned-A defaults when metadata is absent or only source is supplied', () => {
    for (const source of ['manual', 'asset_quick_read'] as const) {
      const current = reload(syntheticAgent({ source }))
      expect(current.mindscape).toBe(6)
      expect(current.skillLevels).toEqual({
        basic: 15,
        dodge: 15,
        assist: 15,
        special: 15,
        chain: 15,
        core: 7,
      })
    }
  })

  it('discards unknown fields and malformed markers without elevating empty facts', () => {
    const normalized = normalizeObservedAgentFacts({
      ...observations('mindscape'),
      fields: {
        mindscape: marker,
        'skillLevels.basic': { ...marker, snapshotSha256: 'invalid' },
        level: { ...marker, capturedAt: 'not-a-date' },
        unknown: marker,
      },
    })
    expect(normalized).toEqual(observations('mindscape'))
    expect(
      normalizeObservedAgentFacts({ ...observations('mindscape'), protocolVersion: '3.1' }),
    ).toBeUndefined()
    expect(normalizeObservedAgentFacts(observations())).toBeUndefined()
    const agent = syntheticAgent({
      observedFacts: observations('skillLevels.basic', 'wEngineDetails.id', 'equippedDiscIds'),
      skillLevels: {
        basic: null,
        dodge: null,
        assist: null,
        special: null,
        chain: null,
        core: null,
      },
    })
    expect(hasObservedAgentField(agent, 'skillLevels.basic')).toBe(false)
    expect(hasObservedAgentField(agent, 'wEngineDetails.id')).toBe(false)
    expect(hasObservedAgentField(agent, 'equippedDiscIds')).toBe(false)
    expect(reload(agent).skillLevels.basic).toBe(15)
  })

  it('preserves values, source and markers through export, schema parse, real backup restore and refresh', () => {
    const agent = syntheticAgent({
      source: 'asset_quick_read',
      level: 40,
      ascension: 3,
      observedFacts: observations(
        ...progressionFields,
        'owned',
        'level',
        'ascension',
        'wEngineDetails.id',
        'wEngineDetails.name',
        'wEngineDetails.level',
        'wEngineDetails.ascension',
        'wEngineDetails.refinement',
        'equippedDiscIds',
      ),
      wEngineDetails: {
        id: 'synthetic-engine',
        name: '合成音擎',
        level: 40,
        ascension: 3,
        refinement: 1,
      },
      equippedDiscIds: ['synthetic-disc'],
    })
    const snapshot = rosterSnapshotSchema.parse(
      JSON.parse(JSON.stringify(adapter.exportRosterSnapshot(rosterWith(agent)))),
    )
    const restored = restoreBackupRoster(snapshot, createEmptyRoster(now))
    const current = hydrateRosterDefaults(restored, now).agents.find(
      (entry) => entry.agentId === agent.agentId,
    )!
    expect(current.source).toBe('asset_quick_read')
    expect(current.observedFacts).toEqual(agent.observedFacts)
    expect(current.mindscape).toBe(agent.mindscape)
    expect(current.skillLevels).toEqual(agent.skillLevels)
    expect(current.level).toBe(40)
    expect(current.ascension).toBe(3)
    expect(current.wEngineDetails).toEqual(agent.wEngineDetails)
    expect(current.equippedDiscIds).toEqual(agent.equippedDiscIds)
    expect(restored.wEngines).toEqual([])
    expect(restored.bangboos).toEqual(createEmptyRoster(now).bangboos)
  })

  it('restores old backups without requiring observations or introducing priority', () => {
    const old = adapter.exportRosterSnapshot(rosterWith(syntheticAgent()))
    for (const agent of old.agents) {
      delete agent.observedFacts
      delete agent.source
    }
    const parsed = rosterSnapshotSchema.parse(JSON.parse(JSON.stringify(old)))
    const restored = restoreBackupRoster(parsed, createEmptyRoster(now))
    const current = hydrateRosterDefaults(restored, now).agents.find(
      (entry) => entry.agentId === old.agents[0].agentId,
    )!
    expect(current.observedFacts).toBeUndefined()
    expect(current.mindscape).toBe(6)
    expect(current.skillLevels.basic).toBe(15)
  })

  it('snapshot parsing strips invalid markers and unknown fields without rejecting legacy values', () => {
    const snapshot = adapter.exportRosterSnapshot(rosterWith(syntheticAgent()))
    const input = JSON.parse(JSON.stringify(snapshot))
    input.agents[0].observedFacts = {
      ...observations('mindscape'),
      fields: {
        mindscape: marker,
        'skillLevels.basic': { ...marker, snapshotSha256: 'bad' },
        unknown: marker,
      },
    }
    const parsed = rosterSnapshotSchema.parse(input)
    expect(parsed.agents[0].observedFacts).toEqual(observations('mindscape'))
  })

  it('invalidates an owned marker when a complete generic snapshot makes that agent absent', () => {
    const agent = syntheticAgent({ observedFacts: observations('owned', 'mindscape') })
    const snapshot = rosterSnapshotSchema.parse(adapter.exportRosterSnapshot(rosterWith(agent)))
    snapshot.agents = snapshot.agents.filter((entry) => entry.agentId !== agent.agentId)
    const restored = adapter
      .applyRosterSnapshot(snapshot, rosterWith(agent))
      .agents.find((entry) => entry.agentId === agent.agentId)!
    expect(restored.owned).toBe(false)
    expect(restored.observedFacts?.fields.owned).toBeUndefined()
    expect(restored.observedFacts?.fields.mindscape).toEqual(marker)
  })

  it('keeps generic merge source policy and does not attach markers to rejected equipment', () => {
    const existing = syntheticAgent({
      observedFacts: observations('level'),
      wEngineDetails: { id: 'old-engine', name: '旧装备', level: 50, refinement: 2 },
    })
    const incoming = syntheticAgent({
      source: 'asset_quick_read',
      level: 30,
      observedFacts: observations('wEngineDetails.id', 'skillLevels.basic'),
      wEngineDetails: { id: 'new-engine', name: '新装备', level: 40, refinement: 1 },
    })
    const snapshot = rosterSnapshotSchema.parse(adapter.exportRosterSnapshot(rosterWith(incoming)))
    const result = adapter
      .applyRosterSnapshot(snapshot, rosterWith(existing))
      .agents.find((agent) => agent.agentId === existing.agentId)!
    expect(result.source).toBe('roster_snapshot')
    expect(result.wEngineDetails.id).toBe('old-engine')
    expect(result.observedFacts?.fields['wEngineDetails.id']).toBeUndefined()
    expect(result.observedFacts?.fields.level).toBeUndefined()
    expect(result.observedFacts?.fields['skillLevels.basic']).toEqual(marker)
  })
})
