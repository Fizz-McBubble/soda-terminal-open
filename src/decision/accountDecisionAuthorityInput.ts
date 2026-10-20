import type { AccountRoster } from '../assault/types'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { RankedFormation } from './accountDecisionBands'

export type AccountDecisionAuthorityInput = {
  rankedFormations: readonly RankedFormation[]
  roster: AccountRoster
  allocation: AccountBuildResult
  preference: TeamPortfolioPreference
  deferDiagnosticInference?: boolean
  recommendationLimit?: number
  decisionIssueClassificationFingerprint?: string
  /** Validation oracle; production always uses the generated intrinsic index when current. */
  validationIntrinsicProjectionMode?: 'indexed' | 'direct'
}
