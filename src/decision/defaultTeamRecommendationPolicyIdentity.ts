import policySource from './defaultTeamRecommendationPolicy.ts?raw'
import consumerSource from './accountDecisionAuthority.ts?raw'
import { stableContentHash } from '../gameDataPacks/types'

/** Includes qualification/quotas and the source-first consumer integration without
 * importing its execution graph. Real rule deployments invalidate old decisions. */
export const defaultTeamRecommendationPolicyIdentity = Object.freeze({
  contract: 'installed-source-first-bounded-inference-defaults/v1',
  policyHash: stableContentHash(policySource.replaceAll('\r\n', '\n')),
  consumerHash: stableContentHash(consumerSource.replaceAll('\r\n', '\n')),
})
