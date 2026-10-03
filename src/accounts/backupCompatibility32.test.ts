import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SodaDatabase } from '../db/databaseCore'
import type { AccountRoster } from '../assault/types'
import { createAccount, getAccountRoster, saveAccountRoster } from './repository'
import { createAccountBackup, preflightAccountBackup, restoreAccountBackup } from './backup'
import { createEmptyRoster, hydrateRosterDefaults } from './rosterHydration'
import { exportRosterSnapshot, rosterSnapshotSchema } from './publicRosterSnapshot'
import { createRosterSnapshotAdapter } from './rosterSnapshotCore'
import { restoreBackupRoster } from './restoreBackupRoster'
import { saveAccountPreference, getAccountPreference } from './accountPreferenceRepository'
import { getScopedId } from './types'
import { normalizeWEngineInstances } from './publicWEngineInstances'
import { applyAgentWEngineAssignment } from './wEngineAssignment'

const names: string[] = []
const now = '2026-09-30T00:00:00.000Z'
const actors = ['agent-claret', 'agent-roxy']
const engines = [
  'wengine-14161',
  'wengine-14162',
  'wengine-13021',
  'wengine-13017',
  'wengine-12016',
]
function db() {
  const name = `soda-compat32-synthetic-${crypto.randomUUID()}`
  names.push(name)
  return new SodaDatabase(name)
}
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})
function fixture(): AccountRoster {
  const r = createEmptyRoster(now),
    template = r.agents[0]!
  for (const [i, agentId] of actors.entries()) {
    const agent = {
      ...structuredClone(template),
      agentId,
      owned: true,
      manualSource: 'manual_override' as const,
      progressionManuallySet: true,
      level: 50,
      ascension: i + 3,
      mindscape: 2,
      potentialImage: 3,
      agentVersion: '3.2',
      skillLevels: { basic: 8, dodge: 7, assist: 6, special: 9, chain: 5, core: 4 },
      wEngineDetails: {
        id: engines[i]!,
        name: 'synthetic32',
        level: 50,
        ascension: i + 2,
        refinement: 2,
      },
      wEngineCopyId: `synthetic-copy-${i}`,
      lockedFields: ['ascension', 'wEngineDetails'],
      equippedDiscIds: null,
    }
    const index = r.agents.findIndex((a) => a.agentId === agentId)
    if (index < 0) r.agents.push(agent)
    else r.agents[index] = agent
  }
  r.wEngines = engines.map((engineId, i) => ({
    copyId: `synthetic-copy-${i}`,
    engineId,
    level: 50,
    refinement: 2,
    equippedAgentId: actors[i] ?? null,
    manualSource: 'manual_override',
    refinementManuallySet: true,
  }))
  return r
}
function facts(r: AccountRoster) {
  return actors.map((id) => {
    const a = r.agents.find((a) => a.agentId === id)!
    return {
      agentId: a.agentId,
      owned: a.owned,
      ascension: a.ascension,
      mindscape: a.mindscape,
      potentialImage: a.potentialImage,
      skillLevels: a.skillLevels,
      wEngineDetails: a.wEngineDetails,
      wEngineCopyId: a.wEngineCopyId,
      lockedFields: a.lockedFields,
    }
  })
}

describe('3.2 synthetic backup recovery compatibility', () => {
  it('an older equipment form preserves same-engine phase and explicit phase edits do not transfer to another engine', () => {
    const roster = fixture(),
      agentId = actors[0]!
    const params = {
      roster,
      agentId,
      agents: [{ stableId: agentId, playerName: '合成', specialty: 'armorer', rarity: 'S' }],
      wengines: engines.map((stableId) => ({
        stableId,
        playerName: '合成',
        specialty: 'armorer',
        rarity: 'S',
      })),
    }
    const draft = {
      wEngineCopyId: null,
      wEngineCatalogId: engines[0],
      wEngineLevel: 50,
      wEngineRefinement: 2,
    }
    expect(
      applyAgentWEngineAssignment({ ...params, draft }).agents.find((a) => a.agentId === agentId)!
        .wEngineDetails.ascension,
    ).toBe(2)
    expect(
      applyAgentWEngineAssignment({
        ...params,
        draft: { ...draft, wEngineAscension: 0 },
      }).agents.find((a) => a.agentId === agentId)!.wEngineDetails.ascension,
    ).toBe(0)
    expect(
      applyAgentWEngineAssignment({
        ...params,
        draft: { ...draft, wEngineAscension: null },
      }).agents.find((a) => a.agentId === agentId)!.wEngineDetails.ascension,
    ).toBeNull()
    expect(
      applyAgentWEngineAssignment({
        ...params,
        draft: { ...draft, wEngineCatalogId: engines[2] },
      }).agents.find((a) => a.agentId === agentId)!.wEngineDetails.ascension,
    ).toBeUndefined()
    expect(() =>
      applyAgentWEngineAssignment({ ...params, draft: { ...draft, wEngineAscension: 6 } }),
    ).toThrow('0–5')
  })
  it('retains explicit ascensions, new identities, five engine copies, potential and saved refs across save/backup/restore/hydration/save', async () => {
    const source = db(),
      target = db(),
      accountId = 'account-synthetic-compat32'
    await createAccount('合成兼容测试', source, { id: accountId, makeDefault: true })
    const roster = fixture()
    await saveAccountRoster(accountId, roster, source)
    const conditions = {
      schema: 'synthetic-conditions/v1',
      gameVersion: '3.2',
      agents: {
        'agent-claret': { potentialImage: 3, conditions: { Maim: true } },
        'agent-roxy': { conditions: { windExSpecialUsed: true } },
      },
      wEngines: Object.fromEntries(engines.map((id) => [id, { enabled: true }])),
    }
    await saveAccountPreference(accountId, 'synthetic-saved-condition-refs', conditions, source)
    const plan = {
      id: 'synthetic-stale-plan',
      accountId,
      scopedId: getScopedId(accountId, 'synthetic-stale-plan'),
      kind: 'agent' as const,
      name: '合成旧指纹方案',
      state: 'saved' as const,
      selection: { agentIds: actors, bangbooId: null, scenario: 'synthetic32' },
      manualOverrides: {
        wEngineDirection: engines.join(','),
        discDirection: '',
        progressionDirection: '',
        notes: 'source state deliberately stale',
      },
      knowledgeRefs: [
        {
          profileId: 'profile-claret32',
          status: 'candidate' as const,
          version: '3.2',
          source: 'synthetic-source',
        },
      ],
      warehouseRefs: [],
      comparisonCapability: 'direction' as const,
      solutionContext: {
        contract: 'soda-solution-context/v1' as const,
        scope: 'agent_independent' as const,
        resourcePolicy: 'advisory' as const,
        sourceCandidateId: 'candidate-claret32',
        inputFingerprint: 'deliberately-stale',
        solverMethod: 'synthetic',
        gameVersion: '3.1',
        knowledgeVersion: 'synthetic-old-source',
        exactVariantKey: null,
      },
      createdAt: now,
      updatedAt: now,
      revision: 1,
    }
    await source.accountPlanningDrafts.put(plan)
    const backup = await createAccountBackup(accountId, source)
    expect(backup.formatVersion).toBe(1)
    expect(backup.data.roster?.schemaVersion).toBe(3)
    expect(preflightAccountBackup(JSON.parse(JSON.stringify(backup))).success).toBe(true)
    await restoreAccountBackup(JSON.parse(JSON.stringify(backup)), target)
    const restored = await getAccountRoster(accountId, target)
    expect(facts(restored)).toEqual(facts(roster))
    expect(restored.wEngines).toEqual(roster.wEngines)
    expect(await getAccountPreference(accountId, 'synthetic-saved-condition-refs', target)).toEqual(
      conditions,
    )
    expect(await target.accountPlanningDrafts.get(plan.scopedId)).toEqual(plan)
    await saveAccountRoster(accountId, restored, target)
    const roundtrip = await createAccountBackup(accountId, target)
    expect(roundtrip.data.roster?.agents.filter((a) => actors.includes(a.agentId))).toEqual(
      backup.data.roster?.agents.filter((a) => actors.includes(a.agentId)),
    )
    expect(roundtrip.data.planningDrafts).toEqual(backup.data.planningDrafts)
  })

  it('old snapshots omit phases; explicit zero/null and engine phases survive while out-of-range phases reject without writing', async () => {
    const roster = fixture(),
      snapshot = exportRosterSnapshot(roster)
    const old = structuredClone(snapshot)
    for (const a of old.agents) {
      delete a.ascension
      if (a.wEngineDetails) delete a.wEngineDetails.ascension
    }
    const oldRestored = restoreBackupRoster(rosterSnapshotSchema.parse(old))
    for (const id of actors) {
      const a = oldRestored.agents.find((a) => a.agentId === id)!
      expect(a.ascension).toBeUndefined()
      expect(a.wEngineDetails.ascension).toBeUndefined()
    }
    for (const schemaVersion of [1, 2] as const) {
      const legacy = restoreBackupRoster(rosterSnapshotSchema.parse({ ...old, schemaVersion }))
      expect(legacy.agents.find((a) => a.agentId === actors[0])!.ascension).toBeUndefined()
    }
    roster.agents.find((a) => a.agentId === actors[0])!.ascension = 0
    roster.agents.find((a) => a.agentId === actors[1])!.ascension = null
    expect(
      facts(restoreBackupRoster(rosterSnapshotSchema.parse(exportRosterSnapshot(roster)))),
    ).toEqual(facts(roster))
    const target = db()
    await createAccount('合成范围校验', target, { id: 'account-range32', makeDefault: true })
    await saveAccountRoster('account-range32', roster, target)
    const before = await target.accountRosters.get('account-range32')
    for (const value of [-1, 6, 1.5, NaN])
      for (const field of ['agent', 'engine']) {
        const invalid = structuredClone(roster)
        if (field === 'agent') invalid.agents[0]!.ascension = value
        else invalid.agents[0]!.wEngineDetails.ascension = value
        expect(rosterSnapshotSchema.safeParse(exportRosterSnapshot(invalid)).success).toBe(false)
        await expect(saveAccountRoster('account-range32', invalid, target)).rejects.toThrow('0–5')
        expect(await target.accountRosters.get('account-range32')).toEqual(before)
      }
  })

  it('3.1 directory-only reader is unsafe; compatible recovery retains identities with capability catalogs absent', () => {
    const r = fixture(),
      snapshot = rosterSnapshotSchema.parse(exportRosterSnapshot(r))
    const legacyBase = {
      ...createEmptyRoster(now),
      agents: createEmptyRoster(now).agents.filter((a) => !actors.includes(a.agentId)),
    }
    const directoryOnlyReader = createRosterSnapshotAdapter({
      agentIds: new Set(legacyBase.agents.map((a) => a.agentId)),
      bangbooIds: new Set(legacyBase.bangboos.map((b) => b.bangbooId)),
      normalizeWEngineInstances,
    })
    expect(directoryOnlyReader.preflightRosterSnapshot(snapshot, legacyBase).unknownAgents).toEqual(
      actors,
    )
    const unsafe = directoryOnlyReader.applyRosterSnapshot(snapshot, legacyBase)
    expect(unsafe.agents.some((a) => actors.includes(a.agentId))).toBe(false)
    const recovered = restoreBackupRoster(snapshot, legacyBase)
    expect(facts(recovered)).toEqual(facts(r))
    expect(recovered.wEngines).toEqual(r.wEngines)
    expect(facts(hydrateRosterDefaults(recovered, now))).toEqual(facts(r))
  })

  it('unknown identities and null-id engine phase facts survive hydration instead of being filtered', () => {
    const r = fixture(),
      future = {
        ...structuredClone(r.agents[0]!),
        agentId: 'agent-synthetic-future',
        owned: true,
        level: 23,
        ascension: 2,
        potentialImage: 5,
        wEngineDetails: { id: null, name: null, level: null, ascension: 0, refinement: null },
      }
    r.agents.push(future)
    r.bangboos.push({
      bangbooId: 'bangboo-synthetic-future',
      owned: true,
      level: 23,
      stars: 3,
      skillLevel: 2,
      additionalAbilityLevel: 1,
      manualSource: null,
    })
    const hydrated = hydrateRosterDefaults(r, now)
    expect(hydrated.agents.find((a) => a.agentId === future.agentId)).toMatchObject({
      ascension: 2,
      potentialImage: 5,
      wEngineDetails: { ascension: 0 },
    })
    expect(hydrated.bangboos.find((b) => b.bangbooId === 'bangboo-synthetic-future')).toEqual(
      r.bangboos.at(-1),
    )
    const recovered = restoreBackupRoster(rosterSnapshotSchema.parse(exportRosterSnapshot(r)))
    expect(recovered.agents.find((a) => a.agentId === future.agentId)).toMatchObject({
      ascension: 2,
      potentialImage: 5,
      wEngineDetails: { ascension: 0 },
    })
  })
})
