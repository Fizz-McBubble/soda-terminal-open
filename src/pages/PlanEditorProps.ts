import { type CoreWarehouse } from '../accounts/coreFlow'
import { getAccountPlanningDraft } from '../accounts/planningDrafts'
import type {
  AccountDecisionSnapshot,
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { type DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'
import { type PlanningProfile } from './planningProfile'

export type PlanEditorProps = {
  deleteAction?: import('react').ReactNode
  warehouse: CoreWarehouse
  kind: 'agent' | 'team'
  profiles: PlanningProfile[]
  team?: DecisionTeamViewModel
  teamRatingLabel?: string
  back: string
  restored?: Awaited<ReturnType<typeof getAccountPlanningDraft>>
  analysisRunId?: string
  decision?: AccountDecisionSnapshot
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  readOnly?: boolean
  alternativeTeams?: DecisionTeamViewModel[]
  onSelectAlternative?: (candidateId: string) => void
  transitionNotice?: string | null
  onReanalyze?: () => void
  onDeploymentOrderChange?: (
    order: import('../decision/teamDeployment').TeamDeploymentOrder | undefined,
  ) => void
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  staleNotice?: string
  equipmentParametersRequireRefresh?: boolean
  /** A saved snapshot whose exact target identity is being replayed read-only. */
  restoredExecutionIsFresh?: boolean
  restoredTargetFitState?: 'ready' | 'loading' | 'mismatch' | 'error'
  onRetryRestoredTargetFit?: () => void
}
