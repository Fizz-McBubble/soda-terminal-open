import type { ReactNode } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import type { TeamExecution } from '../decision/teamExecutionProjection'
import type { TeamDeploymentOrder } from '../decision/teamDeployment'
import type { BuildIntentRecommendation } from '../decision/buildIntent'
import type { presentTeamExecution } from './teamExecutionPresentation'

export type TeamExecutionWorkspaceSubstitute = {
  targetAgentId: string
  agentId: string
  agentName: string
  onSelect?: () => void
}

export type TeamExecutionWorkspaceAlternate = {
  agentId: string
  agentName: string
  replacedAgentId?: string
  replacedAgentName?: string
  onSelect?: () => void
  alternatives?: readonly TeamExecutionWorkspaceSubstitute[]
}

export type TeamExecutionWorkspaceSurfaceProps = {
  view: ReturnType<typeof presentTeamExecution>
  bangbooId: string | null
  warehouse: CoreWarehouse
  alternate?: TeamExecutionWorkspaceAlternate
  execution?: TeamExecution
  onRosterChange?: (roster: CoreWarehouse['roster']) => void
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  savedPotentialByAgentId?: Readonly<Record<string, number>>
  discRecommendations?: readonly BuildIntentRecommendation[]
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  onDeploymentOrderChange?: (order: TeamDeploymentOrder | undefined) => void
  evidence?: ReactNode
  readOnly?: boolean
}
