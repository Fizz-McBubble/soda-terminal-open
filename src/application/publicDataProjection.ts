import rawGameData from '../data/game-data.json'
import rawDriveDiscData from '../data/drive-disc-data.v1.json'
import { driveDiscDataManifestSchema, gameDataManifestSchema } from '../domain/schemas'

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/** Match the persisted formal disc catalog hash while ignoring its evidence-only display flag. */
export function publicDriveDiscDataContentHash(input: { driveDiscSets: unknown; rules: unknown }) {
  const driveDiscSets = (input.driveDiscSets as Array<Record<string, unknown>>).map((set) => {
    if (set.evidenceOnly) return set
    const stableSet = { ...set }
    delete stableSet.evidenceOnly
    return stableSet
  })
  return stableHash(JSON.stringify({ driveDiscSets, rules: input.rules }))
}

const parsedDriveDiscData = driveDiscDataManifestSchema.safeParse(rawDriveDiscData)
export const publicDriveDiscDataResult =
  parsedDriveDiscData.success &&
  parsedDriveDiscData.data.contentHash === publicDriveDiscDataContentHash(rawDriveDiscData)
    ? parsedDriveDiscData
    : {
        success: false as const,
        error: parsedDriveDiscData.success
          ? new Error('驱动盘数据内容哈希不匹配。')
          : parsedDriveDiscData.error,
      }

export const publicDriveDiscData = publicDriveDiscDataResult.success
  ? publicDriveDiscDataResult.data
  : null

export const publicGameDataResult = gameDataManifestSchema.safeParse(
  publicDriveDiscData
    ? {
        ...rawGameData,
        gameVersion: publicDriveDiscData.gameVersion,
        driveDiscSets: publicDriveDiscData.driveDiscSets,
      }
    : rawGameData,
)

export const publicGameData = publicGameDataResult.success ? publicGameDataResult.data : null
