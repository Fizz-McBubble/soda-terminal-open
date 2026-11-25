import { isCompleteFiniteTeamPlay, type FiniteTeamPlay } from './finiteTeamPlayContract'
import { contentHash } from '../application/contentHash'

export type TeamPlayMechanismProof = {
  contract: 'team-play-mechanism/v1'
  roleChecks: Array<{
    agentId: string
    role: string
    qualified: boolean
    basis: string[]
    channels: string[]
  }>
  requirements: Array<{
    agentId: string
    recipientAgentId?: string
    kind:
      | 'action'
      | 'effect'
      | 'resource'
      | 'recipient'
      | 'field_handoff'
      | 'original_anomaly'
      | 'primary_route'
    status: 'satisfied' | 'required' | 'unknown' | 'conflict'
    bindingKeys: string[]
    referenceKeys: string[]
    sourceRefs: string[]
  }>
}
type ProvenPlay = FiniteTeamPlay & { mechanismProof?: TeamPlayMechanismProof }
type Requirement = TeamPlayMechanismProof['requirements'][number]
const named = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(named)
const nonempty = (v: unknown): v is string[] => strings(v) && v.length > 0
const requirementKinds = new Set([
  'action',
  'effect',
  'resource',
  'recipient',
  'field_handoff',
  'original_anomaly',
  'primary_route',
])

/** Verifies the producer's source-backed joins; it cannot independently prove source truth. */
export function isAdmittedTeamPlay(play: ProvenPlay, key: string): boolean {
  if (!isCompleteFiniteTeamPlay(play, key)) return false
  const proof = play.mechanismProof
  if (
    !proof ||
    proof.contract !== 'team-play-mechanism/v1' ||
    !Array.isArray(proof.roleChecks) ||
    proof.roleChecks.length !== 3 ||
    new Set(proof.roleChecks.map((r) => r?.agentId)).size !== 3 ||
    !proof.roleChecks.every(
      (r) =>
        r &&
        play.roles.some((role) => role.agentId === r.agentId && role.role === r.role) &&
        r.qualified === true &&
        nonempty(r.basis) &&
        strings(r.channels),
    ) ||
    !Array.isArray(proof.requirements) ||
    !proof.requirements.every(
      (r) =>
        r &&
        play.memberIds.includes(r.agentId) &&
        (r.recipientAgentId === undefined || play.memberIds.includes(r.recipientAgentId)) &&
        requirementKinds.has(r.kind) &&
        (r.status === 'satisfied' || r.status === 'required') &&
        nonempty(r.bindingKeys) &&
        strings(r.referenceKeys) &&
        nonempty(r.sourceRefs),
    )
  )
    return false
  const has = (agentId: string, kind: Requirement['kind'], binding?: string, recipient?: string) =>
    proof.requirements.some(
      (r) =>
        r.agentId === agentId &&
        r.kind === kind &&
        (binding === undefined || r.bindingKeys.includes(binding)) &&
        (recipient === undefined || r.recipientAgentId === recipient),
    )
  const primary = play.primaryOutputAgentId
  const primaryRole = play.roles.find((r) => r.agentId === primary)!
  if (
    !primaryRole.eventIds.every((event) => has(primary, 'action', event)) ||
    !has(primary, 'resource') ||
    !has(primary, 'primary_route')
  )
    return false
  if (play.outputSystem === 'attribute_anomaly' && !has(primary, 'original_anomaly')) return false
  for (const link of play.contributions) {
    if (
      !link.eventIds.every((event) => has(link.providerAgentId, 'action', event)) ||
      !link.effectKeys.every((effect) =>
        has(link.providerAgentId, 'effect', effect, link.recipientAgentId),
      ) ||
      !has(link.providerAgentId, 'recipient', undefined, link.recipientAgentId) ||
      !has(link.providerAgentId, link.role === 'background_output' ? 'resource' : 'field_handoff')
    )
      return false
    if (link.role === 'ordinary_anomaly' && !has(link.providerAgentId, 'original_anomaly'))
      return false
  }
  // Condition keys are actual source/threshold bindings, not display labels.
  return play.conditions.every((condition) => {
    const kind = condition.kind === 'trigger' ? 'action' : condition.kind
    return (
      nonempty(condition.referenceKeys) &&
      condition.referenceKeys.every((ref) =>
        proof.requirements.some(
          (r) =>
            r.agentId === condition.agentId &&
            r.kind === kind &&
            (r.bindingKeys.includes(ref) || r.referenceKeys.includes(ref)),
        ),
      )
    )
  })
}

const sorted = (values: string[]) => [...values].sort()
const ordered = <T>(values: T[]) =>
  values
    .map((value) => ({ value, key: JSON.stringify(value) }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ value }) => value)
/** Identity retains all source, event, effect, state and threshold bindings, excluding presentation prose. */
export function canonicalTeamPlayIdentity(play: ProvenPlay): string {
  const proof = play.mechanismProof
  return contentHash({
    contract: play.contract,
    members: sorted(play.memberIds),
    primary: play.primaryOutputAgentId,
    system: play.outputSystem,
    roles: ordered(
      play.roles.map((r) => ({
        agentId: r.agentId,
        role: r.role,
        eventIds: sorted(r.eventIds),
        sourceRefs: sorted(r.sourceRefs),
      })),
    ),
    contributions: ordered(
      play.contributions.map((c) => ({
        providerAgentId: c.providerAgentId,
        recipientAgentId: c.recipientAgentId,
        role: c.role,
        state: c.state,
        effectKeys: sorted(c.effectKeys),
        eventIds: sorted(c.eventIds),
        sourceRefs: sorted(c.sourceRefs),
      })),
    ),
    conditions: ordered(
      play.conditions.map((c) => ({
        agentId: c.agentId,
        kind: c.kind,
        referenceKeys: sorted(c.referenceKeys),
        sourceRefs: sorted(c.sourceRefs),
      })),
    ),
    proof: proof && {
      contract: proof.contract,
      roles: ordered(
        proof.roleChecks.map((r) => ({
          agentId: r.agentId,
          role: r.role,
          qualified: r.qualified,
          basis: sorted(r.basis),
          channels: sorted(r.channels),
        })),
      ),
      requirements: ordered(
        proof.requirements.map((r) => ({
          agentId: r.agentId,
          recipientAgentId: r.recipientAgentId ?? null,
          kind: r.kind,
          status: r.status,
          bindingKeys: sorted(r.bindingKeys),
          referenceKeys: sorted(r.referenceKeys),
          sourceRefs: sorted(r.sourceRefs),
        })),
      ),
    },
  })
}

/** A family groups substitution alternatives, not interchangeable proofs or exact play IDs. */
export function teamPlayMechanismFamilyKey(play: ProvenPlay): string {
  const peer = (id: string) => {
    if (id === play.primaryOutputAgentId) return 'primary'
    const role = play.roles.find((r) => r.agentId === id)?.role ?? 'unknown'
    // Buff inventories (ATK vs damage vs crit, etc.) are substitution parameters.
    // They remain in the exact proof, not new families. Preserve actual jobs and
    // anomaly identity: an Ice supplier is not a Frost supplier, and a stun job
    // is not interchangeable with a background job merely because both buff.
    const mechanisms = sorted(
      (play.mechanismProof?.roleChecks.find((r) => r.agentId === id)?.channels ?? []).filter(
        (channel) =>
          channel.startsWith('anomaly:') ||
          channel === 'stun_window' ||
          channel === 'background_output',
      ),
    )
    return JSON.stringify({ role, mechanisms })
  }
  return contentHash({
    primary: play.primaryOutputAgentId,
    system: play.outputSystem,
    roles: ordered(
      play.roles.filter((r) => r.agentId !== play.primaryOutputAgentId).map((r) => peer(r.agentId)),
    ),
    links: ordered(
      play.contributions.map((c) => ({
        from: peer(c.providerAgentId),
        to: peer(c.recipientAgentId),
        role: c.role,
      })),
    ),
  })
}

/** Exact duplicates collapse deterministically; family alternatives remain separate. */
export function deduplicateTeamPlays<T extends ProvenPlay>(plays: T[]): T[] {
  const entries = plays.map((play) => ({
    play,
    id: canonicalTeamPlayIdentity(play),
    tie: JSON.stringify(play),
  }))
  entries.sort((a, b) => a.id.localeCompare(b.id) || a.tie.localeCompare(b.tie))
  return entries
    .filter((entry, index) => index === 0 || entry.id !== entries[index - 1].id)
    .map((entry) => entry.play)
}

/** Compact lookup into an untruncated ranking; row and variant ordinals refer to the supplied artifact. */
export function buildTeamMechanismCatalog(
  entries: readonly { row: number; key: string; variants: readonly FiniteTeamPlay[] }[],
) {
  const admitted = entries.flatMap(({ row, key, variants }) =>
    variants.flatMap((play, variant) =>
      isAdmittedTeamPlay(play, key)
        ? [
            {
              row,
              variant,
              key,
              family: teamPlayMechanismFamilyKey(play),
              id: canonicalTeamPlayIdentity(play),
            },
          ]
        : [],
    ),
  )
  // Choose the lowest artifact coordinates when an exact proof is repeated for a trio.
  admitted.sort(
    (a, b) =>
      a.row - b.row ||
      a.variant - b.variant ||
      a.key.localeCompare(b.key) ||
      a.id.localeCompare(b.id),
  )
  const seen = new Set<string>()
  const unique = admitted.filter((entry) => {
    const identity = JSON.stringify([entry.key, entry.id])
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
  const familyKeys = [...new Set(unique.map((entry) => entry.family))].sort()
  const playIds = [...new Set(unique.map((entry) => entry.id))].sort()
  const familyIndex = new Map(familyKeys.map((value, index) => [value, index]))
  const playIndex = new Map(playIds.map((value, index) => [value, index]))
  const rows: Array<[number, number, number, number]> = unique.map((entry) => [
    entry.row,
    entry.variant,
    familyIndex.get(entry.family)!,
    playIndex.get(entry.id)!,
  ])
  return { contract: 'finite-team-play-catalog/v1' as const, familyKeys, playIds, rows }
}
