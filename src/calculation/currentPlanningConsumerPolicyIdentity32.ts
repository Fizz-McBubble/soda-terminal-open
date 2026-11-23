import generatedIdentity from './generated/currentPlanningConsumerPolicyIdentity32.v1.json'

const contract = 'installed-prepared-and-functional-consumer-policy/v1'
const sourceHashes: Readonly<Record<string, string>> = generatedIdentity.sourceHashes

if (
  generatedIdentity.contract !== contract ||
  !sourceHashes ||
  !Object.values(sourceHashes).every(
    (hash) => typeof hash === 'string' && hash.startsWith('fnv1a-'),
  )
) {
  throw new Error('current_planning_consumer_policy_identity_invalid')
}

/** Fixed prebuild identity. Source text remains outside the browser graph. */
export const currentPlanningConsumerPolicyIdentity32 = Object.freeze({
  contract,
  sourceHashes: Object.freeze({ ...sourceHashes }),
})
