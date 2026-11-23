import { useEffect, useRef } from 'react'
import { WorkbenchCurrentOverview } from './WorkbenchCurrentOverview'
import { DevelopmentDiscGuide } from './DevelopmentDiscGuide'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { AgentVisualSlot } from './agentVisualSlot'
import { BackNavigation } from '../../components/BackNavigation'
import { specialtyIconIds } from './agentDevelopmentWorkbenchPresentation'
import type { AgentDevelopmentGoldenProps, GoldenWorkbenchData, JourneyScenario } from './types'
import { DecisionLoadoutSection } from './DecisionLoadoutSection'
import { usePageOperationScope } from '../../components/usePageOperationScope'

export function Workbench({
  toOverview,
  toTop10,
  onContinueOptimization,
  scenario,
  data,
  onSavePlan,
  onEditCurrent,
  currentUpdate,
  workbenchComparisonConditions,
  onAnalyzeWarehouse,
  onCancelWarehouseAnalysis,
}: {
  toOverview: () => void
  toTop10: () => void
  onContinueOptimization?: () => void
  scenario: JourneyScenario
  data: GoldenWorkbenchData
  onEditCurrent?: () => void
  currentUpdate?: AgentDevelopmentGoldenProps['currentUpdate']
  workbenchComparisonConditions?: AgentDevelopmentGoldenProps['workbenchComparisonConditions']
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onAnalyzeWarehouse?: AgentDevelopmentGoldenProps['onAnalyzeWarehouse']
  onCancelWarehouseAnalysis?: AgentDevelopmentGoldenProps['onCancelWarehouseAnalysis']
}) {
  const workbenchRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const owner = workbenchRef.current?.closest<HTMLElement>('[data-f5-scroll-owner]')
    if (owner) owner.scrollTop = 0
  }, [data.agentId])
  const subject = data
  const captureDirectionScope = usePageOperationScope(subject.panelScopeKey ?? subject.agentId)
  const specialtyIcon = specialtyIconIds[subject.specialty]
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
          data-player-route="/development"
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
        <WorkbenchCurrentOverview
          subject={subject}
          onEditCurrent={onEditCurrent}
          currentUpdate={currentUpdate}
          comparisonConditions={workbenchComparisonConditions}
        />

        <section className="loadout-recommendations" aria-label="配装建议">
          {scenario === 'incomplete' && (
            <div className="scenario-note" role="status">
              <b>还没有可靠的培养目标</b>
              <span>当前属性仍可查看；暂时无法给出可靠的培养目标。</span>
            </div>
          )}
          <div className="loadout-recommendation-grid" data-motion-scheme-content>
            <DevelopmentDiscGuide
              key={subject.agentId}
              guide={subject.graduation.discs}
              onSelectDirection={
                onAnalyzeWarehouse
                  ? async (directionId) => {
                      const isCurrent = captureDirectionScope()
                      await onAnalyzeWarehouse('compare', {
                        independentDirection: {
                          directionId,
                          conditionState: 'met',
                        },
                      })
                      if (isCurrent()) toTop10()
                    }
                  : undefined
              }
            />
          </div>
        </section>
      </div>

      <DecisionLoadoutSection
        subject={subject}
        scenario={scenario}
        toTop10={toTop10}
        onContinueOptimization={onContinueOptimization}
        onSavePlan={onSavePlan}
        onAnalyzeWarehouse={onAnalyzeWarehouse}
        onCancelWarehouseAnalysis={onCancelWarehouseAnalysis}
      />
    </section>
  )
}
