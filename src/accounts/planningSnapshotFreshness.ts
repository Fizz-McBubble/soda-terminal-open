import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import {
  buildAccountDecisionInputFingerprint,
  type BuildAccountDecisionInput,
} from '../decision/accountDecisionService'
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
  const fingerprint = buildAccountDecisionInputFingerprint(decisionInput)
  return Object.fromEntries(
    Object.entries(fingerprint.components).filter(([key]) => key !== 'planningHash'),
  )
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
