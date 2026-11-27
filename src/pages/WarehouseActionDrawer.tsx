import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
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
import { formatRecordedDiscStatValue } from './discStatPresentation'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { warehouseDevelopmentAction } from '../application/warehouseDevelopmentPresentation'
import { DiscAttributeComparison, WarehouseSavedUsagePopover } from './WarehouseActionDrawerDetails'
import { teamRatingSummary } from './teamLoadoutDecisionViewModel'
import { savedUsageReferences } from './WarehouseActionDrawerDetails.helpers'
import { selectWarehouseCleanupReason } from './warehouseActionListJoin'
import { WarehouseRetentionEvidence } from './WarehouseRetentionEvidence'
import { WarehouseActionNextStep } from './WarehouseActionGuidance'
import { needsWarehouseDecisionRecheck, playerFacingNextStep } from './warehouseActionGuidanceModel'
import { decisionFreshnessPresentation } from '../application/playerDecisionPresentation'
import { DevelopmentDiscCard } from '../features/agentDevelopmentGolden/DevelopmentDiscCard'
import '../features/agentDevelopmentGolden/development-disc-card.css'
import { presentDiscFactFromChoice } from './discFactPresentation'
import { getCurrentDriveDiscRecommendation } from '../gameDataPacks/currentDriveDiscRecommendationCatalog'

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
  navigation,
  comparisonOrigin,
  comparisonFact,
  ownedAgentIds,
  onReanalyze,
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
  comparisonFact?: DriveDisc
  ownedAgentIds: ReadonlySet<string>
  onReanalyze?: () => void
}) {
  const stale = item.recommendationState === 'stale'
  const needsRecheck = needsWarehouseDecisionRecheck(item)
  const comparisonDisc = comparisonOrigin?.disc ?? disc
  const comparisonItem = comparisonOrigin?.item ?? item
  const sameKindDiscs = discs.filter(
    (candidate) =>
      candidate.setId === comparisonDisc.setId &&
      candidate.slot === comparisonDisc.slot &&
      candidate.mainStat === comparisonDisc.mainStat,
  )
  const developmentIds = new Set(
    comparisonItem.recommendationState === 'stale'
      ? []
      : (comparisonItem.developmentAlternativeIds ?? []),
  )
  const replacementIds = new Set(
    comparisonItem.recommendationState !== 'stale' &&
      (comparisonItem.cleanupAssessment?.alternativeSafe ||
        comparisonItem.statuses.includes('better_alternative'))
      ? comparisonItem.alternativeDiscIds
      : [],
  )
  const alternatives = [
    ...new Set([
      ...sameKindDiscs.map((candidate) => candidate.id),
      ...comparisonItem.alternativeDiscIds,
      ...developmentIds,
    ]),
  ]
    .filter((id) => id !== comparisonDisc.id)
    .map((id) => discs.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is DriveDisc => Boolean(candidate))
    .sort((left, right) => {
      const priority =
        Number(alternativeRecommendations?.get(right.id)?.prioritize ?? false) -
        Number(alternativeRecommendations?.get(left.id)?.prioritize ?? false)
      if (priority) return priority
      const sameKind =
        Number(
          right.setId === comparisonDisc.setId &&
            right.slot === comparisonDisc.slot &&
            right.mainStat === comparisonDisc.mainStat,
        ) -
        Number(
          left.setId === comparisonDisc.setId &&
            left.slot === comparisonDisc.slot &&
            left.mainStat === comparisonDisc.mainStat,
        )
      if (sameKind) return sameKind
      const development = Number(developmentIds.has(right.id)) - Number(developmentIds.has(left.id))
      return development || left.id.localeCompare(right.id)
    })
  const displayedSameKindOrdinals = new Map(
    alternatives
      .filter(
        (alternative) =>
          alternative.setId === comparisonDisc.setId &&
          alternative.slot === comparisonDisc.slot &&
          alternative.mainStat === comparisonDisc.mainStat,
      )
      .map((alternative, index) => [alternative.id, index + 1] as const),
  )
  const alternativeDiscIds = new Set(alternatives.map((alternative) => alternative.id))
  const missingAlternativeDiscIds = comparisonItem.alternativeDiscIds.filter(
    (alternativeId) =>
      alternativeId !== disc.id &&
      alternativeId !== comparisonDisc.id &&
      !alternativeDiscIds.has(alternativeId),
  )
  const sameKindCount = discs.filter(
    (candidate) =>
      candidate.setId === disc.setId &&
      candidate.slot === disc.slot &&
      candidate.mainStat === disc.mainStat,
  ).length
  const retentionAgentIds = !stale && item.action === 'keep' ? (item.retentionAgentIds ?? []) : []
  const compatibilityLabel = item.absoluteRetention ? '保留潜力' : '适用角色'
  const retainedUsesCoverCompatibility =
    retentionAgentIds.length > 0 &&
    item.compatibleAgentIds.length > 0 &&
    new Set(retentionAgentIds).size === new Set(item.compatibleAgentIds).size &&
    item.compatibleAgentIds.every((id) => retentionAgentIds.includes(id))
  const compatibleOnlyAgentIds = item.compatibleAgentIds.filter(
    (agentId) => !retentionAgentIds.includes(agentId),
  )
  const playerReasons = item.reasons
  const selectedDecisionReason = selectWarehouseCleanupReason(playerReasons)
  const decisionReason = selectedDecisionReason
    ? readableWarehouseReason(selectedDecisionReason)
    : ''
  const explanationReasons = playerReasons
    .filter((reason) => reason !== selectedDecisionReason)
    .map(readableWarehouseReason)
    .filter(Boolean)
  const savedUses = savedUsageReferences(item.affectedPlans, item.affectedTeams)
  const nextStep = playerFacingNextStep(item)
  const subStatHistory = deriveSubStatHistory(disc)
  const setInfo = getCurrentDriveDiscRecommendation(disc.setId)
  const setEffects = [
    ['两件', setInfo?.twoPieceEffect],
    ['四件', setInfo?.fourPieceEffect],
  ].filter((entry): entry is [string, string] =>
    Boolean(entry[1] && !/待补齐|待核对/.test(entry[1])),
  )
  const alternativesPanelPrefix = useId()
  const [expandedAlternativeId, setExpandedAlternativeId] = useState<string | null>(null)

  return (
    <aside className="warehouse-action-drawer" aria-labelledby="warehouse-action-drawer-title">
      <div className="warehouse-action-drawer__top">
        <div className="warehouse-action-drawer__toolbar">
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
                data-disc-step="previous"
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
                data-disc-step="next"
                onClick={navigation.onNext}
              >
                下一张
              </button>
            </nav>
          ) : null}
        </div>
        <header className="warehouse-action-drawer__identity">
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
              {sameKindCount > 1 ? ` · 同款共 ${sameKindCount} 张` : ''}
              {!stale && (item.cleanupAssessment?.betterSameClassCount ?? 0) > 0
                ? ` · 同类已有 ${item.cleanupAssessment?.betterSameClassCount} 张更优`
                : ''}
            </p>
          </div>
        </header>
      </div>
      <div className="warehouse-action-drawer__content">
        {setEffects.length ? (
          <section
            className="warehouse-action-drawer__section warehouse-action-drawer__set-effects"
            aria-label="套装效果"
          >
            <div className="warehouse-action-drawer__section-heading">
              <h3>套装效果</h3>
            </div>
            {setEffects.map(([label, effect]) => (
              <p key={label}>
                <strong>{label}</strong>
                <EffectDescription text={effect} />
              </p>
            ))}
          </section>
        ) : null}
        <section
          className="warehouse-action-drawer__section warehouse-action-drawer__key-facts"
          aria-label="当前盘词条"
        >
          <div className="warehouse-action-drawer__section-heading">
            <h3>盘面词条</h3>
            <span>+{disc.level}</span>
          </div>
          <dl className="warehouse-action-drawer__stats warehouse-action-drawer__main-stat-list">
            <div className="warehouse-action-drawer__main-stat">
              <dt>主词条</dt>
              <dd>
                {statLabel(disc.mainStat)} · {displayDiscMainValue(disc)}
              </dd>
            </div>
          </dl>
          {disc.subStats.length ? (
            <dl
              className="warehouse-action-drawer__stats warehouse-action-drawer__substats"
              aria-label="副词条"
            >
              {disc.subStats.map((substat) => (
                <div className="warehouse-action-drawer__substat" key={substat.stat}>
                  <dt>{statLabel(substat.stat)}</dt>
                  <dd>
                    <span className="warehouse-action-drawer__substat-value">
                      {formatRecordedDiscStatValue(substat.stat, substat.value)}
                    </span>
                    {subStatHistory.status === 'known' ? (
                      <span className="warehouse-action-drawer__substat-enhancement">
                        强化 {substat.upgrades} 次
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="warehouse-action-drawer__empty-substats">副词条未记录</p>
          )}
        </section>
        <div className="warehouse-action-drawer__decision-stack">
          <WarehouseActionNextStep
            item={item}
            decisionLabel={decisionLabel}
            discLevel={disc.level}
            onReanalyze={onReanalyze}
          />
          {!nextStep &&
          !needsRecheck &&
          !stale &&
          (!item.absoluteRetention || item.reviewBasis === 'no_current_fit') ? (
            <section className="warehouse-action-drawer__decision">
              {!stale && !item.absoluteRetention && item.action === 'cleanup' && decisionReason ? (
                <p className="warehouse-action-drawer__decision-summary">
                  <EffectDescription text={decisionReason} />
                </p>
              ) : null}
              <div className="warehouse-action-drawer__section-heading">
                {!item.absoluteRetention || stale ? (
                  <p className="warehouse-action-drawer__action">
                    {stale ? decisionFreshnessPresentation('stale').label : decisionLabel}
                  </p>
                ) : null}
                {!item.absoluteRetention &&
                (explanationReasons.length > 0 ||
                  (!stale && item.reviewBasis === 'no_current_fit' && !decisionReason)) ? (
                  <ExplanationPopover
                    label="判断依据"
                    title={stale ? '分析时的判断依据' : '判断依据'}
                  >
                    {explanationReasons.length > 0 ? (
                      <ul>
                        {explanationReasons.map((reason) => (
                          <li key={reason}>
                            <EffectDescription text={reason} />
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
              {!stale && !item.absoluteRetention && item.developmentAdvice ? (
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
          ) : null}
          {item.absoluteRetention && !stale && !nextStep && !needsRecheck ? (
            <WarehouseRetentionEvidence
              evidence={item.absoluteRetention}
              discLevel={disc.level}
              disc={disc}
              ownedAgentIds={ownedAgentIds}
              showRoles={false}
            />
          ) : null}
        </div>
        {savedUses.length ||
        (retentionAgentIds.length && !item.absoluteRetention) ||
        item.affectedTeams.length ? (
          <section className="warehouse-action-drawer__section warehouse-action-drawer__usage-section">
            <WarehouseSavedUsagePopover references={savedUses} />
            {!item.usageAgentIds.length && item.affectedPlans.length && relations.length ? (
              <p>方案已引用，未记录具体分配代理人。</p>
            ) : null}
            {retentionAgentIds.length && !item.absoluteRetention ? (
              <p aria-label="具体保留用途">
                可能的保留用途：{retentionAgentIds.slice(0, 3).map(readableAgentName).join('、')}
                {retentionAgentIds.length > 3 ? `等 ${retentionAgentIds.length} 位` : ''}。
                {item.retentionBasis === 'other_agent_fit' ? '可作为尚未拥有角色的备选盘。' : null}
              </p>
            ) : null}
            {item.affectedTeams.length ? (
              <div className="warehouse-action-drawer__team-impact">
                <h4>队伍影响</h4>
                <ul>
                  {item.affectedTeams.map((team) => (
                    <li key={team.planId ?? team.candidateId}>
                      <span>{team.memberIds.map(readableAgentName).join('、')}</span>
                      {team.decisionAuthority
                        ? ` · ${teamRatingSummary(team.decisionAuthority.teamRating)}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
        <section
          className="warehouse-action-drawer__section warehouse-action-drawer__comparison-section"
          data-fact-comparison={comparisonFact ? '' : undefined}
          tabIndex={comparisonFact ? -1 : undefined}
        >
          <div className="warehouse-action-drawer__section-heading">
            <h3>其他用途与比较</h3>
            <ExplanationPopover label="用途说明">
              <p>同类盘的套装、号位和主词条相同。列表还包含替换盘和强化后可比较的盘。</p>
              {retentionAgentIds.length > 3 ? (
                <p>保留用途：{retentionAgentIds.map(readableAgentName).join('、')}。</p>
              ) : null}
              {!item.absoluteRetention &&
              !retainedUsesCoverCompatibility &&
              item.compatibleAgentIds.length > 3 ? (
                <p>
                  {compatibilityLabel}：{item.compatibleAgentIds.map(readableAgentName).join('、')}
                  。
                </p>
              ) : null}
              {alternatives.some((alternative) => developmentIds.has(alternative.id)) ? (
                <p>“强化后比较”使用同一成长条件估算，最终以游戏内强化结果为准。</p>
              ) : null}
              {!stale && item.retentionReview === 'low_effective_rolls' ? (
                <p>已无可强化次数，需结合主词条、套装和实际用途复核。</p>
              ) : null}
            </ExplanationPopover>
          </div>
          {comparisonOrigin || comparisonFact ? (
            <DiscAttributeComparison
              key={`${comparisonOrigin?.disc.id ?? disc.id}:${comparisonFact?.id ?? disc.id}`}
              original={comparisonOrigin?.disc ?? disc}
              candidate={comparisonFact ?? disc}
            />
          ) : null}
          {!stale && item.retentionReview === 'low_effective_rolls' ? (
            <p role="status" className="warehouse-action-drawer__notice">
              <strong>有效词条偏少，先核对主词条、套装和用途；仅优先复核，不构成清理依据。</strong>
            </p>
          ) : null}
          {alternatives.length ? (
            <div className="warehouse-action-drawer__comparison-picker">
              <ul className="warehouse-alternatives" aria-label="可比较盘">
                {alternatives.map((alternative) => {
                  const physicalIdentity = readablePhysicalDiscLabel(alternative, discs)
                  const recommendation =
                    comparisonItem.recommendationState === 'stale'
                      ? undefined
                      : alternativeRecommendations?.get(alternative.id)
                  const sameKind =
                    alternative.setId === comparisonDisc.setId &&
                    alternative.slot === comparisonDisc.slot &&
                    alternative.mainStat === comparisonDisc.mainStat
                  const displayOrdinal = sameKind
                    ? displayedSameKindOrdinals.get(alternative.id)
                    : undefined
                  const identity =
                    sameKind && displayOrdinal
                      ? physicalIdentity.replace(/同类第\d+张/u, `同类第${displayOrdinal}张`)
                      : physicalIdentity
                  const ordinal = displayOrdinal ? `同类第${displayOrdinal}张` : undefined
                  const expanded = expandedAlternativeId === alternative.id
                  const panelId = `${alternativesPanelPrefix}-${alternative.id}`
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
                          {!sameKind ? `${statLabel(alternative.mainStat)} · ` : ''}+
                          {alternative.level}
                          {!sameKind && ordinal ? ` · ${ordinal}` : ''}
                          {replacementIds.has(alternative.id)
                            ? ' · 已证可替代'
                            : developmentIds.has(alternative.id)
                              ? ' · 强化后比较'
                              : ' · 同类比较'}
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
                      {recommendation ? (
                        <span
                          className="warehouse-alternative__status"
                          data-priority={recommendation.prioritize || undefined}
                        >
                          {recommendation.label}
                        </span>
                      ) : null}
                    </>
                  )
                  return (
                    <li key={alternative.id}>
                      <div className="warehouse-alternative__item">
                        <button
                          className="warehouse-alternative__summary"
                          type="button"
                          aria-current={alternative.id === disc.id ? 'true' : undefined}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          data-alternative-id={alternative.id}
                          aria-label={`${expanded ? '收起' : '展开'}${identity}的驱动盘卡${recommendation ? `，${recommendation.label}` : ''}`}
                          onClick={() =>
                            setExpandedAlternativeId((current) =>
                              current === alternative.id ? null : alternative.id,
                            )
                          }
                        >
                          {content}
                          <ChevronDown
                            className="warehouse-alternative__chevron"
                            size={16}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      {expanded ? (
                        <div
                          id={panelId}
                          className="warehouse-alternative__card"
                          aria-label={`${identity}驱动盘卡`}
                        >
                          <DevelopmentDiscCard
                            disc={presentDiscFactFromChoice({
                              agentId: 'warehouse-same-kind-comparison',
                              choice: null,
                              disc: alternative,
                              set: readableSetName(alternative.setId),
                              mainValue: displayDiscMainValue(alternative),
                            })}
                            changed={null}
                            consumer="warehouse.action-list"
                            conflictContext="equipment_or_plan"
                          />
                          {onSelectAlternative ? (
                            <button
                              className="button button--quiet"
                              type="button"
                              onClick={() => onSelectAlternative(alternative.id)}
                            >
                              对比这张盘
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p>
              {missingAlternativeDiscIds.length
                ? '替代盘资料不完整，暂时无法比对。'
                : comparisonOrigin
                  ? '已显示这张盘与原盘的属性差异。'
                  : '暂无其他同类盘可比较。'}
            </p>
          )}
          {!item.absoluteRetention &&
          !retainedUsesCoverCompatibility &&
          compatibleOnlyAgentIds.length ? (
            <p className="warehouse-action-drawer__other-uses">
              {compatibleOnlyAgentIds.length
                ? `${item.absoluteRetention ? '其他保留潜力' : '其他适用角色'}：${compatibleOnlyAgentIds.slice(0, 3).map(readableAgentName).join('、')}${compatibleOnlyAgentIds.length > 3 ? `等 ${compatibleOnlyAgentIds.length} 位` : ''}`
                : `暂未确认${compatibilityLabel}。`}
            </p>
          ) : null}
        </section>
        {item.absoluteRetention && !stale ? (
          <WarehouseRetentionEvidence
            key={disc.id}
            evidence={item.absoluteRetention}
            discLevel={disc.level}
            disc={disc}
            ownedAgentIds={ownedAgentIds}
            showRecommendation={false}
            showSecondaryReason={Boolean(
              nextStep && item.finalRecommendation?.basis === 'explicit_protection',
            )}
          />
        ) : null}
      </div>
    </aside>
  )
}
