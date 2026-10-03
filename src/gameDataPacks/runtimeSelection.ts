import { database, type SodaDatabase } from '../db/database'
import { gameBase32Current } from './currentVersionAdoption32'
import { currentVersionProjection } from './currentVersionProjection'
import { validateManifest } from './types'
import { isCompatibleManifestContent } from './manifestContentCompatibility'

export const currentGameDataRuntimeSelectionContract =
  'soda-current-game-data-runtime-selection/v1' as const

export type CurrentGameDataRuntimeSelection =
  | {
      contract: typeof currentGameDataRuntimeSelectionContract
      status: 'compiled_current'
      packageId: string
      packageVersion: string
      gameVersion: string
      source: 'implicit_compiled_baseline' | 'active_formal_package'
    }
  | {
      contract: typeof currentGameDataRuntimeSelectionContract
      status: 'unbound'
      packageId: string | null
      packageVersion: string | null
      gameVersion: string | null
      reason:
        | 'active_game_base_missing'
        | 'active_manifest_missing'
        | 'active_manifest_invalid'
        | 'active_manifest_not_formal'
        | 'active_package_expired'
        | 'active_package_not_compiled_artifact'
      message: string
    }

/**
 * Reads only the already-selected game-base package. The compiled current projection is the sole
 * runtime adapter today, so a different selected package must block calculation instead of being
 * silently treated as if its metadata changed the static consumers.
 *
 * This intentionally does not call ensureBundledGameDataPacks or repository accessors: validation
 * and calculation queries must not initialise, migrate, or write the player's database.
 */
export async function readCurrentGameDataRuntimeSelection(
  db: SodaDatabase = database,
): Promise<CurrentGameDataRuntimeSelection> {
  const state = await db.gameDataPackState.get('active-game-data-packs')
  if (!state) {
    return {
      contract: currentGameDataRuntimeSelectionContract,
      status: 'compiled_current',
      packageId: currentVersionProjection.packageId,
      packageVersion: currentVersionProjection.packageVersion,
      gameVersion: currentVersionProjection.gameVersion,
      source: 'implicit_compiled_baseline',
    }
  }

  const activePackageId = state.activeFormalByKind['game-base'] ?? null
  if (!activePackageId) return unbound('active_game_base_missing', null, null, null)

  const active = await db.gameDataPacks.get(activePackageId)
  if (!active) return unbound('active_manifest_missing', activePackageId, null, null)
  if (!validateManifest(active).success)
    return unbound('active_manifest_invalid', active.id, active.packageVersion, active.gameVersion)
  if (active.status !== 'formal')
    return unbound(
      'active_manifest_not_formal',
      active.id,
      active.packageVersion,
      active.gameVersion,
    )
  if (state.expiredCalculationPackageIds.includes(active.id))
    return unbound('active_package_expired', active.id, active.packageVersion, active.gameVersion)
  if (
    active.kind !== gameBase32Current.kind ||
    active.id !== gameBase32Current.id ||
    active.packageVersion !== gameBase32Current.packageVersion ||
    active.gameVersion !== gameBase32Current.gameVersion ||
    !isCompatibleManifestContent(active.contentHash, gameBase32Current.contentHash)
  )
    return unbound(
      'active_package_not_compiled_artifact',
      active.id,
      active.packageVersion,
      active.gameVersion,
    )
  return {
    contract: currentGameDataRuntimeSelectionContract,
    status: 'compiled_current',
    packageId: active.id,
    packageVersion: active.packageVersion,
    gameVersion: active.gameVersion,
    source: 'active_formal_package',
  }
}

function unbound(
  reason: Extract<CurrentGameDataRuntimeSelection, { status: 'unbound' }>['reason'],
  packageId: string | null,
  packageVersion: string | null,
  gameVersion: string | null,
): CurrentGameDataRuntimeSelection {
  const message =
    reason === 'active_package_not_compiled_artifact'
      ? '已选游戏资料与当前应用版本不匹配，请恢复与当前应用配套的资料后重试。'
      : '游戏资料暂时不可用，请恢复与当前应用配套的资料后重试。'
  return {
    contract: currentGameDataRuntimeSelectionContract,
    status: 'unbound',
    packageId,
    packageVersion,
    gameVersion,
    reason,
    message,
  }
}
