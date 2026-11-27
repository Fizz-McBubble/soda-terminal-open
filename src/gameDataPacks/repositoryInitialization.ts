import { database, type SodaDatabase } from '../db/databaseCore'
import bundledProjection from './generated/bundledInitializationManifests.json'
import compiledCurrentGameBase from './generated/compiledRuntimeManifestIdentity.json'
import { type GameDataPackState, validateManifest } from './types'

export const stateId = 'active-game-data-packs' as const
const current31MigrationKey = 'game-data-pack-current-3.1-migrated'
const current32MigrationKey = 'game-data-pack-current-3.2-migrated'
const current33MigrationKey = 'game-data-pack-current-3.3-migrated'

// These releases share a package ID, including the catalog correction within current.3.
const current33ManifestRevisions = [
  ['3.3.0-current.2', 'fnv1a-bcc4d315'],
  ['3.3.0-current.3', 'fnv1a-b5d90f7b'],
  ['3.3.0-current.3', 'fnv1a-88528391'],
] as const

// These are exact generated manifest bytes from the same bundled source, not new data authority.
const bundledGameDataPacks = bundledProjection.packs.map((pack) => {
  const checked = validateManifest(pack)
  if (!checked.success) throw new Error('应用自带游戏资料校验未通过，无法初始化。')
  return checked.manifest
})
if (
  bundledGameDataPacks.length !== 7 ||
  new Set(bundledGameDataPacks.map((pack) => pack.id)).size !== 7
)
  throw new Error('应用自带游戏资料不完整，无法初始化。')
const required = (id: string, kind: string) => {
  const pack = bundledGameDataPacks.find((item) => item.id === id && item.kind === kind)
  if (!pack) throw new Error('应用自带游戏资料身份不匹配，无法初始化。')
  return pack
}
const gameBase31Current = required(bundledProjection.identities.gameBase31, 'game-base')
const gameBase32Current = required(bundledProjection.identities.gameBase32, 'game-base')
const buildKnowledge30Formal = required(
  bundledProjection.identities.buildKnowledge,
  'build-knowledge',
)
const rotation30Formal = required(bundledProjection.identities.rotation, 'rotation')
const visualCatalog30Formal = required(bundledProjection.identities.visualCatalog, 'visual-catalog')
const current = required(compiledCurrentGameBase.id, compiledCurrentGameBase.kind)
if (
  current.packageVersion !== compiledCurrentGameBase.packageVersion ||
  current.gameVersion !== compiledCurrentGameBase.gameVersion ||
  current.contentHash !== compiledCurrentGameBase.contentHash ||
  current.rollbackTo !== compiledCurrentGameBase.rollbackTo
)
  throw new Error('应用自带游戏资料身份不匹配，无法初始化。')

const current33Revision = current33ManifestRevisions.findIndex(
  ([version, hash]) => current.packageVersion === version && current.contentHash === hash,
)
const current33Predecessors = current33ManifestRevisions.slice(0, Math.max(0, current33Revision))

export function initialState(now = new Date().toISOString()): GameDataPackState {
  return {
    id: stateId,
    activeFormalByKind: {
      'game-base': compiledCurrentGameBase.id,
      'build-knowledge': buildKnowledge30Formal.id,
      rotation: rotation30Formal.id,
      'visual-catalog': visualCatalog30Formal.id,
    },
    expiredCalculationPackageIds: [],
    updatedAt: now,
  }
}

export async function ensureBundledGameDataPacks(db: SodaDatabase = database) {
  await db.transaction('rw', db.gameDataPacks, db.gameDataPackState, db.settings, async () => {
    const state = await db.gameDataPackState.get(stateId)
    for (const pack of bundledGameDataPacks) {
      const existing = await db.gameDataPacks.get(pack.id)
      if (!existing) await db.gameDataPacks.add(pack)
      // Upgrade only a validated, selected release in this package's known lineage.
      if (
        pack.id === current.id &&
        state?.activeFormalByKind['game-base'] === pack.id &&
        !state.expiredCalculationPackageIds.includes(pack.id) &&
        existing?.id === pack.id &&
        current33Predecessors.some(
          ([version, hash]) => existing.packageVersion === version && existing.contentHash === hash,
        ) &&
        validateManifest(existing).success
      )
        await db.gameDataPacks.put(pack)
    }
    if (!state) {
      await db.gameDataPackState.add(initialState())
      await db.settings.put({ key: current32MigrationKey, value: true })
      if (compiledCurrentGameBase.gameVersion === '3.3')
        await db.settings.put({ key: current33MigrationKey, value: true })
      return
    }
    // One-time migration to the installed current-version view. The marker prevents a deliberate
    // rollback to 3.0 from being silently undone on the next startup.
    const migrated = Boolean((await db.settings.get(current32MigrationKey))?.value)
    if (!migrated) {
      const previousSelection = state.activeFormalByKind['game-base']
      const previouslyMigrated31 = Boolean((await db.settings.get(current31MigrationKey))?.value)
      // Preserve a deliberate rollback or external selection; only the known
      // previous current package (or an unmigrated legacy install) advances.
      if (
        previousSelection !== gameBase31Current.id &&
        previousSelection !== gameBase32Current.id &&
        previouslyMigrated31
      ) {
        await db.settings.put({ key: current32MigrationKey, value: true })
        return
      }
      const previousId = state.activeFormalByKind['game-base']
      const activeFormalByKind = { ...state.activeFormalByKind, 'game-base': gameBase32Current.id }
      await db.gameDataPackState.put({
        ...state,
        activeFormalByKind,
        expiredCalculationPackageIds:
          previousId && previousId !== gameBase32Current.id
            ? [...new Set([...state.expiredCalculationPackageIds, previousId])]
            : state.expiredCalculationPackageIds,
        updatedAt: new Date().toISOString(),
      })
      await db.settings.put({ key: current32MigrationKey, value: true })
    }
    if (
      compiledCurrentGameBase.gameVersion === '3.3' &&
      !(await db.settings.get(current33MigrationKey))?.value
    ) {
      const selected = await db.gameDataPackState.get(stateId)
      const previousId = selected?.activeFormalByKind['game-base']
      // Only the known previous current package advances automatically. A
      // deliberate older rollback or external selection remains untouched.
      if (selected && previousId === gameBase32Current.id) {
        await db.gameDataPackState.put({
          ...selected,
          activeFormalByKind: {
            ...selected.activeFormalByKind,
            'game-base': compiledCurrentGameBase.id,
          },
          expiredCalculationPackageIds: [
            ...new Set([...selected.expiredCalculationPackageIds, previousId]),
          ],
          updatedAt: new Date().toISOString(),
        })
      }
      await db.settings.put({ key: current33MigrationKey, value: true })
    }
  })
}
