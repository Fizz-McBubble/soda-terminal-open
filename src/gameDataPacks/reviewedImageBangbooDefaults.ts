import imageDirections from './data/reviewed-team-image-directions.3.1.json'

type ImageObservation = {
  claimId: string
  memberIds: readonly string[]
  sourceVersion?: string
  sourceUrl: string
  imageSha256: string
  imageRegion: string
  sourceBangbooOptionIds: readonly string[]
  unresolvedAuthorBangbooOptions?: readonly unknown[]
  imageLabelConflict?: unknown
  sourceConflictReview?: unknown
}

/** Adopt an unambiguous current author option, never infer benefit from activation. */
export function resolveReviewedImageBangbooDefaults(
  records: readonly ImageObservation[] = imageDirections.records,
  defaultVersion = imageDirections.sourceVersion,
) {
  const groups = new Map<string, ImageObservation[]>()
  for (const record of records) {
    if ((record.sourceVersion ?? defaultVersion) !== '3.1') continue
    if (record.memberIds.length !== 3 || new Set(record.memberIds).size !== 3) continue
    const key = [...record.memberIds].sort().join('|')
    groups.set(key, [...(groups.get(key) ?? []), record])
  }
  return [...groups.values()].flatMap((observations) => {
    if (
      observations.some(
        (record) =>
          record.unresolvedAuthorBangbooOptions?.length ||
          record.imageLabelConflict ||
          record.sourceConflictReview,
      )
    )
      return []
    const ids = new Set(observations.flatMap((record) => [...record.sourceBangbooOptionIds]))
    if (ids.size !== 1) return []
    const bangbooId = [...ids][0]!
    return observations
      .filter((record) => record.sourceBangbooOptionIds.includes(bangbooId))
      .map((record) => ({
        memberIds: record.memberIds as readonly [string, string, string],
        bangbooId,
        sourceRef: `${record.sourceUrl}#${record.claimId}`,
        sourceUrl: record.sourceUrl,
        locator: record.imageRegion,
        sourceId: record.claimId,
        contentHash: record.imageSha256,
        sourceVersion: record.sourceVersion ?? defaultVersion,
      }))
  })
}
