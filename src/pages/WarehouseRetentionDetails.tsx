import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import type { RetentionBlocker } from '../warehouse/absoluteDiscRetentionContract'
import { blockerText, score } from './warehouseRetentionCopy'
import { ExplanationPopover } from '../components/ExplanationPopover'

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
    <div className="warehouse-retention__score-facts" role="group" aria-label="副词条参考评分">
      <dl className="warehouse-retention__scores">
        <div>
          <dt>副词条评分</dt>
          <dd>{scoreText(use.currentScore)}</dd>
        </div>
        <div>
          <dt>保留参考线</dt>
          <dd>{scoreText(use.cutoffs?.keepFrom)}</dd>
        </div>
        {fullyEnhanced ? (
          <div>
            <dt className="sr-only">强化状态</dt>
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
      <ExplanationPopover label="评分说明">
        <p>
          副词条评分按当前参考角色、构筑方向和号位的固定品质标尺计算，满分为 100 分，不是伤害收益。
        </p>
        <p>
          保留参考线是该用途的副词条品质保留门槛，不是满分；达到后仍需主词条与套装用途成立。低于参考线也不等于可清理，还要结合功能用途、成长与使用保护判断。
        </p>
      </ExplanationPopover>
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
