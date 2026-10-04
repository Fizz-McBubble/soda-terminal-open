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
  use,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  blockers: RetentionBlocker[]
  use?: Use
}) {
  if (evidence.reasonKind === 'approved_rarity_cleanup') return null
  return (
    <details className="warehouse-retention__details warehouse-retention__sources">
      <summary>查看来源{blockers.length ? '与待确认条件' : ''}</summary>
      {blockers.length ? (
        <div role="group" aria-label="全部待确认事项">
          <ul>
            {blockers.map((blocker, index) => (
              <li key={`${blocker.predicateId}-${index}`}>{blockerText(blocker)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evidence.sourceCoverage !== 'complete' && !blockers.length ? (
        <p>相关角色或套装用途尚未确认；先保留现状。</p>
      ) : null}
      {evidence.policyCalibration !== 'approved' ? (
        <p>该稀有度的清理标准尚未校准，目前不会建议清理。</p>
      ) : null}
      {use?.guidance?.sources.length ? (
        <ul>
          {use.guidance.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
              {' · '}
              {source.sourceVersion ? `原资料 ${source.sourceVersion}` : '原资料未标注游戏版本'}
            </li>
          ))}
        </ul>
      ) : (
        <p>这份分析未附可核对的来源链接。</p>
      )}
      <p>
        构筑建议用于判断词条方向；实际提升取决于整套配装。旧攻略沿用已核对的部分，不表示作者已更新到当前版本。
      </p>
    </details>
  )
}
