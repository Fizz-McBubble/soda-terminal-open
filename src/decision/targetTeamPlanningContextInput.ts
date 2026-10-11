import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import type { TargetTeamEquipmentParameterSelection } from './targetTeamAccountBoundBenchmark'
import type { TargetTeamEquipmentModifierProjection } from '../calculation/targetTeamEquipmentModifierProjection'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import type { StandardSubstatProbe } from '../calculation/standardSubstatProbe'
import type { SourceResourceGrantDeclaration32 } from '../calculation/sourceMechanismResourceGrants32'

export type TargetTeamPlanningContextInput = {
  warehouse: CoreWarehouse
  candidate: TeamBuildExecutionIdentity
  fit: Pick<
    TargetTeamWarehouseFit,
    'status' | 'uniqueDiscCount' | 'memberIds' | 'loadouts' | 'fingerprint'
  >
  parameters: TargetTeamEquipmentParameterSelection
  modifierProjection: TargetTeamEquipmentModifierProjection
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  /** Internal, read-only sensitivity probe; never a saved physical loadout. */
  statProbesByAgentId?: Readonly<Record<string, StandardSubstatProbe>>
  /** Explicit independent fixture conditions, never populated from source UI
   * defaults or promoted to a player/account observation. */
  calibrationObservations?: {
    authority: 'independent_calibration'
    id: string
    referencesByAgentId: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    resourceGrantDeclaration32?: SourceResourceGrantDeclaration32
  }
}
