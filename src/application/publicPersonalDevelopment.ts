import type {
  AccountDecisionQueryInput,
  DevelopmentCandidateAlternativesQuery,
  DevelopmentCandidateAlternativesQueryResult,
} from './calculationQueryContract'
import { calculationQueryContractVersion } from './calculationQueryContract'
import { publicVersionIdentity } from './publicVersionIdentity'
import {
  actualDiscScoreVersion,
  candidateSetPlanPolicyVersion,
} from './publicBuildIntentFingerprint'
import { contentHash } from './contentHash'
import { rosterFingerprintFacts } from './publicRosterFingerprintFacts'

/** A real captured input, separate from Account Decision and team authority. */
export type PersonalDevelopmentSession = {
  contract: 'soda-personal-development-session/v1'
  sessionId: string
  accountId: string
  inputFingerprint: string
  capturedAt: string
}

function personalWarehouseFingerprintFacts(warehouse: AccountDecisionQueryInput['warehouse']) {
  return {
    ...warehouse,
    discs: [...warehouse.discs].sort((a, b) => a.id.localeCompare(b.id)),
    roster: {
      ...rosterFingerprintFacts(warehouse.roster),
      bangboos: warehouse.roster.bangboos,
      wEngines: warehouse.roster.wEngines,
    },
  }
}

/** Only inputs consumed by personal candidate generation; saved plans remain session-specific. */
export function personalDevelopmentSolveInputFingerprint(input: AccountDecisionQueryInput) {
  return contentHash({
    contract: 'soda-personal-development-solve-input/v1',
    warehouse: personalWarehouseFingerprintFacts(input.warehouse),
    developmentPriorityAgentIds: input.developmentPriorityAgentIds,
    packageId: publicVersionIdentity.packageId,
    packageVersion: publicVersionIdentity.packageVersion,
    contentHash: publicVersionIdentity.contentHash,
    actualDiscScoreVersion,
    candidateSetPlanPolicyVersion,
  })
}

export function personalDevelopmentInputFingerprint(input: AccountDecisionQueryInput) {
  return contentHash({
    contract: 'soda-personal-development-input/v1',
    input: {
      ...input,
      drafts: [...input.drafts].sort((a, b) => a.id.localeCompare(b.id)),
      warehouse: personalWarehouseFingerprintFacts(input.warehouse),
    },
    packageId: publicVersionIdentity.packageId,
    packageVersion: publicVersionIdentity.packageVersion,
    contentHash: publicVersionIdentity.contentHash,
    actualDiscScoreVersion,
    candidateSetPlanPolicyVersion,
  })
}

export type OpenPersonalDevelopmentQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'personal_development_open'
  operationId: string
  sessionId: string
  capturedAt: string
  input: AccountDecisionQueryInput
}

export type PersonalDevelopmentCandidatesQuery = Omit<
  DevelopmentCandidateAlternativesQuery,
  'kind' | 'runId'
> & {
  kind: 'personal_development_candidates'
  operationId: string
  sessionId: string
  accountId: string
  inputFingerprint: string
  mode: 'generate' | 'compare'
}

export type PersonalDevelopmentCandidatesResult = Omit<
  DevelopmentCandidateAlternativesQueryResult,
  'runId'
> & {
  sessionId: string
  sessionContract: PersonalDevelopmentSession['contract']
  mode: 'generate' | 'compare'
  generationIdentity: string
  publicProjection?: 'soda-public-personal-development/v1'
  saveKnowledge: import('./publicDevelopmentComparisonPanels').DevelopmentComparisonPanels['saveKnowledge']
}

export type PersonalDevelopmentRouteQuery = {
  contractVersion: typeof calculationQueryContractVersion
  kind: 'personal_development_route'
  operationId: string
  sessionId: string
  accountId: string
  inputFingerprint: string
  generationIdentity: string
  selection: import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRouteSelection
}

export type PersonalDevelopmentRoute = Omit<
  import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRoutePresentation,
  'contract' | 'runId'
> & {
  contract: 'soda-personal-development-route/v1'
  sessionId: string
  generationIdentity: string
}
