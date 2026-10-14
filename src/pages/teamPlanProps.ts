import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'

export interface TeamPlanProps {
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  analysisRunId?: string
  targetTeamFits?: Record<string, TargetTeamWarehouseFitQueryResult>
  readOnly?: boolean
}
