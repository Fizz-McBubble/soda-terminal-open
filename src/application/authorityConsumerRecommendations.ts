import type { projectAccountDecisionAuthority } from '../decision/accountDecisionAuthority'

type AccountDecisionAuthority = ReturnType<typeof projectAccountDecisionAuthority>

/** Older snapshots only have the visible shortlist; current runs carry the complete workset. */
export function authorityConsumerRecommendations(authority: AccountDecisionAuthority | undefined) {
  if (!authority || authority.status !== 'ready') return []
  if ('consumerRecommendations' in authority && Array.isArray(authority.consumerRecommendations))
    return authority.consumerRecommendations
  return authority.recommendations
}
