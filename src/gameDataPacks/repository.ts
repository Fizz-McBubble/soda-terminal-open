import { database, type SodaDatabase } from '../db/database'
import {
  buildKnowledge30Formal,
  bundledGameDataPacks,
  gameBase31Current,
  gameBase32Current,
  rotation30Formal,
  visualCatalog30Formal,
} from './baseline'
import {
  gameData31CurrentCanonical,
  validateGameData31CurrentCanonical,
} from './gameData31CurrentCanonical'
import { type GameDataPackageManifest, type GameDataPackState, validateManifest } from './types'

const stateId = 'active-game-data-packs' as const
const noticeKey = 'game-data-pack-last-notice'
const current31MigrationKey = 'game-data-pack-current-3.1-migrated'
const current32MigrationKey = 'game-data-pack-current-3.2-migrated'

export type GameDataPackNotice = {
  tone: 'status' | 'alert'
  message: string
  activeVersion: string | null
  calculationsNeedRefresh: boolean
}

async function saveNotice(notice: GameDataPackNotice, db: SodaDatabase) {
  await db.settings.put({ key: noticeKey, value: notice })
}

export async function getGameDataPackNotice(db: SodaDatabase = database) {
  const value = (await db.settings.get(noticeKey))?.value
  return value && typeof value === 'object' ? (value as GameDataPackNotice) : null
}

function initialState(now = new Date().toISOString()): GameDataPackState {
  return {
    id: stateId,
    activeFormalByKind: {
      'game-base': gameBase32Current.id,
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
    for (const pack of bundledGameDataPacks) {
      const existing = await db.gameDataPacks.get(pack.id)
      if (!existing) await db.gameDataPacks.add(pack)
    }
    const state = await db.gameDataPackState.get(stateId)
    if (!state) {
      await db.gameDataPackState.add(initialState())
      await db.settings.put({ key: current32MigrationKey, value: true })
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
  })
}

export async function getGameDataPackState(db: SodaDatabase = database) {
  return (await db.gameDataPackState.get(stateId)) ?? initialState()
}

export async function getActiveFormalGameDataPack(
  kind: GameDataPackageManifest['kind'],
  db: SodaDatabase = database,
) {
  const state = await getGameDataPackState(db)
  const id = state.activeFormalByKind[kind]
  return id ? db.gameDataPacks.get(id) : undefined
}

/** Current-version accessor. Field eligibility remains separate from this installed baseline. */
export const getActiveCurrentGameDataPack = getActiveFormalGameDataPack

export async function installGameDataPack(
  input: unknown,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  const checked = validateManifest(input)
  if (!checked.success) {
    const active = await getActiveFormalGameDataPack('game-base', db)
    await saveNotice(
      {
        tone: 'alert',
        message: '数据包校验未通过，已保留上一正式版本；玩家资产不会变更。',
        activeVersion: active?.gameVersion ?? null,
        calculationsNeedRefresh: false,
      },
      db,
    )
    throw new Error(checked.error)
  }
  await db.gameDataPacks.put(checked.manifest)
  beforeCommit?.()
  return checked.manifest
}

/** Formal packages are the only packages allowed to become a calculation baseline. */
export async function activateFormalGameDataPack(
  packageId: string,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  await ensureBundledGameDataPacks(db)
  await db.transaction('rw', db.gameDataPacks, db.gameDataPackState, async () => {
    const candidate = await db.gameDataPacks.get(packageId)
    if (
      !candidate ||
      candidate.status !== 'formal' ||
      candidate.missing.some((entry) => entry.calculationEligibility === 'included')
    )
      throw new Error('该数据包尚未满足正式计算条件。')
    const state = (await db.gameDataPackState.get(stateId)) ?? initialState()
    const previousId = state.activeFormalByKind[candidate.kind]
    const expired =
      previousId && previousId !== candidate.id
        ? [...new Set([...state.expiredCalculationPackageIds, previousId])]
        : state.expiredCalculationPackageIds
    await db.gameDataPackState.put({
      ...state,
      activeFormalByKind: { ...state.activeFormalByKind, [candidate.kind]: candidate.id },
      // A package may have been superseded previously and then deliberately selected again during
      // rollback. An active calculation baseline can never remain in the expired set.
      expiredCalculationPackageIds: expired.filter((id) => id !== candidate.id),
      updatedAt: new Date().toISOString(),
    })
    beforeCommit?.()
  })
  const active = await getActiveFormalGameDataPack(
    (await db.gameDataPacks.get(packageId))!.kind,
    db,
  )
  await saveNotice(
    {
      tone: 'status',
      message: '已切换正式数据版本；相关计算会在下次查看方案时提示重新计算。',
      activeVersion: active?.gameVersion ?? null,
      calculationsNeedRefresh: true,
    },
    db,
  )
  return active
}

/**
 * Installs the built-in 3.1 current canonical view after validating its field ledger hash.
 * It changes only game-data pack/state records; player-scoped tables are not in either transaction.
 */
export async function installAndActivateGameData31Current(
  canonicalInput: unknown,
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  const checked = validateGameData31CurrentCanonical(canonicalInput)
  if (!checked.success) {
    const active = await getActiveCurrentGameDataPack('game-base', db)
    await saveNotice(
      {
        tone: 'alert',
        message: '3.1 current 数据校验未通过，已保留上一有效基线；玩家资产不会变更。',
        activeVersion: active?.gameVersion ?? null,
        calculationsNeedRefresh: false,
      },
      db,
    )
    throw new Error(checked.error)
  }
  await installGameDataPack(gameBase31Current, db)
  const active = await activateFormalGameDataPack(gameBase31Current.id, db, beforeCommit)
  return {
    active,
    canonical: checked.pack,
    fieldBoundary: '当前版本已切换；字段 formal/candidate/missing 仍由各自证据决定，不会整体升格。',
  }
}

/**
 * Explicitly restores only the game-base metadata bundled with this application. It accepts no
 * package input, never selects an external version, and touches neither settings nor player data.
 */
export async function repairBundledGameData31Current(
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  const canonical = validateGameData31CurrentCanonical(gameData31CurrentCanonical)
  if (!canonical.success) throw new Error('应用自带游戏资料校验未通过，无法恢复。')
  return repairBundledMetadata(gameBase31Current, db, beforeCommit)
}

export async function repairBundledCurrentGameData(
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  return repairBundledMetadata(gameBase32Current, db, beforeCommit)
}

async function repairBundledMetadata(
  pack: GameDataPackageManifest,
  db: SodaDatabase,
  beforeCommit?: () => void,
) {
  const manifest = validateManifest(pack)
  if (!manifest.success) throw new Error('应用自带游戏资料校验未通过，无法恢复。')

  let previousGameBaseId: string | null = null
  await db.transaction('rw', db.gameDataPacks, db.gameDataPackState, async () => {
    const current = await db.gameDataPackState.get(stateId)
    const state: GameDataPackState = current ?? {
      id: stateId,
      activeFormalByKind: {},
      expiredCalculationPackageIds: [],
      updatedAt: new Date().toISOString(),
    }
    previousGameBaseId = state.activeFormalByKind['game-base'] ?? null
    const expiredCalculationPackageIds = [
      ...new Set([
        ...state.expiredCalculationPackageIds.filter((id) => id !== pack.id),
        ...(previousGameBaseId && previousGameBaseId !== pack.id ? [previousGameBaseId] : []),
      ]),
    ]
    await db.gameDataPacks.put(manifest.manifest)
    await db.gameDataPackState.put({
      ...state,
      activeFormalByKind: { ...state.activeFormalByKind, 'game-base': pack.id },
      expiredCalculationPackageIds,
      updatedAt: new Date().toISOString(),
    })
    beforeCommit?.()
  })
  return {
    active: pack,
    previousGameBaseId,
    sideEffect: 'game_data_metadata_only' as const,
    playerAssetBoundary: '账户、驱动盘和已保存方案均未修改。',
  }
}

export async function rollbackGameDataPack(
  kind: GameDataPackageManifest['kind'],
  db: SodaDatabase = database,
) {
  const current = await getActiveFormalGameDataPack(kind, db)
  if (!current?.rollbackTo) throw new Error('当前正式数据包没有可用的回滚目标。')
  await activateFormalGameDataPack(current.rollbackTo, db)
  await db.gameDataPacks.update(current.id, { status: 'rolled_back' })
  const active = await getActiveFormalGameDataPack(kind, db)
  await saveNotice(
    {
      tone: 'status',
      message: '已回到上一正式版本；玩家资产保持不变，相关计算需要重新确认。',
      activeVersion: active?.gameVersion ?? null,
      calculationsNeedRefresh: true,
    },
    db,
  )
  return active
}
