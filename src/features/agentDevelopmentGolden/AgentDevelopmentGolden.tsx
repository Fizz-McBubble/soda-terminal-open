import { useState } from 'react'
import { Top10 } from './AgentDevelopmentTop10'
import { AgentDevelopmentOverview } from './AgentDevelopmentOverview'
import { Workbench } from './AgentDevelopmentWorkbench'
import type { AgentDevelopmentGoldenProps, JourneyView } from './types'
export function AgentDevelopmentGolden({
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
  onSelectCandidatePlan,
  onAnalyzeWarehouse,
  onReanalyzeWarehouse,
}: AgentDevelopmentGoldenProps) {
  const [view, setView] = useState<JourneyView>(initialView)
  const missingData = (view === 'workbench' && !workbench) || (view === 'top10' && !top10Data)
  const content = missingData ? (
    <section className="production-data-missing" role="alert">
      <h1>当前账户资料尚未准备好</h1>
      <p>此页面只展示当前账户的生产数据，不会回退到演示数据。</p>
    </section>
  ) : view === 'overview' ? (
    <AgentDevelopmentOverview
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
      onSavePlan={onSavePlan}
      onAnalyzeWarehouse={onAnalyzeWarehouse}
    />
  ) : (
    <Top10
      back={() => (onNavigate ? onNavigate('workbench') : setView('workbench'))}
      scenario={scenario}
      data={top10Data!}
      onSavePlan={onSavePlan}
      onSelectCandidatePlan={onSelectCandidatePlan}
      onReanalyzeWarehouse={onReanalyzeWarehouse}
    />
  )
  return <div className="ad-golden">{content}</div>
}
