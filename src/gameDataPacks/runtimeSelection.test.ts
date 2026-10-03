import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { SodaDatabase } from '../db/database'
import { gameBase30Formal, gameBase32Current } from './baseline'
import { createManifest } from './types'
import {
  currentGameDataRuntimeSelectionContract,
  readCurrentGameDataRuntimeSelection,
} from './runtimeSelection'

const names: string[] = []

function createDatabase() {
  const name = `soda-runtime-selection-${crypto.randomUUID()}`
  names.push(name)
  return new SodaDatabase(name)
}

afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

describe('current game-data runtime selection', () => {
  it('opens the known pre-correction 3.2 manifest without rewriting stored data', async () => {
    const db = createDatabase()
    const previous = createManifest({
      ...gameBase32Current,
      sources: gameBase32Current.sources.map((source) => ({
        ...source,
        verification:
          source.verification === 'community_reference' ||
          source.verification === 'derived_reference'
            ? 'official_reference'
            : source.verification,
      })),
    })
    // Literal identity of the released 719fd5b6 manifest, not a new generated expectation.
    expect(previous.contentHash).toBe('fnv1a-142ef3e7')
    await db.gameDataPacks.put(previous)
    await db.gameDataPackState.put({
      id: 'active-game-data-packs',
      activeFormalByKind: { 'game-base': previous.id },
      expiredCalculationPackageIds: [],
      updatedAt: '2026-10-03T00:00:00.000Z',
    })
    const before = await Promise.all(db.tables.map((table) => table.toArray()))
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'compiled_current',
      source: 'active_formal_package',
    })
    expect(await Promise.all(db.tables.map((table) => table.toArray()))).toEqual(before)

    await db.gameDataPacks.put({ ...previous, changesFromPreviousFormal: ['tampered'] })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_manifest_invalid',
    })
    await db.gameDataPacks.put(createManifest({ ...previous, migrationNotes: ['other content'] }))
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_package_not_compiled_artifact',
    })
    await db.gameDataPacks.put(previous)
    await db.gameDataPackState.update('active-game-data-packs', {
      expiredCalculationPackageIds: [previous.id],
    })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_package_expired',
    })
  })

  it('uses the compiled baseline only when no persisted selection exists, without writing', async () => {
    const db = createDatabase()
    await db.open()
    const before = await Promise.all([
      db.gameDataPacks.count(),
      db.gameDataPackState.count(),
      db.accounts.count(),
      db.accountDriveDiscs.count(),
    ])

    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      contract: currentGameDataRuntimeSelectionContract,
      status: 'compiled_current',
      source: 'implicit_compiled_baseline',
      packageId: gameBase32Current.id,
      packageVersion: gameBase32Current.packageVersion,
    })

    await expect(
      Promise.all([
        db.gameDataPacks.count(),
        db.gameDataPackState.count(),
        db.accounts.count(),
        db.accountDriveDiscs.count(),
      ]),
    ).resolves.toEqual(before)
  })

  it('accepts only the selected, valid compiled formal package and fails closed for all other states', async () => {
    const db = createDatabase()
    await db.open()
    await db.gameDataPacks.put(gameBase32Current)
    await db.gameDataPackState.put({
      id: 'active-game-data-packs',
      activeFormalByKind: { 'game-base': gameBase32Current.id },
      expiredCalculationPackageIds: [],
      updatedAt: '2026-09-06T00:00:00.000Z',
    })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'compiled_current',
      source: 'active_formal_package',
    })

    await db.gameDataPacks.put(gameBase30Formal)
    await db.gameDataPackState.update('active-game-data-packs', {
      activeFormalByKind: { 'game-base': gameBase30Formal.id },
    })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_package_not_compiled_artifact',
      packageId: gameBase30Formal.id,
    })

    await db.gameDataPacks.put({ ...gameBase32Current, contentHash: 'damaged' })
    await db.gameDataPackState.update('active-game-data-packs', {
      activeFormalByKind: { 'game-base': gameBase32Current.id },
    })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_manifest_invalid',
    })

    const sameVersionDifferentContent = createManifest({
      ...gameBase32Current,
      changesFromPreviousFormal: [...gameBase32Current.changesFromPreviousFormal, '隔离内容变化。'],
    })
    await db.gameDataPacks.put(sameVersionDifferentContent)
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_package_not_compiled_artifact',
      packageId: gameBase32Current.id,
    })

    await db.gameDataPacks.put(gameBase32Current)
    await db.gameDataPackState.update('active-game-data-packs', {
      expiredCalculationPackageIds: [gameBase32Current.id],
    })
    await expect(readCurrentGameDataRuntimeSelection(db)).resolves.toMatchObject({
      status: 'unbound',
      reason: 'active_package_expired',
    })
  })
})
