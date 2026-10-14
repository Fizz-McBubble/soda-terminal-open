import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import type { RetentionBlocker } from '../warehouse/absoluteDiscRetentionContract'
import { blockerText, score } from './warehouseRetentionCopy'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]

function scoreText(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) ? `${score(value)} 分` : '待确认'
}

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
    <details className="warehouse-retention__details">
      <summary>查看参考评分</summary>
      <p>仅供副词条筛选，不是伤害收益。</p>
      <dl className="warehouse-retention__scores">
        <div>
          <dt>当前副词条评分</dt>
          <dd>{scoreText(use.currentScore)}</dd>
        </div>
        <div>
          <dt>同号位保留参考</dt>
          <dd>{scoreText(use.cutoffs?.keepFrom)}</dd>
        </div>
        {fullyEnhanced ? (
          <div>
            <dt>强化状态</dt>
            <dd>已满级</dd>
          </div>
        ) : (
          <div>
            <dt>满级后评分范围</dt>
            <dd>
              {finalRangeKnown
                ? `${score(use.possibleFinalScore.lower)}–${score(use.possibleFinalScore.upper)} 分`
                : '待确认'}
            </dd>
          </div>
        )}
        {use.investment && !fullyEnhanced ? (
          <div>
            <dt>剩余强化</dt>
            <dd>{use.investment.remainingNodes} 次</dd>
          </div>
        ) : null}
      </dl>
    </details>
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
  const conditions = [...new Set(blockers.map(blockerText))]
  return (
    <div role="group" aria-label="全部待确认事项">
      <ul>
        {conditions.map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
      </ul>
    </div>
  )
}
