import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SodaDatabase } from '../db/database'
import { gameBase30Formal, gameBase32Current } from './baseline'
import { createManifest, gameDataPackageManifestSchema } from './types'
import { isCompatibleManifestContent } from './manifestContentCompatibility'
import releasedManifest from './releasedGameBase32Manifest.test.json'
import {
  currentGameDataRuntimeSelectionContract,
  readCurrentGameDataRuntimeSelection,
} from './runtimeSelection'

// Future image-cache updates must not change the released game-data identity.
vi.mock('../assets/visualAssets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets/visualAssets')>()
  return {
    ...actual,
    visualAssetManifest: { ...actual.visualAssetManifest, packVersion: 'zzz-visual-assets-3.1.99' },
  }
})

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
  it('the historical manifest differs only by the reviewed name and propagated metadata digests', () => {
    const released = gameDataPackageManifestSchema.parse(releasedManifest)
    const relabeled = createManifest({
      ...released,
      sources: released.sources.map((source) => ({
        ...source,
        contentHash:
          source.label === 'current-version-adoption-3.2-phase-ii-r1'
            ? 'fnv1a-cb8972d7'
            : source.contentHash,
      })),
      coverage: released.coverage.map((entry) => ({
        ...entry,
        displayName: entry.stableId === 'set-34200' ? '荆棘玫瑰' : entry.displayName,
        sourceContentHash:
          entry.sourceContentHash === 'fnv1a-54fa1e79' ? 'fnv1a-53ed77d5' : entry.sourceContentHash,
      })),
      changesFromPreviousFormal: released.changesFromPreviousFormal.map((text) =>
        text
          .replaceAll('fnv1a-54fa1e79', 'fnv1a-53ed77d5')
          .replaceAll('fnv1a-34a56a5d', 'fnv1a-cb8972d7'),
      ),
    })
    expect(relabeled).toEqual(gameBase32Current)
  })
  it('does not extend historical compatibility to unknown stored or future compiled content', () => {
    for (const stored of ['fnv1a-142ef3e7', 'fnv1a-fd1d9bb8', 'fnv1a-55673acf']) {
      expect(isCompatibleManifestContent(stored, 'fnv1a-39f991e1')).toBe(true)
      expect(isCompatibleManifestContent(stored, 'fnv1a-future')).toBe(false)
    }
    expect(isCompatibleManifestContent('fnv1a-unknown', 'fnv1a-39f991e1')).toBe(false)
  })

  it.each(['source-labels', 'avatar-cache', 'corrected-source-labels'] as const)(
    'opens the released %s 3.2 manifest without rewriting stored data',
    async (release) => {
      const db = createDatabase()
      expect(gameBase32Current.contentHash).toBe('fnv1a-39f991e1')
      const released = createManifest(gameDataPackageManifestSchema.parse(releasedManifest))
      expect(released.contentHash).toBe('fnv1a-55673acf')
      const previous =
        release === 'avatar-cache'
          ? createManifest(
              JSON.parse(
                JSON.stringify(released)
                  .replaceAll('zzz-visual-assets-3.1.12', 'zzz-visual-assets-3.1.13')
                  .replaceAll('fnv1a-54fa1e79', 'fnv1a-c6b535be')
                  .replaceAll('fnv1a-34a56a5d', 'fnv1a-24c243a0'),
              ),
            )
          : release === 'corrected-source-labels'
            ? released
            : createManifest({
                ...released,
                sources: released.sources.map((source) => ({
                  ...source,
                  verification:
                    source.verification === 'community_reference' ||
                    source.verification === 'derived_reference'
                      ? 'official_reference'
                      : source.verification,
                })),
              })
      // Literal identities of released 719fd5b6 / 3c886248, not generated expectations.
      // The latter changed only image-version provenance and its propagated hashes.
      expect(previous.contentHash).toBe(
        release === 'avatar-cache'
          ? 'fnv1a-fd1d9bb8'
          : release === 'corrected-source-labels'
            ? 'fnv1a-55673acf'
            : 'fnv1a-142ef3e7',
      )
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
    },
  )

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
