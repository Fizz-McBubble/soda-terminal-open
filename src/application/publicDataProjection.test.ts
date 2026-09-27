import { describe, expect, it } from 'vitest'
import rawDriveDiscData from '../data/drive-disc-data.v1.json'
import {
  driveDiscData,
  driveDiscDataResult,
  gameData,
  gameDataResult,
  getDriveDiscDataContentHash,
} from '../data/gameData'
import {
  publicDriveDiscData,
  publicDriveDiscDataContentHash,
  publicDriveDiscDataResult,
  publicGameData,
  publicGameDataResult,
} from './publicDataProjection'

describe('public game-data projection', () => {
  it('matches the installed desktop data and disc rules after schema and hash validation', () => {
    expect(publicDriveDiscDataResult.success).toBe(driveDiscDataResult.success)
    expect(publicGameDataResult.success).toBe(gameDataResult.success)
    expect(publicDriveDiscData).toEqual(driveDiscData)
    expect(publicGameData).toEqual(gameData)
  })

  it('uses the same content hash rule and rejects a changed disc rule', () => {
    expect(publicDriveDiscDataContentHash(rawDriveDiscData)).toBe(
      getDriveDiscDataContentHash(rawDriveDiscData),
    )
    expect(publicDriveDiscDataContentHash(rawDriveDiscData)).toBe(rawDriveDiscData.contentHash)
    expect(
      publicDriveDiscDataContentHash({
        driveDiscSets: rawDriveDiscData.driveDiscSets,
        rules: { ...rawDriveDiscData.rules, maxLevelByRarity: { B: 1, A: 12, S: 15 } },
      }),
    ).not.toBe(rawDriveDiscData.contentHash)
  })
})
