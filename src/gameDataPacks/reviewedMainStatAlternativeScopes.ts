import { reviewedRemielleBuildReference33 } from './reviewedRemielleBuildReference33'

/** Only explicit source pairings. A missing entry does not imply any set restriction. */
const scopes: Readonly<
  Record<
    string,
    {
      primarySetIds: readonly string[]
      secondarySetIds?: readonly string[]
    }
  >
> = {
  [reviewedRemielleBuildReference33.source.id]: {
    primarySetIds: [reviewedRemielleBuildReference33.primarySetId],
    secondarySetIds: [reviewedRemielleBuildReference33.secondarySetId],
  },
  'reviewed-main-stat-alternative-agent-soukaku-4-personal_damage': {
    primarySetIds: ['set-swing-jazz'],
    secondarySetIds: ['set-hormone-punk'],
  },
  'reviewed-main-stat-alternative-agent-soukaku-4-anomaly_support': {
    primarySetIds: ['set-freedom-blues'],
  },
}

export function getReviewedMainStatAlternativeScope(sourceId: string) {
  return scopes[sourceId]
}
