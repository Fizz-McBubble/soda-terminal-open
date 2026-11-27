import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import type { BuildAccountDecisionInput } from '../decision/accountDecisionService'
import type { AccountPlanningDraft } from './types'
import { buildSavedTeamSolutionInputComponents } from '../decision/accountDecisionFingerprint'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents,
} from '../application/publicSavedTeamSolutionFingerprint'
export {
  inspectSavedTeamPlanSnapshotFreshness,
  inspectSavedTeamPortfolioPlanSnapshotFreshness,
  type SavedTeamPlanSnapshotFreshness,
  type SavedTeamPortfolioSnapshotFreshness,
} from '../application/publicSavedPlanFreshness'

function nonPlanningComponents(decisionInput: BuildAccountDecisionInput) {
  return buildSavedTeamSolutionInputComponents(decisionInput)
}

export function buildSavedTeamPlanSolutionFingerprint({
  decisionInput,
  planId,
  buildIntentFingerprint,
  candidateWarehouse,
}: {
  decisionInput: BuildAccountDecisionInput
  planId: string
  buildIntentFingerprint: string
  candidateWarehouse?: AccountPlanningDraft['candidateWarehouse'] | null
}) {
  return buildSavedTeamPlanSolutionFingerprintFromComponents({
    decisionInput,
    planId,
    buildIntentFingerprint,
    candidateWarehouse,
    nonPlanningComponents: nonPlanningComponents(decisionInput),
  })
}

export function buildSavedTeamPortfolioPlanSolutionFingerprint({
  decisionInput,
  planId,
  buildIntent,
}: {
  decisionInput: BuildAccountDecisionInput
  planId: string
  buildIntent: PortfolioJointBuildIntent
}) {
  return buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents({
    decisionInput,
    planId,
    buildIntent,
    nonPlanningComponents: nonPlanningComponents(decisionInput),
  })
}
