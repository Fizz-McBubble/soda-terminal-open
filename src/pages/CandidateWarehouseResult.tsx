import { getAgentName } from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { AccountDiscChoice } from '../optimizer/optimizeAccountBuilds'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'
import { displayDriveDiscSet } from './discFactPresentation'

// Solver rolls include each initial sub-stat line; the player-facing enhancement
// count includes only upgrades. Use the captured result instead of re-scoring.
function effectiveEnhancements(choice: AccountDiscChoice) {
  return Math.max(0, choice.effectiveRolls - choice.effectiveLines)
}

function statLabel(stat: string) {
  return getCandidateStatLabels([stat], '副词条')[0] ?? '词条资料待补齐'
}

export function CandidateWarehouseResult({
  plans,
  activeIndex,
  onSelect,
}: {
  plans: CandidateWarehousePlan[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  const active = plans[activeIndex]
  const baseline = plans[0]
  if (!active?.loadouts.length)
    return (
      <section className="panel status-card is-warning" aria-label="仓库匹配缺口" role="status">
        <h2>当前仓库暂不能组成完整参考方案</h2>
        <p>{active?.gaps.join('；') || '缺少可用的六个号位驱动盘。'}</p>
        <p>你可以调整成员或补充缺少的号位后重新匹配。</p>
      </section>
    )
  return (
    <section className="panel candidate-warehouse-result" aria-label="仓库参考匹配方案">
      <h2>{active.scope === 'team' ? '配装依据' : '实际仓库参考方案'}</h2>
      <p>匹配依据为套装、主词条和有效副词条；适配分用于比较仓库方案，不表示伤害提升。</p>
      {plans.length > 1 ? (
        <div className="button-row" role="tablist" aria-label="参考方案版本">
          {plans.map((plan, index) => (
            <button
              key={`${plan.scope}-${index}`}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              className={activeIndex === index ? 'is-selected' : ''}
              onClick={() => onSelect(index)}
            >
              方案 {index + 1} · {plan.totalScore.toFixed(2)} 分
            </button>
          ))}
        </div>
      ) : null}
      <p>
        仓库适配分 <strong>{active.totalScore.toFixed(2)}</strong> ·{' '}
        {active.scope === 'agent'
          ? '单人配装参考，可与其他方案共用驱动盘'
          : '每张驱动盘仅分配给一名成员'}
      </p>
      {active.scope === 'team' ? (
        <p className="candidate-warehouse-result__integrity" role="status">
          {active.loadouts.length === 3 &&
          active.loadouts.flatMap((loadout) => loadout.discs).length === 18 &&
          new Set(
            active.loadouts.flatMap((loadout) => loadout.discs.map((choice) => choice.disc.id)),
          ).size === 18
            ? '完整：3 名代理人各 6 张，共 18 张不重复的驱动盘。'
            : `当前仅分配 ${active.loadouts.flatMap((loadout) => loadout.discs).length} 张驱动盘，缺少的盘见下方。`}
        </p>
      ) : null}
      {baseline && active !== baseline ? (
        <p className="candidate-warehouse-result__delta">
          相对方案 1：{active.totalScore - baseline.totalScore >= 0 ? '+' : ''}
          {(active.totalScore - baseline.totalScore).toFixed(2)} 仓库适配分（
          {baseline.totalScore > 0
            ? `${(((active.totalScore - baseline.totalScore) / baseline.totalScore) * 100).toFixed(1)}%`
            : '基准分为 0，百分比不可计算'}
          ）。主要差异来自套装、主词条、有效强化和所选驱动盘。
        </p>
      ) : null}
      <details open={active.scope !== 'team'}>
        <summary>查看成员的套装、强化与驱动盘明细</summary>
        {active.loadouts.map((loadout) => (
          <article key={loadout.agentId} className="candidate-warehouse-loadout">
            <h3>
              {getAgentName(loadout.agentId)} · {loadout.totalScore.toFixed(2)} 分
            </h3>
            <p>
              套装：
              {Object.entries(loadout.setCounts)
                .map(([setId, count]) => `${displayDriveDiscSet(setId)} ${count} 件`)
                .join('；')}
              。有效词条强化{' '}
              {loadout.discs.reduce((total, disc) => total + effectiveEnhancements(disc), 0)} 次。
              {loadout.degraded
                ? ` 匹配取舍：${loadout.degradeReasons.join('；') || '本方案放宽了推荐主词条范围。'}`
                : ' 推荐套装与主词条均满足。'}
            </p>
            <ol
              className="candidate-disc-list"
              aria-label={`${getAgentName(loadout.agentId)}的六张驱动盘`}
            >
              {loadout.discs.map((choice) => (
                <li key={choice.disc.id}>
                  <VisualEntityImage
                    className="candidate-disc-list__image"
                    entityId={choice.disc.setId}
                    entityType="drive_disc_set"
                    name={displayDriveDiscSet(choice.disc.setId)}
                  />
                  <strong>{choice.disc.slot}号位</strong> · {displayDriveDiscSet(choice.disc.setId)}{' '}
                  · {statLabel(choice.disc.mainStat)} · +{choice.disc.level}
                  <span>
                    {' '}
                    · 有效强化 {effectiveEnhancements(choice)} · 副词条{' '}
                    {choice.disc.subStats.map((stat) => statLabel(stat.stat)).join('、') ||
                      '资料待补齐'}
                  </span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </details>
      {active.gaps.length ? <p className="muted-note">库存提示：{active.gaps.join('；')}</p> : null}
    </section>
  )
}
