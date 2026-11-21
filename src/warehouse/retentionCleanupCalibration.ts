import type {
  Catalog,
  Disc,
  QualityEvidence,
  RetentionBlocker,
} from './absoluteDiscRetentionContract'

/** Independent review exposed an unresolved cleanup boundary for PEN-led finished pieces. */
export function cleanupCalibrationBlockers(
  disc: Disc,
  catalog: Catalog,
  evidence: readonly QualityEvidence[],
): RetentionBlocker[] {
  const pen = disc.subStats.find((line) => line.stat === 'pen')
  if (
    disc.rarity !== 'S' ||
    disc.level !== catalog.rules.rarities.S?.maxLevel ||
    !pen ||
    pen.upgrades <= 0 ||
    disc.subStats.some((line) => line.stat !== 'pen' && line.upgrades >= pen.upgrades)
  )
    return []
  const profiles = new Map(catalog.profiles.map((profile) => [profile.id, profile]))
  return evidence.flatMap((use) => {
    const profile = profiles.get(use.profileId)
    if (
      !profile ||
      !['crit_damage', 'anomaly_damage'].includes(profile.goal ?? '') ||
      !(profile.weights.pen! > 0) ||
      profile.coreStats?.includes('pen') ||
      !['valid', 'conditional'].includes(use.useState) ||
      use.mainFit !== 'valid' ||
      use.setFit !== 'valid'
    )
      return []
    return [
      {
        kind: 'policy' as const,
        field: 'cleanupCalibration.secondaryPenPrimary',
        predicateId: 'independent-pen-primary-calibration-20261025',
        profileId: use.profileId,
        agentId: use.agentId,
        detail: '这张成品以穿透词条强化为主，当前去留依据仍需核对，先保留复核。',
        sourceIds: [
          'archived-independent-blind-extension:7253befa091d1b68f21a360a7f7f9f1bdef32dcf39e0352e87b5dfc0a159f7f8',
          ...use.sourceIds,
        ],
      },
    ]
  })
}
