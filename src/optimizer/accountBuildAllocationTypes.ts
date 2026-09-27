import type { AgentDiscProfile } from '../assault/engine'
import type { DiscContribution, CandidatePanelObjective, OptimizedBuild } from './optimizeBuild'
import type { TeamSearchEvidence } from './searchTeamAssignments'

export type AccountDiscChoice = DiscContribution & {
  effectiveLines: number
  effectiveRolls: number
  wastedUpgrades: number
}

export type AccountLoadout = {
  agentId: string
  discs: AccountDiscChoice[]
  totalScore: number
  setCounts: Record<string, number>
  setPattern: '4+2' | '2+2+2'
  confidence: AgentDiscProfile['confidence']
  scenario: string
  contextRationale: string[]
  teamAssumptions: string[]
  bangbooIds: string[]
  degraded: boolean
  degradeReasons: string[]
  panelObjective?: CandidatePanelObjective
  panelObjectiveStatus?: OptimizedBuild['panelObjectiveStatus']
}

export type UnavailableDiagnosis = {
  agentId: string
  scope: 'independent' | 'global'
  missingSlots: number[]
  reasons: string[]
  actions: string[]
}

export type AccountBuildResult = {
  independent: AccountLoadout[]
  global: AccountLoadout[]
  gaps: Record<string, number>
  conflicts: Record<string, Array<{ discId: string; ownerAgentId: string }>>
  independentUnavailableAgentIds: string[]
  globalUnavailableAgentIds: string[]
  unavailableAgentIds: string[]
  diagnostics: UnavailableDiagnosis[]
  warehouseHash: string
  inputHash: string
  elapsedMs: number
  exactWithinModel: boolean
  teamSearch?: TeamSearchEvidence
  boundary: string
}
