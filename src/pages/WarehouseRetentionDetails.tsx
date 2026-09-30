import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import type { RetentionBlocker } from '../warehouse/absoluteDiscRetentionContract'
import { readableAgentName } from './warehouseFactLabels'
import {
  blockerText,
  branchLabel,
  readableDetail,
  readableField,
  reasonLabels,
  score,
} from './warehouseRetentionCopy'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]

function UseScores({ use, owned }: { use: Use; owned: boolean }) {
  return (
    <li className="warehouse-retention__score-use">
      <div className="warehouse-retention__use-heading">
        <strong>{readableAgentName(use.agentId)}</strong>
        <span>
          {owned ? '已拥有' : '未拥有 · 储备'} · {branchLabel(use.profileId)}
        </span>
      </div>
      <dl className="warehouse-retention__scores">
        <div>
          <dt>当前副词条</dt>
          <dd>{score(use.currentScore)} 分</dd>
        </div>
        <div>
          <dt>保留标准</dt>
          <dd>{use.cutoffs ? `${score(use.cutoffs.keepFrom)} 分` : '待确认'}</dd>
        </div>
        <div>
          <dt>强化后可能范围</dt>
          <dd>
            {score(use.possibleFinalScore.lower)}–{score(use.possibleFinalScore.upper)} 分
          </dd>
        </div>
        {use.investment?.potentialTarget != null ? (
          <div>
            <dt>成长目标</dt>
            <dd>{score(use.investment.potentialTarget)} 分</dd>
          </div>
        ) : null}
      </dl>
      {use.investment?.remainingNodes !== undefined ? (
        <p>还可强化 {use.investment.remainingNodes} 次</p>
      ) : null}
      {use.functionalState === 'ready' ? (
        <p>功能用途已具备：{readableDetail(use.functionDetail ?? '主词条已满足单盘要求')}</p>
      ) : use.functionalState === 'needs_level' ? (
        <p>主词条功能仍需升级</p>
      ) : use.functionalState === 'needs_build_context' ? (
        <p>功能需结合整套配装确认</p>
      ) : null}
      {use.useState === 'conditional' ? <p>需先确认使用条件</p> : null}
      {use.useState === 'missing_fact' ? <p>相关动作或机制仍待确认</p> : null}
    </li>
  )
}

export function RetentionScoreDetails({
  evidence,
  visibleExplanation,
  visibleStop,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  visibleExplanation: string
  visibleStop: string | null
}) {
  if (evidence.reasonKind === 'approved_rarity_cleanup') return null
  return (
    <details className="warehouse-retention__details">
      <summary>查看评分与强化依据</summary>
      {evidence.reasonKind ? (
        <p>
          品质说明：<strong>{reasonLabels[evidence.reasonKind]}</strong>
        </p>
      ) : null}
      <p>分数衡量适用副词条，不是伤害评分；主词条只判断适配，不重复加分。</p>
      <p>强化范围是合法情况下可能达到的上下界，不代表成功概率；上界高也不等于值得一直强化。</p>
      {evidence.nextAction && readableDetail(evidence.nextAction.detail) !== visibleExplanation ? (
        <p>本次依据：{readableDetail(evidence.nextAction.detail)}</p>
      ) : null}
      {evidence.nextAction?.stopWhen &&
      readableDetail(evidence.nextAction.stopWhen) !== visibleStop ? (
        <p>复核条件：{readableDetail(evidence.nextAction.stopWhen)}</p>
      ) : null}
      {evidence.leadingUses.length ? (
        <ul aria-label="主要构筑品质证据" className="warehouse-retention__score-list">
          {evidence.leadingUses.map((use) => (
            <UseScores
              key={use.profileId}
              use={use}
              owned={evidence.ownedUseAgentIds.includes(use.agentId)}
            />
          ))}
        </ul>
      ) : (
        <p>尚无可确认的构筑评分。</p>
      )}
    </details>
  )
}

export function RetentionSourceDetails({
  evidence,
  blockers,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  blockers: RetentionBlocker[]
}) {
  return (
    <details className="warehouse-retention__details warehouse-retention__sources">
      <summary>
        查看资料与适用范围{blockers.length ? `（${blockers.length} 项待确认）` : ''}
      </summary>
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
      {evidence.policyCalibration !== 'approved' &&
      evidence.reasonKind !== 'approved_rarity_cleanup' ? (
        <p>该稀有度的清理标准尚未校准，目前不会建议清理。</p>
      ) : null}
      {evidence.reviewedUseScope ? (
        <p>
          {evidence.reasonKind === 'approved_rarity_cleanup'
            ? '范围：A/B 级盘的留存规则，不涉及角色用途或品质评分。'
            : '范围：当前版本已发布角色的已核对构筑与机制；功能盘仍需结合整套配装确认。'}
        </p>
      ) : null}
      <details>
        <summary>查看版本与来源标识</summary>
        <p>品质策略：{evidence.policyId}</p>
        {evidence.reviewedUseScope ? <p>用途范围标识：{evidence.reviewedUseScope}</p> : null}
        {evidence.leadingUses.map((use) => (
          <p key={use.profileId}>
            {readableAgentName(use.agentId)} · {branchLabel(use.profileId)} · 来源{' '}
            {use.sourceIds.join('、') || '待补齐'}
            {use.weightEvidence
              ? ` · 权重依据 ${use.weightEvidence.id}（${use.weightEvidence.method}）`
              : ''}
            {use.investment?.policyId ? ` · 投入策略 ${use.investment.policyId}` : ''}
          </p>
        ))}
        {blockers.map((blocker, index) => (
          <p key={`${blocker.predicateId}-${index}`}>
            {readableField(blocker.field)} · 来源 {blocker.sourceIds.join('、') || '待补齐'} ·
            判定标识 {blocker.predicateId}
          </p>
        ))}
      </details>
    </details>
  )
}
