import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import type { BuildAccountDecisionInput } from '../decision/accountDecisionService'
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
}: {
  decisionInput: BuildAccountDecisionInput
  planId: string
  buildIntentFingerprint: string
}) {
  return buildSavedTeamPlanSolutionFingerprintFromComponents({
    decisionInput,
    planId,
    buildIntentFingerprint,
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
