import { useState, type ReactNode } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import type { TeamExecution, TeamExecutionPortfolio } from '../decision/teamExecutionProjection'
import type { BuildIntentRecommendation } from '../decision/buildIntent'
import type { TeamDeploymentOrder } from '../decision/teamDeployment'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import { presentTeamExecution, presentTeamExecutionPortfolio } from './teamExecutionPresentation'
import { TeamExecutionPortfolioSummary } from './teamExecutionPortfolioPanel'
import {
  type TeamExecutionWorkspaceAlternate,
  TeamExecutionWorkspaceSurface,
} from './TeamExecutionWorkspaceSurface'
export {
  type TeamExecutionWorkspaceAlternate,
  TeamExecutionWorkspaceSurface,
} from './TeamExecutionWorkspaceSurface'

/**
 * Production adapter: Storybook and the routed page share this exact visual
 * surface. Only their typed inputs differ; there is no design-only DOM to
 * translate after Golden acceptance.
 */
function TeamExecutionPanelState({
  execution,
  warehouse,
  allocation = [],
  alternate,
  targetTeamFit,
  savedPotentialByAgentId,
  discRecommendations,
  onConfirmEquipmentParameters,
  onDeploymentOrderChange,
  evidence,
  readOnly = false,
  savedSnapshot = false,
}: {
  execution: TeamExecution
  warehouse: CoreWarehouse
  allocation?: readonly AccountLoadout[]
  alternate?: TeamExecutionWorkspaceAlternate
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  savedPotentialByAgentId?: Readonly<Record<string, number>>
  discRecommendations?: readonly BuildIntentRecommendation[]
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  onDeploymentOrderChange?: (order: TeamDeploymentOrder | undefined) => void
  evidence?: ReactNode
  readOnly?: boolean
  savedSnapshot?: boolean
}) {
  const [editedWarehouse, setCurrentWarehouse] = useState(warehouse)
  const currentWarehouse = readOnly ? warehouse : editedWarehouse
  // A target-team fit owns the 18 physical-disc choices shown by this workspace. The account-wide
  // allocation can omit those members, so it is only the fallback for historical/non-target views.
  const presentationAllocation = targetTeamFit?.warehousePlan.loadouts ?? allocation
  return (
    <TeamExecutionWorkspaceSurface
      bangbooId={execution.bangbooId}
      warehouse={currentWarehouse}
      view={presentTeamExecution(
        execution,
        currentWarehouse,
        presentationAllocation,
        savedSnapshot ? { savedSnapshot: true } : undefined,
      )}
      alternate={alternate}
      targetTeamFit={targetTeamFit}
      savedPotentialByAgentId={savedPotentialByAgentId}
      discRecommendations={discRecommendations}
      onConfirmEquipmentParameters={onConfirmEquipmentParameters}
      onDeploymentOrderChange={onDeploymentOrderChange}
      evidence={evidence}
      execution={execution}
      readOnly={readOnly}
      onRosterChange={
        readOnly
          ? undefined
          : (roster) => setCurrentWarehouse((current) => ({ ...current, roster }))
      }
    />
  )
}

export function TeamExecutionPanel({
  execution,
  warehouse,
  allocation = [],
  alternate,
  targetTeamFit,
  savedPotentialByAgentId,
  discRecommendations,
  onConfirmEquipmentParameters,
  onDeploymentOrderChange,
  evidence,
  readOnly,
  savedSnapshot,
}: {
  execution: TeamExecution
  warehouse: CoreWarehouse
  allocation?: readonly AccountLoadout[]
  alternate?: TeamExecutionWorkspaceAlternate
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  savedPotentialByAgentId?: Readonly<Record<string, number>>
  discRecommendations?: readonly BuildIntentRecommendation[]
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  onDeploymentOrderChange?: (order: TeamDeploymentOrder | undefined) => void
  evidence?: ReactNode
  readOnly?: boolean
  savedSnapshot?: boolean
}) {
  return (
    <TeamExecutionPanelState
      key={`${warehouse.accountId ?? 'legacy'}:${warehouse.roster.updatedAt}`}
      execution={execution}
      warehouse={warehouse}
      allocation={allocation}
      alternate={alternate}
      targetTeamFit={targetTeamFit}
      savedPotentialByAgentId={savedPotentialByAgentId}
      discRecommendations={discRecommendations}
      onConfirmEquipmentParameters={onConfirmEquipmentParameters}
      onDeploymentOrderChange={onDeploymentOrderChange}
      evidence={evidence}
      readOnly={readOnly}
      savedSnapshot={savedSnapshot}
    />
  )
}

export function TeamExecutionPortfolioPanel({ portfolio }: { portfolio: TeamExecutionPortfolio }) {
  const view = presentTeamExecutionPortfolio(portfolio)
  return <TeamExecutionPortfolioSummary view={view} />
}
