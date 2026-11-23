import { displayWarehouseActionProjection } from '../application/warehouseActionContract'
import { warehouseActionStrengthLabel } from './warehouseDiscPresentation'
import { decisionFreshnessPresentation } from '../application/playerDecisionPresentation'

export function deriveAlternativeRecommendations(
  projection: ReturnType<typeof displayWarehouseActionProjection> | null,
) {
  return new Map(
    (projection?.actions ?? []).map((item) => {
      const stale = projection?.state === 'stale' || item.recommendationState === 'stale'
      return [
        item.disc.id,
        {
          label: stale
            ? decisionFreshnessPresentation('stale').label
            : warehouseActionStrengthLabel(item),
          prioritize: !stale && item.recommendationState === 'current' && item.action === 'keep',
        },
      ]
    }),
  )
}
