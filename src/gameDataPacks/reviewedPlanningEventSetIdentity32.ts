import qualification from './data/reviewed-planning-event-set32.v1.json'
import { stableContentHash } from './types'

/** Saved-result identity only. It does not import a formula or grant readiness. */
export const reviewedPlanningEventSetIdentity32 = Object.freeze({
  contract: 'soda-reviewed-planning-event-set32/v1',
  qualificationId: qualification.qualificationId,
  gameVersion: qualification.gameVersion,
  semanticIdentityHash: qualification.semanticIdentityHash,
  scopeHash: stableContentHash(qualification.scope),
  regressionHash: stableContentHash(qualification.regression),
})
