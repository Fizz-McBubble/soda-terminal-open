import { useRef, useState } from 'react'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { Top10 } from './AgentDevelopmentTop10'
import { AgentDevelopmentOverview } from './AgentDevelopmentOverview'
import { Workbench } from './AgentDevelopmentWorkbench'
import type { AgentDevelopmentGoldenProps, JourneyView } from './types'
export function AgentDevelopmentGolden({
  browseAccountId,
  initialView = 'workbench',
  scenario = 'current',
  directoryAgents = [],
  onOpenAgent,
  onOpenSavedAgent,
  onContinueOptimization,
  onToggleFavorite,
  onDeleteAgentPlan,
  workbench,
  top10: top10Data,
  onNavigate,
  onSavePlan,
  onEditCurrent,
  currentUpdate,
  workbenchComparisonConditions,
  onSelectCandidatePlan,
  onAnalyzeWarehouse,
  onCancelWarehouseAnalysis,
  onReanalyzeWarehouse,
  comparisonScenarioControl,
  comparisonEquipmentControl,
  onComparisonDetailsOpen,
}: AgentDevelopmentGoldenProps) {
  const [view, setView] = useState<JourneyView>(initialView)
  const routeRef = useRef<HTMLDivElement>(null)
  const routeIdentity =
    view === 'overview'
      ? `overview:${directoryAgents.length}`
      : view === 'workbench'
        ? `workbench:${workbench?.agentId ?? 'missing'}`
        : `comparison:${top10Data?.agentName ?? 'missing'}`
  useStateTransitionMotion({
    scope: routeRef,
    stateKey: routeIdentity,
    includeScope: true,
    animateOnMount: true,
    transition: 'route',
  })
  const missingData = (view === 'workbench' && !workbench) || (view === 'top10' && !top10Data)
  const content = missingData ? (
    <section className="production-data-missing" role="alert">
      <h1>当前账户资料尚未准备好</h1>
      <p>请稍后重试；若仍无法读取，请重新加载页面。</p>
    </section>
  ) : view === 'overview' ? (
    <AgentDevelopmentOverview
      browseAccountId={browseAccountId}
      openAgent={(agentId) => (onOpenAgent ? onOpenAgent(agentId) : setView('workbench'))}
      openSavedAgent={onOpenSavedAgent}
      directoryAgents={directoryAgents}
      onToggleFavorite={onToggleFavorite}
      onDeleteAgentPlan={onDeleteAgentPlan}
    />
  ) : view === 'workbench' ? (
    <Workbench
      toOverview={() => (onNavigate ? onNavigate('overview') : setView('overview'))}
      toTop10={() => (onNavigate ? onNavigate('top10') : setView('top10'))}
      onContinueOptimization={onContinueOptimization}
      scenario={scenario}
      data={workbench!}
      onEditCurrent={onEditCurrent}
      currentUpdate={currentUpdate}
      workbenchComparisonConditions={workbenchComparisonConditions}
      onSavePlan={onSavePlan}
      onAnalyzeWarehouse={onAnalyzeWarehouse}
      onCancelWarehouseAnalysis={onCancelWarehouseAnalysis}
    />
  ) : (
    <Top10
      back={() => (onNavigate ? onNavigate('workbench') : setView('workbench'))}
      scenario={scenario}
      data={top10Data!}
      onSavePlan={onSavePlan}
      onSelectCandidatePlan={onSelectCandidatePlan}
      onReanalyzeWarehouse={onReanalyzeWarehouse}
      comparisonScenarioControl={comparisonScenarioControl}
      comparisonEquipmentControl={comparisonEquipmentControl}
      onComparisonDetailsOpen={onComparisonDetailsOpen}
    />
  )
  return (
    <div ref={routeRef} className="ad-golden" data-development-view={view}>
      {content}
    </div>
  )
}
