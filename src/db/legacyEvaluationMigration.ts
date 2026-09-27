import { contentHash } from '../application/contentHash'
import type { EvaluationSnapshot } from '../evaluation/types'
import type { DiscEvaluation, DriveDisc } from '../domain/schemas'

// Keep the v2 archive upgrade independent of current evaluation rules and game data.
// These fields match the historical createDiscEvaluation/getDriveDiscVersion output.
const genericTemplateVersion = 'generic-v1'
const genericTemplateContentHash = contentHash({ mode: 'generic', version: genericTemplateVersion })

function getLegacyDiscVersion(disc: DriveDisc): string {
  return contentHash({
    setId: disc.setId,
    slot: disc.slot,
    level: disc.level,
    mainStat: disc.mainStat,
    subStats: disc.subStats.map(({ stat, value, upgrades }) => ({ stat, value, upgrades })),
    dataVersion: disc.dataVersion,
  })
}

export function migrateLegacyDiscEvaluation(
  disc: DriveDisc,
  snapshot: EvaluationSnapshot,
): DiscEvaluation {
  return {
    id: crypto.randomUUID(),
    discId: disc.id,
    discVersion: getLegacyDiscVersion(disc),
    templateId: snapshot.profileId ?? 'generic',
    templateVersion: snapshot.profileVersion ?? genericTemplateVersion,
    templateContentHash: snapshot.profileContentHash ?? genericTemplateContentHash,
    ruleVersion: snapshot.ruleVersion,
    ruleContentHash: snapshot.ruleContentHash,
    gameDataVersion: snapshot.gameVersion,
    evaluatedAt: snapshot.evaluatedAt,
    status: 'valid',
    source: 'migration',
    snapshot: structuredClone(snapshot),
  }
}

export function getLegacyDriveDiscVersion(disc: DriveDisc): string {
  return getLegacyDiscVersion(disc)
}
