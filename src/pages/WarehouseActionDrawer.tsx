import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import { displayDiscMainValue } from './publicDiscFacts'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { ExplanationPopover } from '../components/ExplanationPopover'
import { EffectDescription } from '../components/EffectDescription'
import type { DriveDisc } from '../domain/schemas'
import {
  readableAgentName,
  readablePhysicalDiscLabel,
  readableSetName,
  readableWarehouseReason,
  statLabel,
} from './warehouseFactLabels'
import { formatRecordedDiscStatValue, formatRecordedDiscSubStat } from './discStatPresentation'
import { WarehouseUsedAgents } from './WarehouseUsedAgents'
import { warehouseDevelopmentAction } from '../application/warehouseDevelopmentPresentation'
import { DiscAttributeComparison, SavedUsageReferences } from './WarehouseActionDrawerDetails'
import { savedUsageReferences } from './WarehouseActionDrawerDetails.helpers'
import { selectWarehouseCleanupReason } from './warehouseActionListJoin'

export function WarehouseActionDrawer({
  item,
  disc,
  discs,
  alternativeRecommendations,
  decisionLabel,
  relations,
  onReturnToList,
  onSelectAlternative,
  onReturnToOriginal,
  onShowSameKind,
  navigation,
  comparisonOrigin,
}: {
  item: WarehouseActionItem
  disc: DriveDisc
  discs: readonly DriveDisc[]
  alternativeRecommendations?: ReadonlyMap<string, { label: string; prioritize: boolean }>
  decisionLabel: string
  relations: string[]
  onReturnToList?: () => void
  onSelectAlternative?: (id: string) => void
  onReturnToOriginal?: () => void
  onShowSameKind?: () => void
  navigation?: { index: number; total: number; onPrevious: () => void; onNext: () => void }
  comparisonOrigin?: { item: WarehouseActionItem; disc: DriveDisc }
}) {
  const stale = item.recommendationState === 'stale'
  const developmentIds = new Set(stale ? [] : (item.developmentAlternativeIds ?? []))
  const alternatives = [...new Set([...item.alternativeDiscIds, ...developmentIds])]
    .filter((id) => id !== disc.id)
    .map((id) => discs.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is DriveDisc => Boolean(candidate))
    .sort(
      (a, b) =>
        Number(alternativeRecommendations?.get(b.id)?.prioritize ?? false) -
        Number(alternativeRecommendations?.get(a.id)?.prioritize ?? false),
    )
  const alternativeDiscIds = new Set(alternatives.map((alternative) => alternative.id))
  const missingAlternativeDiscIds = item.alternativeDiscIds.filter(
    (alternativeId) => !alternativeDiscIds.has(alternativeId),
  )
  const sameKindCount = discs.filter(
    (candidate) =>
      candidate.setId === disc.setId &&
      candidate.slot === disc.slot &&
      candidate.mainStat === disc.mainStat,
  ).length
  const sameKindOrdinal = readablePhysicalDiscLabel(disc, discs).match(/同类第(\d+)张/)?.[1]
  const retentionAgentIds = !stale && item.action === 'keep' ? (item.retentionAgentIds ?? []) : []
  const retainedUsesCoverCompatibility =
    retentionAgentIds.length > 0 &&
    item.compatibleAgentIds.length > 0 &&
    new Set(retentionAgentIds).size === new Set(item.compatibleAgentIds).size &&
    item.compatibleAgentIds.every((id) => retentionAgentIds.includes(id))
  const decisionReason = selectWarehouseCleanupReason(item.reasons)
  const explanationReasons = item.reasons.filter((reason) => reason !== decisionReason)
  const savedUses = savedUsageReferences(item.affectedPlans, item.affectedTeams)

  return (
    <aside className="warehouse-action-drawer" aria-labelledby="warehouse-action-drawer-title">
      {onReturnToOriginal ? (
        <button className="button button--quiet" type="button" onClick={onReturnToOriginal}>
          返回原盘
        </button>
      ) : null}
      {onReturnToList ? (
        <button
          className="button button--quiet warehouse-mobile-return"
          type="button"
          onClick={onReturnToList}
        >
          返回驱动盘列表
        </button>
      ) : null}
      {navigation && navigation.total > 1 ? (
        <nav className="warehouse-disc-stepper" aria-label="逐张查看驱动盘">
          <button
            className="button button--quiet"
            type="button"
            disabled={navigation.index <= 0}
            onClick={navigation.onPrevious}
          >
            上一张
          </button>
          <span aria-live="polite">
            {navigation.index + 1} / {navigation.total}
          </span>
          <button
            className="button button--quiet"
            type="button"
            disabled={navigation.index >= navigation.total - 1}
            onClick={navigation.onNext}
          >
            下一张
          </button>
        </nav>
      ) : null}
      <header>
        <VisualEntityImage
          className="warehouse-action-drawer__image"
          entityId={disc.setId}
          entityType="drive_disc_set"
          name={readableSetName(disc.setId)}
          slotId="drive-disc-set.icon"
          consumer="warehouse.action-list"
        />
        <div className="warehouse-action-drawer__heading">
          <h2 id="warehouse-action-drawer-title" tabIndex={-1}>
            {readableSetName(disc.setId)} · {disc.slot} 号位
          </h2>
          <p>
            +{disc.level}
            {sameKindCount > 1 ? ` · 同类 ${sameKindCount} 张 · 当前第 ${sameKindOrdinal} 张` : ''}
          </p>
        </div>
      </header>
      {comparisonOrigin ? (
        <DiscAttributeComparison original={comparisonOrigin.disc} candidate={disc} />
      ) : null}
      <section className="warehouse-action-drawer__decision">
        {!stale && item.action === 'cleanup' && decisionReason ? (
          <p className="warehouse-action-drawer__decision-summary">
            <EffectDescription text={readableWarehouseReason(decisionReason)} />
          </p>
        ) : null}
        <div className="warehouse-action-drawer__section-heading">
          <p className="warehouse-action-drawer__action">
            {stale ? '旧结果待重新分析' : decisionLabel}
          </p>
          {explanationReasons.length > 0 ||
          (!stale && item.reviewBasis === 'no_current_fit' && !decisionReason) ? (
            <ExplanationPopover label="判断依据" title={stale ? '分析时的判断依据' : '判断依据'}>
              {explanationReasons.length > 0 ? (
                <ul>
                  {explanationReasons.map((reason) => (
                    <li key={reason}>
                      <EffectDescription text={readableWarehouseReason(reason)} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </ExplanationPopover>
          ) : null}
        </div>
        {!stale && item.reviewBasis === 'no_current_fit' && (
          <p>
            当前角色与保存队伍未推荐这一组合。
            {sameKindCount === 1
              ? '这是同类唯一一张，处理后将没有这一组合。'
              : `同类还有 ${sameKindCount - 1} 张。`}
          </p>
        )}
        {!stale && item.developmentAdvice ? (
          <div
            className="warehouse-action-drawer__development"
            role="group"
            aria-label="培养下一步"
          >
            {item.developmentAdvice.kind !== 'review_finished' ||
            item.developmentAdvice.currentEffectiveRolls === null ? (
              <p>
                <strong>{warehouseDevelopmentAction(item.developmentAdvice)}</strong>
              </p>
            ) : null}
            {item.developmentAdvice.effectiveAgentId &&
            item.developmentAdvice.currentEffectiveRolls !== null ? (
              <p>
                <strong>{readableAgentName(item.developmentAdvice.effectiveAgentId)}</strong>
                {' · '}
                <strong className="warehouse-action-drawer__hits">
                  {item.developmentAdvice.currentEffectiveRolls} 次有效命中
                </strong>
                （含初始）
                {item.developmentAdvice.remainingNodes !== null &&
                item.developmentAdvice.remainingNodes > 0 ? (
                  <>
                    还可强化 <strong>{item.developmentAdvice.remainingNodes} 次</strong>。
                  </>
                ) : null}
              </p>
            ) : item.developmentAdvice.remainingNodes !== null &&
              item.developmentAdvice.remainingNodes > 0 ? (
              <p>
                还可强化 <strong>{item.developmentAdvice.remainingNodes} 次</strong>。
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
      <section>
        <h3>词条</h3>
        <dl className="warehouse-action-drawer__stats">
          <div>
            <dt>主词条</dt>
            <dd>
              {statLabel(disc.mainStat)} · {displayDiscMainValue(disc)}
            </dd>
          </div>
          {disc.subStats.map((substat) => (
            <div key={substat.stat}>
              <dt>{statLabel(substat.stat)}</dt>
              <dd>{formatRecordedDiscSubStat(substat.stat, substat.value, substat.upgrades)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <div className="warehouse-action-drawer__section-heading">
          <h3>{stale ? '分析时的使用与用途' : '使用与保留用途'}</h3>
          {savedUses.length > 0 ? (
            <ExplanationPopover label={`${savedUses.length} 个关联方案`}>
              <SavedUsageReferences references={savedUses} />
            </ExplanationPopover>
          ) : null}
        </div>
        <div className="warehouse-action-drawer__usage">
          <WarehouseUsedAgents agentIds={item.usageAgentIds} />
          <p>
            {relations.length
              ? relations.join(' · ')
              : item.affectedPlans.length
                ? '方案已引用，未记录具体分配代理人。'
                : '当前没有角色或方案使用这张盘。'}
          </p>
        </div>
        {!item.usageAgentIds.length && item.affectedPlans.length && relations.length ? (
          <p>方案已引用，未记录具体分配代理人。</p>
        ) : null}
        {retentionAgentIds.length ? (
          <p aria-label="具体保留用途">
            保留用途：{retentionAgentIds.slice(0, 3).map(readableAgentName).join('、')}
            {retentionAgentIds.length > 3 ? `等 ${retentionAgentIds.length} 位` : ''}。
            {item.retentionBasis === 'other_agent_fit'
              ? '这些角色尚未拥有；请结合培养计划预留，不代表现在必须投入强化。'
              : null}
          </p>
        ) : null}
      </section>
      {item.affectedTeams.length ? (
        <section>
          <h3>队伍影响</h3>
          <ul className="warehouse-action-drawer__team-impact">
            {item.affectedTeams.map((team) => (
              <li key={team.candidateId}>
                <span>{team.memberIds.map(readableAgentName).join('、')}</span>
                {team.decisionAuthority ? ` · 评级 ${team.decisionAuthority.teamRating}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <div className="warehouse-action-drawer__section-heading">
          <h3>可比较盘</h3>
          <ExplanationPopover label="用途说明">
            <p>同类盘按同套装、号位和主词条筛选，包含所有建议类型，便于逐张比较。</p>
            {retentionAgentIds.length > 3 ? (
              <p>保留用途：{retentionAgentIds.map(readableAgentName).join('、')}。</p>
            ) : null}
            {!retainedUsesCoverCompatibility && item.compatibleAgentIds.length > 3 ? (
              <p>适用角色：{item.compatibleAgentIds.map(readableAgentName).join('、')}。</p>
            ) : null}
            {alternatives.some((alternative) => developmentIds.has(alternative.id)) ? (
              <p>强化候选在同等成长条件下比较，实际强化结果可能不同，原有使用和保留关系不变。</p>
            ) : null}
            {!stale && item.retentionReview === 'low_effective_rolls' ? (
              <p>
                已无剩余强化机会，有效词条未达号位参考线。主词条和套装仍可能有价值；这不代表伤害低。
              </p>
            ) : null}
            {!stale && item.action === 'keep' && item.retentionAgentIds?.length ? (
              <p>保留用途说明当前用途仍有差异，不代表这张盘已毕业。</p>
            ) : null}
          </ExplanationPopover>
        </div>
        {!stale && item.retentionReview === 'low_effective_rolls' ? (
          <p role="status">
            <strong>预留词条偏少，优先复核</strong>；不构成可清理证明。
          </p>
        ) : null}
        <div className="warehouse-action-drawer__alternatives-summary">
          {onShowSameKind && sameKindCount > 1 ? (
            <button className="button button--quiet" type="button" onClick={onShowSameKind}>
              查看全部 {sameKindCount} 张同类盘
            </button>
          ) : null}
          <p>
            {alternatives.length
              ? `可比较 ${alternatives.length} 张`
              : missingAlternativeDiscIds.length
                ? '替代盘资料不完整，暂时无法比对。'
                : '暂未找到可确认的同类替代盘。'}
          </p>
        </div>
        {alternatives.length ? (
          <ul className="warehouse-alternatives" aria-label="可比较盘">
            {alternatives.map((alternative) => {
              const identity = readablePhysicalDiscLabel(alternative, discs)
              const ordinal = identity.match(/同类第\d+张/)?.[0]
              const recommendation = alternativeRecommendations?.get(alternative.id)
              const sameKind =
                alternative.setId === disc.setId &&
                alternative.slot === disc.slot &&
                alternative.mainStat === disc.mainStat
              const content = (
                <>
                  <span
                    className={`warehouse-alternative__info${sameKind ? ' warehouse-alternative__info--same-kind' : ''}`}
                  >
                    <strong>
                      {sameKind && ordinal
                        ? ordinal
                        : `${readableSetName(alternative.setId)} · ${alternative.slot}号位`}
                    </strong>
                    <span className="warehouse-alternative__meta">
                      {!sameKind ? `${statLabel(alternative.mainStat)} · ` : ''}+{alternative.level}
                      {!sameKind && ordinal ? ` · ${ordinal}` : ''}
                      {developmentIds.has(alternative.id) ? ' · 强化候选' : ''}
                    </span>
                    <span className="warehouse-alternative__feature">
                      {alternative.subStats
                        .slice(0, 2)
                        .map(
                          (substat) =>
                            `${statLabel(substat.stat)} ${formatRecordedDiscStatValue(substat.stat, substat.value)}`,
                        )
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className="warehouse-alternative__status"
                    data-priority={recommendation?.prioritize || undefined}
                  >
                    {recommendation?.label ?? '建议待确认'}
                  </span>
                </>
              )
              return (
                <li key={alternative.id}>
                  {onSelectAlternative ? (
                    <button
                      className="warehouse-alternative__row"
                      type="button"
                      data-alternative-id={alternative.id}
                      aria-label={`${developmentIds.has(alternative.id) ? '比较强化候选：' : '查看替代盘：'}${identity}，${recommendation?.label ?? '建议待确认'}`}
                      onClick={() => onSelectAlternative(alternative.id)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="warehouse-alternative__row">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
        {missingAlternativeDiscIds.length ? (
          <div role="status">
            <p>{missingAlternativeDiscIds.length} 张替代盘的仓库记录缺失，请更新仓库后重新分析。</p>
            <details>
              <summary>查看缺失记录编号</summary>
              <ul aria-label="缺少记录的替代盘编号">
                {missingAlternativeDiscIds.map((alternativeId) => (
                  <li key={alternativeId}>
                    <code>{alternativeId}</code>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
        {!retainedUsesCoverCompatibility ? (
          <p>
            {item.compatibleAgentIds.length
              ? `适用角色：${item.compatibleAgentIds.slice(0, 3).map(readableAgentName).join('、')}${item.compatibleAgentIds.length > 3 ? `等 ${item.compatibleAgentIds.length} 位` : ''}`
              : '暂未确认适用角色。'}
          </p>
        ) : null}
      </section>
      {stale ? (
        <p className="warehouse-action-drawer__stale">
          该结论已过期，仅供回看；请重新分析后再判断。
        </p>
      ) : null}
    </aside>
  )
}
