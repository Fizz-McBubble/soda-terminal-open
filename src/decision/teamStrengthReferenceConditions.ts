import { stableContentHash } from '../gameDataPacks/types'

/** Conditions of the retained source judgement, never an observed account value. */
export type TeamStrengthReferenceConditions = {
  potentialByAgentId: Readonly<Record<string, number>>
  evidenceRefs: readonly string[]
}

const nekomataPotentialSixTeams = [
  ['agent-nekomata', 'agent-norma', 'agent-sunna'],
  ['agent-nekomata', 'agent-norma', 'agent-astra'],
  ['agent-nekomata', 'agent-dialyn', 'agent-sunna'],
  ['agent-nekomata', 'agent-dialyn', 'agent-astra'],
].map((ids) => [...ids].sort().join('|'))
const potentialSixKeys = new Set(nekomataPotentialSixTeams)
const sourceConditions = {
  potentialByAgentId: { 'agent-nekomata': 6 },
  evidenceRefs: [
    'https://www.miyoushe.com/zzz/article/76994144',
    'current31StrengthGoldSet:reviewedMetaSupplements:explicit-default-potential-6',
  ],
} as const

export const teamStrengthReferenceConditionsIdentity = stableContentHash({
  contract: 'soda-team-strength-reference-conditions/v1',
  potentialSixTeams: [...potentialSixKeys].sort(),
  sourceConditions,
  otherwise: 'declared-m0-p0-mechanic-reference',
})

export function currentTeamStrengthReferenceConditions(
  memberIds: readonly string[],
): TeamStrengthReferenceConditions {
  return potentialSixKeys.has([...memberIds].sort().join('|'))
    ? sourceConditions
    : { potentialByAgentId: {}, evidenceRefs: [] }
}
