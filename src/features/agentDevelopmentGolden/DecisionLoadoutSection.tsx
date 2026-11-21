import { useRef, useState } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import {
  warehouseActionFeedback,
  type WarehouseMatchFeedback,
} from '../../application/warehouseMatchFeedback'
import { WarehouseMatchMessage } from '../../components/WarehouseMatchMessage'
import { usePageOperationScope } from '../../components/usePageOperationScope'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { DevelopmentDiscCard } from './DevelopmentDiscCard'
import './DecisionLoadoutSection.css'
import type {
  AgentDevelopmentGoldenProps,
  GoldenWorkbenchData,
  JourneyScenario,
  WarehouseAnalysisIntent,
} from './types'

const sixDiscSlots = [1, 2, 3, 4, 5, 6] as const

type LoadoutState = 'saved' | 'candidate' | 'plan' | 'actual' | 'empty'

function loadoutPresentation(subject: GoldenWorkbenchData) {
  const state: LoadoutState =
    subject.mode === 'saved'
      ? 'saved'
      : subject.discSource === '仓库候选'
        ? 'candidate'
        : subject.discSource === '当前方案'
          ? 'plan'
          : subject.discs.length
            ? 'actual'
            : 'empty'
  const label = state === 'saved' ? '已保存方案' : state === 'plan' ? '当前方案' : null
  return { state, label }
}

function planIdentity(subject: GoldenWorkbenchData) {
  return JSON.stringify([
    subject.agentId,
    subject.saveScopeKey,
    subject.selectedCandidateRank,
    subject.discs.map((disc) => [disc.slot, disc.id]),
    subject.level,
    subject.mindscape,
    subject.skills,
    subject.engine.currentId,
  ])
}

function DecisionLoadoutSectionContent({
  subject,
  scenario,
  toTop10,
  onContinueOptimization,
  onSavePlan,
  onAnalyzeWarehouse,
  onCancelWarehouseAnalysis,
}: {
  subject: GoldenWorkbenchData
  scenario: JourneyScenario
  toTop10: () => void
  onContinueOptimization?: () => void
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onAnalyzeWarehouse?: AgentDevelopmentGoldenProps['onAnalyzeWarehouse']
  onCancelWarehouseAnalysis?: AgentDevelopmentGoldenProps['onCancelWarehouseAnalysis']
}) {
  const routed = useInRouterContext()
  const [savedPlanKey, setSavedPlanKey] = useState<string | null>(null)
  const [savingPlanScope, setSavingPlanScope] = useState<string | null>(null)
  const [savePlanErrorState, setSavePlanError] = useState<{
    scope: string
    message: string
  } | null>(null)
  const [savePlanNotice, setSavePlanNotice] = useState<{
    planKey: string
    message: string
    savedPlanId?: string
  } | null>(null)
  const [warehouseAction, setWarehouseAction] = useState<{
    agentId: string
    state: 'idle' | 'running' | 'cancelled' | 'error'
    error: WarehouseMatchFeedback | null
  }>({ agentId: subject.agentId, state: 'idle', error: null })
  const warehouseRequestRunning = useRef<{ agentId: string; token: symbol } | null>(null)
  const captureActionScope = usePageOperationScope(subject.panelScopeKey ?? subject.agentId)
  const discResultsRef = useRef<HTMLDivElement>(null)
  const { state: loadoutState, label: loadoutStateLabel } = loadoutPresentation(subject)
  const isSavedView = subject.mode === 'saved'
  const canCompare = subject.hasComparablePlan
  const planKey = planIdentity(subject)
  const captureSaveScope = usePageOperationScope(planKey)
  const savingPlan = savingPlanScope === planKey
  const savePlanError = savePlanErrorState?.scope === planKey ? savePlanErrorState.message : null
  const planSaved = savedPlanKey === planKey
  const warehouseActionState =
    warehouseAction.agentId === subject.agentId ? warehouseAction.state : 'idle'
  const warehouseActionError =
    warehouseAction.agentId === subject.agentId ? warehouseAction.error : null
  const discsBySlot = new Map(
    subject.discs
      .filter((disc) => disc.slot >= 1 && disc.slot <= 6)
      .map((disc) => [disc.slot, disc] as const),
  )

  useStateTransitionMotion({
    scope: discResultsRef,
    stateKey: `${subject.agentId}:${subject.discs.map((disc) => disc.id).join('|')}`,
    target: '.disc-card',
    enabled: warehouseActionState !== 'running',
    transition: 'result',
  })

  const cancelWarehouseAnalysis = () => {
    if (warehouseRequestRunning.current?.agentId !== subject.agentId) return
    warehouseRequestRunning.current = null
    onCancelWarehouseAnalysis?.()
    setWarehouseAction({ agentId: subject.agentId, state: 'cancelled', error: null })
  }

  const runWarehouseAnalysis = async (intent: WarehouseAnalysisIntent) => {
    if (!onAnalyzeWarehouse || warehouseRequestRunning.current?.agentId === subject.agentId) return
    const isCurrentAction = captureActionScope()
    const token = Symbol()
    warehouseRequestRunning.current = { agentId: subject.agentId, token }
    setWarehouseAction({ agentId: subject.agentId, state: 'running', error: null })
    setSavedPlanKey(null)
    setSavePlanError(null)
    try {
      await onAnalyzeWarehouse(intent)
      if (!isCurrentAction() || warehouseRequestRunning.current?.token !== token) return false
      setWarehouseAction({ agentId: subject.agentId, state: 'idle', error: null })
      return true
    } catch (error) {
      if (!isCurrentAction() || warehouseRequestRunning.current?.token !== token) return false
      if (error instanceof Error && error.name === 'AbortError') {
        setWarehouseAction({ agentId: subject.agentId, state: 'cancelled', error: null })
        return false
      }
      setWarehouseAction({
        agentId: subject.agentId,
        state: 'error',
        error: warehouseActionFeedback(error),
      })
      return false
    } finally {
      if (warehouseRequestRunning.current?.token === token) warehouseRequestRunning.current = null
    }
  }

  const savePlan = async () => {
    if (!onSavePlan || savingPlan) return
    const isCurrentAction = captureSaveScope()
    setSavingPlanScope(planKey)
    setSavePlanError(null)
    try {
      const result = await onSavePlan(subject.selectedCandidateRank)
      if (!isCurrentAction()) return
      setSavedPlanKey(planKey)
      setSavePlanNotice({
        planKey,
        message:
          result && result.refreshPending
            ? '方案已保存，但匹配结果暂未更新，请稍后重新匹配。'
            : '已保存到 Soda；游戏内装备未改动。',
        savedPlanId: result ? result.savedPlanId : undefined,
      })
    } catch (error) {
      if (!isCurrentAction()) return
      setSavePlanError({
        scope: planKey,
        message: playerErrorMessage(error, '保存失败，请稍后重试。'),
      })
    } finally {
      if (isCurrentAction()) setSavingPlanScope(null)
    }
  }

  return (
    <section
      className={`disc-section disc-section--workbench decision-loadout-result is-${loadoutState}`}
      aria-labelledby="workbench-discs-title"
      data-loadout-state={loadoutState}
    >
      <header className="disc-workbench-header decision-loadout-result__header">
        <div className="disc-workbench-title decision-loadout-result__title">
          <h3 id="workbench-discs-title">
            {isSavedView ? '已保存配装' : '驱动盘'}{' '}
            <span>
              · {loadoutState === 'actual' ? '当前装备 · ' : ''}
              {subject.discs.length} / 6{isSavedView ? ' 张驱动盘' : ''}
            </span>
          </h3>
          {loadoutStateLabel ? (
            <span className={`disc-loadout-state is-${loadoutState}`}>{loadoutStateLabel}</span>
          ) : null}
        </div>

        <div className="disc-workbench-metrics" aria-label="方案指标">
          <span className="disc-metric">
            <small>配装评分</small>
            <strong>{subject.warehouseAnalysis.totalScore ?? '—'}</strong>
          </span>
          {subject.warehouseAnalysis.effectiveEnhancements !== undefined &&
          subject.warehouseAnalysis.effectiveLines !== undefined ? (
            <span className="disc-metric">
              <small>有效副属性</small>
              <strong>
                {subject.warehouseAnalysis.effectiveEnhancements +
                  subject.warehouseAnalysis.effectiveLines}{' '}
                次命中
              </strong>
            </span>
          ) : null}
          {subject.warehouseAnalysis.replacementCount !== undefined && (
            <span className="disc-metric">
              <small>替换数量</small>
              <strong>{`${subject.warehouseAnalysis.replacementCount} / 6`}</strong>
            </span>
          )}
        </div>

        <div className="disc-workbench-actions decision-loadout-result__actions">
          {isSavedView && (
            <button
              type="button"
              className="button button--quiet"
              onClick={onContinueOptimization}
              disabled={!onContinueOptimization}
            >
              继续优化配装
            </button>
          )}
          <button
            className="warehouse-action warehouse-action--primary button primary"
            data-player-route={`/development/${subject.agentId}/loadouts`}
            type="button"
            disabled={
              savingPlan ||
              warehouseActionState === 'running' ||
              (!canCompare && !onAnalyzeWarehouse)
            }
            onClick={async () => {
              if (canCompare || (await runWarehouseAnalysis('compare'))) toTop10()
            }}
          >
            {canCompare || isSavedView
              ? '比较其他配装'
              : subject.warehouseAnalysis.status === 'idle'
                ? '从仓库搭配并比较'
                : '重新搭配并比较'}
          </button>
          {canCompare ? (
            <div className="warehouse-actions">
              <button
                className="warehouse-action warehouse-action--secondary"
                type="button"
                disabled={savingPlan || warehouseActionState === 'running'}
                onClick={() => void runWarehouseAnalysis('generate')}
              >
                {warehouseActionState === 'running' ? '搭配中…' : '重新搭配'}
              </button>
            </div>
          ) : null}
          {!canCompare && !isSavedView ? (
            <button
              className="warehouse-action warehouse-action--secondary"
              type="button"
              disabled={!onAnalyzeWarehouse || warehouseActionState === 'running'}
              onClick={() => void runWarehouseAnalysis('generate')}
            >
              {warehouseActionState === 'running'
                ? '正在搭配…'
                : subject.warehouseAnalysis.status === 'idle'
                  ? '仅生成搭配'
                  : '重新从仓库搭配'}
            </button>
          ) : null}
          {!isSavedView && (onSavePlan || !canCompare || savingPlan) ? (
            <button
              className="primary save-plan-action"
              type="button"
              disabled={
                !canCompare || !onSavePlan || savingPlan || warehouseActionState === 'running'
              }
              onClick={savePlan}
            >
              {savingPlan
                ? '正在保存…'
                : !canCompare
                  ? '暂无可保存方案'
                  : scenario === 'save-recovery'
                    ? '继续保存配装'
                    : scenario === 'stale'
                      ? '刷新并重算'
                      : planSaved
                        ? '这套配装已保存'
                        : '保存配装'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="decision-loadout-result__feedback" aria-live="polite">
        {warehouseActionState === 'running' ? (
          <div className="warehouse-analysis-running" role="status">
            <span>正在从仓库搭配六张驱动盘…</span>
            <button
              className="button button--quiet"
              type="button"
              onClick={cancelWarehouseAnalysis}
            >
              取消搭配
            </button>
          </div>
        ) : warehouseActionState === 'cancelled' ? (
          <span role="status">已取消搭配，已保留当前配装。</span>
        ) : warehouseActionError ? (
          <div className="warehouse-match-feedback" role="status">
            <WarehouseMatchMessage feedback={warehouseActionError} />
            {routed ? (
              <Link className="button button--quiet" to="/assets/discs">
                查看仓库
              </Link>
            ) : (
              <a className="button button--quiet" href="/assets/discs">
                查看仓库
              </a>
            )}
          </div>
        ) : subject.warehouseAnalysis.inventoryTransition ||
          (!isSavedView && subject.warehouseAnalysis.status === 'unavailable') ? (
          <span className="analysis-state-copy">{subject.warehouseAnalysis.summary}</span>
        ) : null}
        {savePlanError ? (
          <span className="warehouse-action-feedback" role="alert">
            {savePlanError}
          </span>
        ) : null}
        {savePlanNotice?.planKey === planKey ? (
          <span className="development-save-success" role="status" aria-live="polite">
            {savePlanNotice.message}
            {savePlanNotice.savedPlanId && routed ? (
              <>
                {' '}
                <Link
                  to={`/development/${subject.agentId}?plan=${encodeURIComponent(savePlanNotice.savedPlanId)}`}
                >
                  查看已保存方案
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
        {!isSavedView && subject.candidateDifferences?.length ? (
          <p className="disc-main-stat-differences" role="status" aria-label="与推荐主词条的差异">
            {subject.candidateDifferences.join('；')}
          </p>
        ) : null}
        {scenario === 'empty-discs' && discsBySlot.size < 6 ? (
          <span className="empty-discs" role="status">
            当前已记录 {discsBySlot.size} / 6 张驱动盘；补齐盘位后可比较完整方案。
          </span>
        ) : null}
      </div>

      <div
        className="disc-grid decision-loadout-result__grid"
        ref={discResultsRef}
        aria-busy={warehouseActionState === 'running'}
        data-loadout-state={loadoutState}
      >
        {sixDiscSlots.map((slot) => {
          const disc = discsBySlot.get(slot)
          return disc ? (
            <DevelopmentDiscCard key={slot} disc={disc} showGrade={false} />
          ) : (
            <article
              className="disc-card development-disc-empty-slot"
              data-slot={slot}
              data-result-layer={slot}
              key={slot}
              aria-label={`${slot}号位，未记录驱动盘`}
            >
              <header>
                <span>{slot}号位</span>
                <small>未记录</small>
              </header>
              <div aria-hidden="true">
                <span className="development-disc-empty-slot__mark">+</span>
              </div>
              <strong>未记录装备</strong>
              <p>{slot}号盘属性待记录</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function DecisionLoadoutSection(props: Parameters<typeof DecisionLoadoutSectionContent>[0]) {
  return (
    <DecisionLoadoutSectionContent
      key={`${props.subject.panelScopeKey ?? ''}:${props.subject.agentId}`}
      {...props}
    />
  )
}
