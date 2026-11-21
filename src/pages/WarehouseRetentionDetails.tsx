import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import type { RetentionBlocker } from '../warehouse/absoluteDiscRetentionContract'
import { blockerText, score } from './warehouseRetentionCopy'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]

export function RetentionScoreDetails({
  evidence,
  use,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  use?: Use
}) {
  if (evidence.reasonKind === 'approved_rarity_cleanup' || !use) return null
  const fullyEnhanced = use.investment?.remainingNodes === 0
  const finalRangeKnown =
    Number.isFinite(use.possibleFinalScore.lower) && Number.isFinite(use.possibleFinalScore.upper)
  return (
    <div className="warehouse-retention__score-facts" role="group" aria-label="词条匹配">
      <dl className="warehouse-retention__scores">
        {Number.isFinite(use.currentScore) ? (
          <div>
            <dt>当前</dt>
            <dd>{score(use.currentScore)} 分</dd>
          </div>
        ) : null}
        {fullyEnhanced ? (
          <div>
            <dt className="sr-only">强化状态</dt>
            <dd>已满级</dd>
          </div>
        ) : finalRangeKnown ? (
          <div>
            <dt>强化后可能范围</dt>
            <dd>
              {score(use.possibleFinalScore.lower)}–{score(use.possibleFinalScore.upper)} 分
            </dd>
          </div>
        ) : null}
        {use.investment && !fullyEnhanced ? (
          <div>
            <dt>还可强化</dt>
            <dd>{use.investment.remainingNodes} 次</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

export function RetentionSourceDetails({
  evidence,
  blockers,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  blockers: RetentionBlocker[]
  use?: Use
}) {
  if (evidence.reasonKind === 'approved_rarity_cleanup' || !blockers.length) return null
  const conditions = [
    ...new Set(blockers.map(blockerText).filter((text): text is string => !!text)),
  ]
  if (!conditions.length) return null
  return (
    <div role="group" aria-label="具体使用条件">
      <ul>
        {conditions.map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
      </ul>
    </div>
  )
}
