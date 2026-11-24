import type { WarehouseActionItem } from '../application/warehouseActionProjection'
import type { WarehouseActionNextStep as WarehouseActionNextStepContract } from '../application/warehouseActionContract'
import { EffectDescription } from '../components/EffectDescription'
import { playerRetentionCopy, readableDetail } from './warehouseRetentionCopy'
import { decisionFreshnessPresentation } from '../application/playerDecisionPresentation'
import {
  hasFavoriteOnlyProtection,
  needsWarehouseDecisionRecheck,
  playerFacingNextStep,
} from './warehouseActionGuidanceModel'

function stopInstruction(
  item: WarehouseActionItem,
  nextStep: WarehouseActionNextStepContract | undefined,
) {
  if (!nextStep || item.recommendationState === 'stale') return null
  if (nextStep.kind === 'try_upgrade' && nextStep.targetLevel !== null)
    return '强化后重新分析；没有改善就停手。'
  return null
}

export function WarehouseActionNextStep({
  item,
  decisionLabel,
  discLevel,
  onReanalyze,
}: {
  item: WarehouseActionItem
  decisionLabel: string
  discLevel: number
  onReanalyze?: () => void
}) {
  const stale = item.recommendationState === 'stale'
  const protectedFavorite = hasFavoriteOnlyProtection(item)
  const needsRecheck = !protectedFavorite && needsWarehouseDecisionRecheck(item)
  const nextStep = playerFacingNextStep(item)
  if (needsRecheck && !stale)
    return (
      <section className="warehouse-action-drawer__decision" aria-label="当前建议与下一步">
        <div className="warehouse-action-drawer__decision-heading">
          <span>当前建议</span>
          <strong>继续观察</strong>
        </div>
        <p>先保留，暂不继续强化。</p>
        {onReanalyze ? (
          <button className="button button--primary" type="button" onClick={onReanalyze}>
            重新分析
          </button>
        ) : null}
      </section>
    )
  const nextStepLabel =
    nextStep?.kind === 'try_upgrade'
      ? nextStep.targetLevel === null
        ? '继续观察投入价值'
        : `先强化到 +${nextStep.targetLevel}，再看结果`
      : nextStep?.kind === 'reanalyze'
        ? '重新分析后再判断'
        : nextStep?.kind === 'check_condition'
          ? '先确认这项用途需要的队伍或配装条件'
          : nextStep?.kind === 'complete_data'
            ? ''
            : nextStep?.kind === 'review_quality'
              ? '先核对词条与套装的可用方向'
              : nextStep?.kind === 'manual_cleanup'
                ? '确认没有装备或方案引用后再清理'
                : '保留这张盘，无需继续强化'
  const reason = stale
    ? decisionFreshnessPresentation('stale').detail
    : !protectedFavorite &&
        item.absoluteRetention &&
        item.finalRecommendation?.basis !== 'explicit_protection'
      ? playerRetentionCopy(item.absoluteRetention, discLevel).explanation
      : nextStep
        ? readableDetail(nextStep.detail)
        : ''
  const stop = stopInstruction(item, nextStep)

  return (
    <>
      {nextStep || stale ? (
        <section className="warehouse-action-drawer__decision" aria-label="当前建议与下一步">
          <div className="warehouse-action-drawer__decision-heading">
            <span>{stale ? '分析状态' : '当前建议'}</span>
            <strong className="warehouse-action-drawer__action">
              {stale
                ? decisionFreshnessPresentation('stale').label
                : protectedFavorite
                  ? '建议保留'
                  : decisionLabel}
            </strong>
          </div>
          {reason ? (
            <p>
              {stale ? '当前建议已失效。' : ''}
              <EffectDescription text={reason} />
            </p>
          ) : null}
          {!stale &&
          nextStep &&
          !['keep', 'manual_cleanup', 'check_condition', 'complete_data'].includes(
            nextStep.kind,
          ) ? (
            <p>{nextStepLabel}</p>
          ) : null}
          {stop ? <p>{stop}</p> : null}
          {stale && onReanalyze ? (
            <button className="button button--primary" type="button" onClick={onReanalyze}>
              重新分析
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
