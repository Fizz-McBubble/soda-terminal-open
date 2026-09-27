import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'

const currentTeamArchetypeAliases = new Map<string, string>([
  ['candidate-3.1-bangboo-ariel', 'bangboo-ariel'],
])

/** Resolves source-ledger lineage ids without widening the agent-only roster identity map. */
export function resolveCurrentTeamArchetypeIdentity(identity: string) {
  return currentTeamArchetypeAliases.get(identity) ?? resolveCurrentReleasedIdentity(identity)
}
