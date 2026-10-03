import { canonicalBaselinePack30 } from './canonicalPack'
import type { gameData31CurrentCanonical } from './gameData31CurrentCanonical'
import { stableContentHash } from './types'

export function validateGameData31CurrentCanonical(input: unknown) {
  if (!input || typeof input !== 'object')
    return { success: false as const, error: '3.1 current canonical 格式无效。' }
  const candidate = input as typeof gameData31CurrentCanonical
  const expected = stableContentHash({
    id: candidate.id,
    schemaVersion: candidate.schemaVersion,
    gameVersion: candidate.gameVersion,
    ...(candidate.reviewedForVersion === undefined
      ? {}
      : { reviewedForVersion: candidate.reviewedForVersion }),
    lifecycle: candidate.lifecycle,
    installedAt: candidate.installedAt,
    previousPackId: candidate.previousPackId,
    rollbackTo: candidate.rollbackTo,
    sourceRefs: candidate.sourceRefs,
    fields: candidate.fields,
    delta: candidate.delta,
    staleCalculationIds: candidate.staleCalculationIds,
    coverageHash: candidate.coverageHash,
    continuityLedgerHash: candidate.continuityLedgerHash,
    boundary: candidate.boundary,
  })
  if (
    candidate.schemaVersion !== 1 ||
    candidate.gameVersion !== '3.1' ||
    (candidate.reviewedForVersion !== undefined && candidate.reviewedForVersion !== '3.1') ||
    candidate.lifecycle !== 'current' ||
    candidate.rollbackTo !== canonicalBaselinePack30.id ||
    candidate.contentHash !== expected
  )
    return {
      success: false as const,
      error: '3.1 current canonical 校验失败，保留上一有效基线。',
    }
  return { success: true as const, pack: candidate }
}
