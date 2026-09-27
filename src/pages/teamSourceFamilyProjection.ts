import { currentReviewedTeamSourceSlotGroups } from '../gameDataPacks/reviewedTeamSourceDirections'
import {
  current31TeamCoreAggregation,
  resolveCurrent31TeamFamily,
} from '../decision/current31TeamCoreAggregation'
import { agentCatalog } from '../assault/catalogData'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'

type Trio = readonly [string, string, string]
const keyOf = (members: readonly string[]) => [...members].sort().join('|')
type SourceFamilyOptions = {
  acceptsCore?: (coreAgentIds: readonly string[]) => boolean
  establishedFamilies?: readonly { familyId: string; coreAgentIds: readonly string[] }[]
}

/** A source slot is a presentation relationship, never a rating or Bangboo authority. */
export function buildSourceFamilyProjection(
  groups: readonly (readonly Trio[])[],
  options: SourceFamilyOptions = {},
) {
  const establishedByCore = new Map(
    (options.establishedFamilies ?? [])
      .filter((family) => family.coreAgentIds.length === 2)
      .map((family) => [keyOf(family.coreAgentIds), family.familyId]),
  )
  const proposals = new Map<
    string,
    { familyId: string; coreAgentIds: string[]; keys: Set<string> }
  >()
  for (const group of groups) {
    const exacts = [...new Map(group.map((members) => [keyOf(members), members])).values()]
    if (exacts.length < 2 || exacts.some((members) => new Set(members).size !== 3)) continue
    const core = exacts[0]!.filter((id) => exacts.every((members) => members.includes(id))).sort()
    if (core.length !== 2) continue
    const coreKey = keyOf(core)
    if (!establishedByCore.has(coreKey) && options.acceptsCore?.(core) === false) continue
    const proposal = proposals.get(coreKey) ?? {
      familyId: establishedByCore.get(coreKey) ?? `source-core:${coreKey}`,
      coreAgentIds: core,
      keys: new Set<string>(),
    }
    // Merge only complete, explicitly reviewed replacement slots with the same
    // fixed pair. Union observed trios; never enumerate new combinations.
    for (const members of exacts) proposal.keys.add(keyOf(members))
    proposals.set(coreKey, proposal)
  }
  const memberships = new Map<string, string[]>()
  for (const proposal of proposals.values())
    for (const key of proposal.keys)
      memberships.set(key, [...(memberships.get(key) ?? []), proposal.familyId])
  const result = new Map<string, { familyId: string; coreAgentIds: string[] }>()
  for (const proposal of proposals.values()) {
    // Different source slots may give a trio different roles. Do not resolve that
    // ambiguity by array order or transitively merge the two teams' cores.
    const keys = [...proposal.keys].filter((key) => memberships.get(key)?.length === 1)
    if (keys.length < 2) continue
    for (const key of keys)
      result.set(key, { familyId: proposal.familyId, coreAgentIds: proposal.coreAgentIds })
  }
  return result
}

let sourceFamilies: ReturnType<typeof buildSourceFamilyProjection> | undefined
const outputAgentIds = new Set<string>(
  agentCatalog
    .filter(
      (agent) =>
        ['damage', 'anomaly', 'rupture'].includes(agent[2]) ||
        (agent[2] === 'defense' &&
          ['primary_field', 'dominant_field'].includes(
            getCurrentAgentDecisionMechanicContract(agent[0])?.fieldTimeContract?.mode ?? '',
          )),
    )
    .map((agent) => agent[0]),
)
export function resolveTeamPresentationFamily(memberIds: Trio) {
  const known = resolveCurrent31TeamFamily(memberIds)
  if (known.status === 'aggregated') return known
  sourceFamilies ??= buildSourceFamilyProjection(currentReviewedTeamSourceSlotGroups(), {
    establishedFamilies: current31TeamCoreAggregation.families,
    // A guide's reusable support pair can serve different damage teams. Keep
    // those teams distinct instead of naming both after their shared supports.
    acceptsCore: (core) => core.some((id) => outputAgentIds.has(id)),
  })
  const source = sourceFamilies.get(keyOf(memberIds))
  return source ? { ...source, status: 'aggregated' as const } : known
}
