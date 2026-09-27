import rawGameData from './game-data.json'
import rawDriveDiscData from './drive-disc-data.v1.json'
import { driveDiscDataManifestSchema, gameDataManifestSchema } from '../domain/schemas'
import { scannerDriveDiscCatalog31 } from '../gameDataPacks/gameData31CatalogIntake'
import type { DriveDiscImportSetIdentity } from '../domain/discImport'

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function getDriveDiscDataContentHash(input: { driveDiscSets: unknown; rules: unknown }) {
  const driveDiscSets = (input.driveDiscSets as Array<Record<string, unknown>>).map((set) => {
    if (set.evidenceOnly) return set
    const stableSet = { ...set }
    delete stableSet.evidenceOnly
    return stableSet
  })
  return stableHash(JSON.stringify({ driveDiscSets, rules: input.rules }))
}

export function loadGameData(input: unknown) {
  return gameDataManifestSchema.safeParse(input)
}

const parsedDriveDiscData = driveDiscDataManifestSchema.safeParse(rawDriveDiscData)
export const driveDiscDataResult =
  parsedDriveDiscData.success &&
  parsedDriveDiscData.data.contentHash === getDriveDiscDataContentHash(rawDriveDiscData)
    ? parsedDriveDiscData
    : {
        success: false as const,
        error: parsedDriveDiscData.success
          ? new Error('驱动盘数据内容哈希不匹配。')
          : parsedDriveDiscData.error,
      }

export const driveDiscData = driveDiscDataResult.success ? driveDiscDataResult.data : null

/**
 * Set identity accepted by scan import. Candidate combat effects remain outside the formal
 * drive-disc manifest and are intentionally not projected here.
 */
export const driveDiscImportSetIdentities: DriveDiscImportSetIdentity[] = [
  ...(driveDiscData?.driveDiscSets ?? []),
  ...scannerDriveDiscCatalog31.map((set) => ({
    id: set.id!,
    name: String(set.name),
    aliases: set.aliases,
    effectStatus: 'candidate' as const,
  })),
]

export const gameDataResult = loadGameData(
  driveDiscData
    ? {
        ...rawGameData,
        gameVersion: driveDiscData.gameVersion,
        driveDiscSets: driveDiscData.driveDiscSets,
      }
    : rawGameData,
)

export const gameData = gameDataResult.success ? gameDataResult.data : null
