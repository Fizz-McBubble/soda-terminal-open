import Dexie from 'dexie'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SodaDatabase } from '../db/databaseCore'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import {
  accountId,
  agentId,
  candidate,
  createQuickReadTestDatabase,
  now,
} from './accountImport.fixtures'
import type { AssetQuickReadCandidate } from './snapshotAdapter'

type SnapshotFacts = {
  level: number
  engineLevel: number
  engineRefinement: number
  owner: 'nicole' | 'koleda'
}

function sameTimestampCandidate(
  hash: string,
  capturedAt: string,
  facts: SnapshotFacts,
): AssetQuickReadCandidate {
  const input = candidate()
  input.capturedAt = capturedAt
  input.snapshotSha256 = hash.repeat(64)
  input.discs.source.capturedAt = capturedAt

  const nicole = input.agents[0]
  nicole.fields.level = facts.level
  nicole.fields.wEngineDetails = {
    id: 'wengine-13001',
    name: '聚宝箱',
    level: facts.engineLevel,
    ascension: 1,
    refinement: facts.engineRefinement,
  }
  nicole.observedFields = [
    ...new Set([
      ...nicole.observedFields,
      'wEngineDetails.level' as const,
      'wEngineDetails.ascension' as const,
    ]),
  ]

  const koleda = structuredClone(nicole)
  koleda.agentId = 'agent-koleda'
  koleda.name = '可琳'
  const sourceId = input.discs.discs[0].sourceId!
  if (facts.owner === 'nicole') {
    nicole.equippedSourceIds = [sourceId]
    koleda.equippedSourceIds = []
  } else {
    nicole.equippedSourceIds = []
    koleda.equippedSourceIds = [sourceId]
  }
  input.agents = [nicole, koleda]
  input.counts.agents = 2
  input.counts.importableAgents = 2
  return input
}

describe('asset quick read same-timestamp snapshot ordering', () => {
  let db: SodaDatabase

  beforeEach(async () => {
    db = await createQuickReadTestDatabase()
  })

  afterEach(async () => {
    db.close()
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  })

  async function apply(input: AssetQuickReadCandidate) {
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    return confirmAssetQuickReadImport(
      input,
      plan,
      {
        accountId,
        snapshotSha256: input.snapshotSha256,
        sameGameAccountAndCounts: true,
      },
      db,
    )
  }

  async function agents() {
    const roster = (await db.accountRosters.get(accountId))!.roster
    return {
      nicole: roster.agents.find((agent) => agent.agentId === agentId)!,
      koleda: roster.agents.find((agent) => agent.agentId === 'agent-koleda')!,
    }
  }

  it('keeps the first imported facts on a same-second SHA conflict without guessing order', async () => {
    const first = sameTimestampCandidate('b', now, {
      level: 60,
      engineLevel: 50,
      engineRefinement: 4,
      owner: 'nicole',
    })
    const conflicting = sameTimestampCandidate('a', now, {
      level: 20,
      engineLevel: 20,
      engineRefinement: 1,
      owner: 'koleda',
    })

    await apply(first)
    const imported = await agents()
    const nicoleDiscs = [...imported.nicole.equippedDiscIds!]
    const koledaDiscs = [...imported.koleda.equippedDiscIds!]

    await apply(conflicting)
    const retained = await agents()
    expect(retained.nicole.level).toBe(60)
    expect(retained.nicole.wEngineDetails).toMatchObject({
      id: 'wengine-13001',
      level: 50,
      refinement: 4,
    })
    expect(retained.nicole.equippedDiscIds).toEqual(nicoleDiscs)
    expect(retained.koleda.equippedDiscIds).toEqual(koledaDiscs)
    for (const field of [
      'level',
      'wEngineDetails.id',
      'wEngineDetails.name',
      'wEngineDetails.level',
      'wEngineDetails.ascension',
      'wEngineDetails.refinement',
      'equippedDiscIds',
    ] as const)
      expect(retained.nicole.observedFacts?.fields[field]).toMatchObject({
        capturedAt: now,
        snapshotSha256: first.snapshotSha256,
      })
  })

  it('continues to protect a genuinely earlier snapshot', async () => {
    const first = sameTimestampCandidate('d', now, {
      level: 60,
      engineLevel: 50,
      engineRefinement: 4,
      owner: 'nicole',
    })
    const earlier = sameTimestampCandidate('c', '2026-10-09T23:59:59.000Z', {
      level: 20,
      engineLevel: 20,
      engineRefinement: 1,
      owner: 'koleda',
    })

    await apply(first)
    await apply(earlier)
    const retained = await agents()
    expect(retained.nicole.level).toBe(60)
    expect(retained.nicole.equippedDiscIds).toEqual(['asset-disc-880001'])
    expect(retained.koleda.equippedDiscIds).toEqual([])
  })

  it('allows the same SHA to be replayed after a valid restore', async () => {
    const input = sameTimestampCandidate('e', now, {
      level: 60,
      engineLevel: 50,
      engineRefinement: 4,
      owner: 'nicole',
    })
    const receipt = await apply(input)
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )

    await expect(apply(input)).resolves.toMatchObject({ accountId })
    const replayed = await agents()
    expect(replayed.nicole.level).toBe(60)
    expect(replayed.nicole.wEngineDetails.level).toBe(50)
    expect(replayed.nicole.equippedDiscIds).toEqual(['asset-disc-880001'])
  })

  it('still accepts a genuinely newer snapshot', async () => {
    const first = sameTimestampCandidate('f', now, {
      level: 20,
      engineLevel: 20,
      engineRefinement: 1,
      owner: 'koleda',
    })
    const newer = sameTimestampCandidate('f', '2026-10-10T00:00:01.000Z', {
      level: 60,
      engineLevel: 50,
      engineRefinement: 4,
      owner: 'nicole',
    })
    newer.snapshotSha256 = '1'.repeat(64)

    await apply(first)
    await apply(newer)
    const current = await agents()
    expect(current.nicole.level).toBe(60)
    expect(current.nicole.wEngineDetails.level).toBe(50)
    expect(current.nicole.equippedDiscIds).toEqual(['asset-disc-880001'])
    expect(current.koleda.equippedDiscIds).toEqual([])
  })
})
