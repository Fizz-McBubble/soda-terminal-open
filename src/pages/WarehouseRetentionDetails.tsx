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
  return (
    <details className="warehouse-retention__details">
      <summary>查看参考评分</summary>
      <p>用于筛选副词条，不是伤害收益；强化范围不代表成功概率。</p>
      <dl className="warehouse-retention__scores">
        <div>
          <dt>当前副词条</dt>
          <dd>{score(use.currentScore)} 分</dd>
        </div>
        <div>
          <dt>保留参考</dt>
          <dd>{use.cutoffs ? `${score(use.cutoffs.keepFrom)} 分` : '待确认'}</dd>
        </div>
        <div>
          <dt>强化后可能范围</dt>
          <dd>
            {score(use.possibleFinalScore.lower)}–{score(use.possibleFinalScore.upper)} 分
          </dd>
        </div>
        {use.investment ? (
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
