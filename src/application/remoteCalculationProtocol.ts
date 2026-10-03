import type {
  CommonAnomalySettlement32Query,
  PlanningBenchmark32Query,
  ReviewedIncrementalEvent32Query,
  AccountDecisionQuery,
  AccountDecisionRun,
  DevelopmentCandidateAlternativesQuery,
  DevelopmentCandidateAlternativesQueryResult,
  DevelopmentWorkbenchRouteQuery,
  TargetTeamWarehouseFitQuery,
  TargetTeamWarehouseFitQueryResult,
  TeamOverviewPresentationQuery,
  TeamRoutePresentationQuery,
  SavedTeamPlanReplayQuery,
  SavedTeamSolutionComponentsQuery,
  WarehouseDiscTransitionUsesQuery,
  WarehouseDiscTransitionUsesResult,
} from './calculationQueryContract'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { SavedTeamReplayPresentation } from './publicSavedTeamReplay'

export const remoteCalculationProtocolVersion = 'soda-remote-calculation/v4' as const

export type RemoteCalculationRequest =
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: CommonAnomalySettlement32Query
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: PlanningBenchmark32Query
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: ReviewedIncrementalEvent32Query
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      runtime: { packageId: string; packageVersion: string; gameVersion: string }
      query: AccountDecisionQuery
    }
  | { protocolVersion: typeof remoteCalculationProtocolVersion; query: TargetTeamWarehouseFitQuery }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: TeamOverviewPresentationQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: TeamRoutePresentationQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: SavedTeamPlanReplayQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: SavedTeamSolutionComponentsQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: DevelopmentCandidateAlternativesQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: DevelopmentWorkbenchRouteQuery
    }
  | {
      protocolVersion: typeof remoteCalculationProtocolVersion
      query: WarehouseDiscTransitionUsesQuery
    }

type PublicCandidateWarehousePlan = Omit<CandidateWarehousePlan, 'alternatives' | 'solver'> & {
  alternatives: []
  solver?: Pick<
    NonNullable<CandidateWarehousePlan['solver']>,
    'method' | 'exactWithinModel' | 'domain'
  >
}

export type PublicAccountDecisionRun = Omit<AccountDecisionRun, 'input' | 'snapshot'> & {
  snapshot: {
    sideEffect: 'read_only'
    fingerprint: { inputHash: string }
    claims: { overall: { status: AccountDecisionRun['claimStatus'] } }
    decisionAuthority: AccountDecisionRun['decisionAuthority']
    hardConstraints: { active: unknown[]; canRestoreDefault: boolean }
    portfolioInput: { preference: { teamCount: number } }
    allocation: { global: unknown[]; diagnostics: unknown[] }
  }
}

export type PublicTargetTeamWarehouseFit = Pick<
  TargetTeamWarehouseFitQueryResult,
  | 'contract'
  | 'candidateId'
  | 'memberIds'
  | 'status'
  | 'solverMethod'
  | 'exactWithinModel'
  | 'discCount'
  | 'uniqueDiscCount'
  | 'totalScore'
  | 'gaps'
  | 'equipmentRecommendations'
  | 'sideEffect'
  | 'boundary'
  | 'portfolioContinuationEligible'
  | 'effectiveEquipmentParameters'
  | 'accountFactBinding'
  | 'targetExecution'
  | 'teamExecutionPresentation'
> & {
  warehousePlan: PublicCandidateWarehousePlan
  buildIntent: {
    contract: TargetTeamWarehouseFitQueryResult['buildIntent']['contract']
    scope: 'team_joint'
    resourcePolicy: 'within_team_exclusive'
    fingerprint: string
    exactTeam: { candidateId: string; bangbooId: string | null }
  }
  accountBoundBenchmark: {
    equipmentModifierProjection: {
      wEngines: Array<{ passiveStatus: string }>
    } | null
  }
}

export type PublicSavedTeamReplay = Omit<SavedTeamReplayPresentation, 'match'> & {
  match: {
    buildIntent: { fingerprint: string; exactTeam: { candidateId: string } }
    accountFactBinding?: import('./publicAuthorComparisonAccountBinding').AuthorComparisonAccountBinding
    effectiveEquipmentParameters: NonNullable<
      SavedTeamReplayPresentation['match']
    >['effectiveEquipmentParameters']
  } | null
}

export type PublicDevelopmentCandidateAlternatives = Omit<
  DevelopmentCandidateAlternativesQueryResult,
  'buildIntent' | 'candidates'
> & {
  buildIntent: Pick<
    DevelopmentCandidateAlternativesQueryResult['buildIntent'],
    'contract' | 'scope' | 'fingerprint'
  >
  candidates: PublicCandidateWarehousePlan[]
}

export type RemoteCalculationResult =
  | import('./publicCommonAnomalySettlementQuery32').CommonAnomalySettlementQueryResult32
  | import('./publicPlanningBenchmark32').PlanningBenchmarkResult32
  | import('./publicReviewedIncrementalEvent32').ReviewedIncrementalEventResult32Dto
  | PublicAccountDecisionRun
  | PublicTargetTeamWarehouseFit
  | import('../pages/teamLoadoutPresentationDto').TeamOverviewPresentationDto
  | import('../pages/publicTeamRoutePresentation').TeamRoutePresentation
  | PublicSavedTeamReplay
  | import('./publicSavedTeamSolutionComponents').SavedTeamSolutionComponents
  | PublicDevelopmentCandidateAlternatives
  | import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRoutePresentation
  | WarehouseDiscTransitionUsesResult

export type RemoteTaskState =
  | { status: 'queued' | 'running' }
  | { status: 'succeeded'; result: RemoteCalculationResult }
  | { status: 'failed' | 'cancelled'; error: string }

export type RemoteTaskReceipt = { taskId: string }
export type RemoteError = { error: string }
