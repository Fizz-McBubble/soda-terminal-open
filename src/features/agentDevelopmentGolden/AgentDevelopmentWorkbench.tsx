import { useEffect, useRef, useState } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import {
  warehouseActionFeedback,
  type WarehouseMatchFeedback,
} from '../../application/warehouseMatchFeedback'
import { WarehouseMatchMessage } from '../../components/WarehouseMatchMessage'
import { DevelopmentDiscCard } from './DevelopmentDiscCard'
import { WorkbenchPanelSnapshot } from './WorkbenchPanelSnapshot'
import { DevelopmentDiscGuide } from './DevelopmentDiscGuide'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { AgentVisualSlot } from './agentVisualSlot'
import { BackNavigation } from '../../components/BackNavigation'
import { usePageOperationScope } from '../../components/usePageOperationScope'
import { specialtyIconIds, presentationTargetLevel } from './agentDevelopmentWorkbenchPresentation'
import type { AgentDevelopmentGoldenProps, GoldenWorkbenchData, JourneyScenario } from './types'
export function Workbench({
  toOverview,
  toTop10,
  onContinueOptimization,
  scenario,
  data,
  onSavePlan,
  onEditCurrent,
  currentUpdate,
  onAnalyzeWarehouse,
}: {
  toOverview: () => void
  toTop10: () => void
  onContinueOptimization?: () => void
  scenario: JourneyScenario
  data: GoldenWorkbenchData
  onEditCurrent?: () => void
  currentUpdate?: AgentDevelopmentGoldenProps['currentUpdate']
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onAnalyzeWarehouse?: AgentDevelopmentGoldenProps['onAnalyzeWarehouse']
}) {
  const routed = useInRouterContext()
  const [savedPlanKey, setSavedPlanKey] = useState<string | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [savePlanError, setSavePlanError] = useState<string | null>(null)
  const [warehouseAction, setWarehouseAction] = useState<{
    agentId: string
    state: 'idle' | 'running' | 'error'
    error: WarehouseMatchFeedback | null
  }>({ agentId: data.agentId, state: 'idle', error: null })
  const warehouseActionState =
    warehouseAction.agentId === data.agentId ? warehouseAction.state : 'idle'
  const warehouseActionError =
    warehouseAction.agentId === data.agentId ? warehouseAction.error : null
  const warehouseRequestRunning = useRef<{ agentId: string; token: symbol } | null>(null)
  const captureActionScope = usePageOperationScope(data.agentId)
  const workbenchRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const owner = workbenchRef.current?.closest<HTMLElement>('[data-f5-scroll-owner]')
    if (owner) owner.scrollTop = 0
  }, [data.agentId])
  const subject = data
  const discResultsRef = useRef<HTMLDivElement>(null)
  useStateTransitionMotion({
    scope: discResultsRef,
    stateKey: subject.discs.map((disc) => disc.id).join('|'),
    includeScope: true,
    enabled: warehouseActionState !== 'running',
  })
  const planKey = JSON.stringify([
    subject.agentId,
    subject.selectedCandidateRank,
    subject.discs.map((disc) => [disc.slot, disc.id]),
    subject.level,
    subject.mindscape,
    subject.skills,
    subject.engine.currentId,
  ])
  const planSaved = savedPlanKey === planKey
  const isSavedView = subject.mode === 'saved'
  const canCompare = subject.hasComparablePlan
  const specialtyIcon = specialtyIconIds[subject.specialty]
  const currentRecommendedEngine = subject.graduation.engines.find(
    (engine) =>
      Boolean(engine.visual?.entityId) &&
      engine.visual?.entityId === (subject.engine.currentId ?? subject.engine.visual?.entityId),
  )
  const runWarehouseAnalysis = async () => {
    if (!onAnalyzeWarehouse || warehouseRequestRunning.current?.agentId === data.agentId) return
    const isCurrentAction = captureActionScope()
    const token = Symbol()
    warehouseRequestRunning.current = { agentId: data.agentId, token }
    setWarehouseAction({ agentId: data.agentId, state: 'running', error: null })
    setSavedPlanKey(null)
    setSavePlanError(null)
    try {
      await onAnalyzeWarehouse()
      if (!isCurrentAction()) return
      setWarehouseAction({ agentId: data.agentId, state: 'idle', error: null })
      return true
    } catch (error) {
      if (!isCurrentAction()) return
      setWarehouseAction({
        agentId: data.agentId,
        state: 'error',
        error: warehouseActionFeedback(error),
      })
    } finally {
      if (warehouseRequestRunning.current?.token === token) warehouseRequestRunning.current = null
    }
  }
  return (
    <section
      ref={workbenchRef}
      className="workbench workbench--single-page"
      aria-labelledby="workbench-title"
    >
      <aside className="agent-scene">
        <BackNavigation
          label="返回养成"
          className="back-navigation--overlay"
          onClick={toOverview}
        />
        <div className="agent-identity">
          <div className="agent-identity__name-line">
            <span className={`rarity rarity--${subject.rarity.toLowerCase()} large`}>
              {subject.rarity}
            </span>
            <h1 id="workbench-title">{subject.name}</h1>
          </div>
          <p>
            {specialtyIcon ? (
              <span className="agent-identity__trait-icon" title={specialtyIcon.name}>
                <VisualEntityImage
                  entityType="illustration"
                  entityId={specialtyIcon.entityId}
                  variant="icon"
                  name={specialtyIcon.name}
                />
              </span>
            ) : (
              subject.specialty
            )}{' '}
            · {subject.mindscape} 影 · Lv.{subject.level} <small>/ 60</small>
          </p>
        </div>
        <AgentVisualSlot
          className="agent-art"
          slot="hero-agent"
          agentId={subject.agentId}
          name={subject.name}
        />
      </aside>
      <div className="workbench-main">
        <section className="current-overview" aria-label="当前状态与当前面板">
          <section className="current-overview__state" aria-labelledby="current-title">
            <header>
              <div>
                <h2 id="current-title">当前状态</h2>
              </div>
              <div className="current-state-actions">
                {subject.graduation.engineConditions?.length ? (
                  <ExplanationPopover label="音擎说明" title="音擎适用条件">
                    {subject.graduation.engineConditions.map((condition) => (
                      <p key={condition}>{condition}</p>
                    ))}
                  </ExplanationPopover>
                ) : null}
                <span className="account-fact current-level-fact">
                  <b>
                    Lv.{subject.level} · {subject.mindscape} 影
                  </b>
                </span>
                {currentUpdate && (
                  <span role="status" title={currentUpdate.detail}>
                    {currentUpdate.message}
                    {currentUpdate.onRetry && (
                      <button type="button" className="text-action" onClick={currentUpdate.onRetry}>
                        重试
                      </button>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  className="edit-current"
                  onClick={onEditCurrent}
                  disabled={!onEditCurrent}
                >
                  编辑当前状态
                </button>
              </div>
            </header>
            <div className="current-status-details">
              <div className="skill-comparison__current">
                <small>当前技能</small>
                <div>
                  {subject.skills.map((skill) => (
                    <span key={skill.label}>
                      <i>{skill.short}</i>
                      <b>{skill.value ?? '—'}</b>
                    </span>
                  ))}
                </div>
              </div>
              <section className="skill-comparison__target" aria-label="技能推荐等级">
                <small id="skill-target-title">推荐等级</small>
                <div>
                  {subject.graduation.skills.map((skill) => (
                    <span className={skill.priority ? 'priority' : undefined} key={skill.label}>
                      <small>{skill.label}</small>
                      <b title={skill.nextLevel?.tooltip ?? skill.recommended}>
                        {presentationTargetLevel(skill.recommended)}
                      </b>
                    </span>
                  ))}
                </div>
              </section>
              {subject.graduation.potentialSkillReference ? (
                <section
                  className="skill-comparison__target"
                  aria-label={subject.graduation.potentialSkillReference.conditionLabel}
                >
                  <small>{subject.graduation.potentialSkillReference.conditionLabel}</small>
                  <div>
                    {subject.graduation.potentialSkillReference.skills.map((skill) => (
                      <span key={skill.label}>
                        <small>{skill.label}</small>
                        <b>{presentationTargetLevel(skill.recommended)}</b>
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
              <section
                className={`current-engine-plan${currentRecommendedEngine ? ' current-engine-plan--merged' : ''}`}
                aria-label="当前音擎与推荐"
              >
                {!currentRecommendedEngine && (
                  <div className="current-engine-plan__actual">
                    {subject.engine.visual ? (
                      <VisualEntityImage
                        className="recommendation-item-icon"
                        entityType="wengine"
                        entityId={subject.engine.visual.entityId}
                        name={subject.engine.visual.name}
                        slotId="wengine.equipment-icon"
                        consumer="agent-development.workbench"
                      />
                    ) : (
                      <span className="engine__fallback" aria-hidden="true" />
                    )}
                    <span>
                      <small id="engine-plan-title">当前</small>
                      <b>{subject.engine.name}</b>
                    </span>
                  </div>
                )}
                <ol className="current-engine-plan__options">
                  {subject.graduation.engines.map((engine) => {
                    const isCurrent =
                      engine === currentRecommendedEngine || Boolean(engine.isCurrent)
                    const tierLabel =
                      engine.tier === '首选'
                        ? '首选'
                        : engine.tier === '替代' ||
                            engine.tier === 'S级替代' ||
                            engine.tier === 'A级下位替代'
                          ? '替代'
                          : engine.tier === '下位'
                            ? '下位'
                            : '备选'
                    return (
                      <li key={`${engine.tier}:${engine.name}`}>
                        <small>
                          {isCurrent ? '当前 · ' : ''}
                          {tierLabel}
                        </small>
                        {engine.visual ? (
                          <VisualEntityImage
                            className="recommendation-item-icon"
                            entityType="wengine"
                            entityId={engine.visual.entityId}
                            name={engine.visual.name}
                            slotId="wengine.equipment-icon"
                            consumer="agent-development.workbench"
                          />
                        ) : (
                          <span className="engine__fallback" aria-hidden="true" />
                        )}
                        <span>
                          <b>{engine.name}</b>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            </div>
          </section>
          <WorkbenchPanelSnapshot subject={subject} />
        </section>

        <section className="loadout-recommendations" aria-label="配装建议">
          {scenario === 'incomplete' && (
            <div className="scenario-note" role="status">
              <b>还没有可靠的培养目标</b>
              <span>10 项游戏当前属性仍完整展示；资料缺口不会被当成养成差距。</span>
            </div>
          )}
          <div className="loadout-recommendation-grid" data-motion-scheme-content>
            <DevelopmentDiscGuide key={subject.agentId} guide={subject.graduation.discs} />
          </div>
        </section>
      </div>

      <section
        className="disc-section disc-section--workbench"
        aria-labelledby="workbench-discs-title"
      >
        <header className="disc-workbench-header">
          <div className="disc-workbench-title">
            <h3 id="workbench-discs-title">
              {isSavedView ? '已保存配装' : '六张驱动盘'}{' '}
              <span>· {subject.discs.length} / 6 张驱动盘</span>
            </h3>
            {subject.warehouseAnalysis.inventoryTransition ||
            (!isSavedView && subject.warehouseAnalysis.status === 'unavailable') ? (
              <span className="analysis-state-copy">{subject.warehouseAnalysis.summary}</span>
            ) : null}
          </div>

          {
            <div className="disc-workbench-metrics" aria-label="方案指标">
              <span className="disc-metric">
                <small>配装评分</small>
                <strong>{subject.warehouseAnalysis.totalScore ?? '—'}</strong>
              </span>
              <span className="disc-metric">
                <small>有效副属性</small>
                <strong>
                  {subject.warehouseAnalysis.effectiveEnhancements === undefined
                    ? '—'
                    : `${subject.warehouseAnalysis.effectiveEnhancements + (subject.warehouseAnalysis.effectiveLines ?? 0)} 次命中`}
                </strong>
              </span>
              {subject.warehouseAnalysis.replacementCount !== undefined && (
                <span className="disc-metric">
                  <small>替换数量</small>
                  <strong>
                    {subject.warehouseAnalysis.replacementCount === undefined
                      ? '—'
                      : `${subject.warehouseAnalysis.replacementCount} / 6`}
                  </strong>
                </span>
              )}
            </div>
          }
          {
            <div className="disc-workbench-actions">
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
                type="button"
                disabled={
                  savingPlan ||
                  warehouseActionState === 'running' ||
                  (!canCompare && !onAnalyzeWarehouse)
                }
                onClick={async () => {
                  if (canCompare || (await runWarehouseAnalysis())) toTop10()
                }}
              >
                比较其他配装
              </button>
              {canCompare ? (
                <div className="warehouse-actions">
                  <button
                    className="warehouse-action warehouse-action--secondary"
                    type="button"
                    disabled={savingPlan || warehouseActionState === 'running'}
                    onClick={runWarehouseAnalysis}
                  >
                    {warehouseActionState === 'running' ? '搭配中…' : '重新搭配'}
                  </button>
                </div>
              ) : subject.warehouseAnalysis.status !== 'idle' ? (
                <span className="analysis-unavailable">{subject.warehouseAnalysis.summary}</span>
              ) : null}
              {!canCompare && !isSavedView ? (
                <button
                  className="warehouse-action warehouse-action--primary button primary"
                  type="button"
                  disabled={!onAnalyzeWarehouse || warehouseActionState === 'running'}
                  onClick={runWarehouseAnalysis}
                >
                  {warehouseActionState === 'running'
                    ? '正在搭配…'
                    : subject.warehouseAnalysis.status === 'idle'
                      ? '从仓库搭配'
                      : '重新从仓库搭配'}
                </button>
              ) : null}
              {warehouseActionError ? (
                <div className="warehouse-action-feedback" role="status">
                  <WarehouseMatchMessage feedback={warehouseActionError} />
                  {routed ? (
                    <Link className="text-action" to="/assets/discs">
                      查看仓库
                    </Link>
                  ) : (
                    <a className="text-action" href="/assets/discs">
                      查看仓库
                    </a>
                  )}
                </div>
              ) : null}
              {!isSavedView && (onSavePlan || !canCompare || savingPlan) ? (
                <button
                  className="primary save-plan-action"
                  type="button"
                  disabled={
                    !canCompare || !onSavePlan || savingPlan || warehouseActionState === 'running'
                  }
                  onClick={async () => {
                    if (!onSavePlan || savingPlan) return
                    setSavingPlan(true)
                    setSavePlanError(null)
                    try {
                      await onSavePlan(subject.selectedCandidateRank)
                      setSavedPlanKey(planKey)
                    } catch (error) {
                      setSavePlanError(playerErrorMessage(error, '保存失败，请稍后重试。'))
                    } finally {
                      setSavingPlan(false)
                    }
                  }}
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
              {savePlanError ? (
                <span className="warehouse-action-feedback" role="alert">
                  {savePlanError}
                </span>
              ) : null}
            </div>
          }
        </header>
        {!isSavedView && subject.candidateDifferences?.length ? (
          <p className="disc-main-stat-differences" role="status" aria-label="与推荐主词条的差异">
            {subject.candidateDifferences.join('；')}
          </p>
        ) : null}
        <div
          className="disc-grid"
          ref={discResultsRef}
          aria-busy={warehouseActionState === 'running'}
        >
          {warehouseActionState === 'running' && subject.discs.length === 0 ? (
            <div className="disc-generation" role="status">
              <span>正在从仓库搭配六张驱动盘…</span>
              <div aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map((slot) => (
                  <span key={slot}>{slot}号位</span>
                ))}
              </div>
            </div>
          ) : scenario === 'empty-discs' ? (
            <div className="empty-discs" role="status">
              <b>当前只有 4 / 6 张可用驱动盘</b>
              <span>先到资产维护补齐盘位，再比较完整方案。</span>
            </div>
          ) : (
            subject.discs.map((disc) => <DevelopmentDiscCard key={disc.slot} disc={disc} />)
          )}
        </div>
      </section>
    </section>
  )
}
