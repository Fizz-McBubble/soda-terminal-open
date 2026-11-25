import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import { lookupCurrent31TeamIntrinsicDetails } from './current31TeamIntrinsicIndex'

export function createAccountTeamIndexReader() {
  // The same locked row is consulted for admission, strength and account recommendations.
  // Bind both caches to this synchronous projection so changing account or catalog starts fresh.
  const offlineCache = new Map<string, ReturnType<typeof lookupCurrent31TeamIntrinsicDetails>>()
  const offlineDetails: typeof lookupCurrent31TeamIntrinsicDetails = (ids, candidateId) => {
    const key = JSON.stringify([candidateId, [...ids].sort()])
    if (!offlineCache.has(key))
      offlineCache.set(key, lookupCurrent31TeamIntrinsicDetails(ids, candidateId))
    return offlineCache.get(key) ?? null
  }
  const proofIds = new WeakMap<Parameters<typeof canonicalTeamPlayIdentity>[0], string>()
  const identifyPlay: typeof canonicalTeamPlayIdentity = (play) => {
    let identity = proofIds.get(play)
    if (identity === undefined) {
      identity = canonicalTeamPlayIdentity(play)
      proofIds.set(play, identity)
    }
    return identity
  }
  return { offlineDetails, identifyPlay }
}
