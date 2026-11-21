export const finiteTeamPlayContract = 'finite-three-member-play/v2' as const
export type TeamPlayRoleKind =
  | 'primary_output'
  | 'support'
  | 'stun'
  | 'ordinary_anomaly'
  | 'background_output'
  | 'activation_partner'
export type TeamPlayRole = {
  agentId: string
  role: TeamPlayRoleKind
  purpose: string
  eventIds: string[]
  sourceRefs: string[]
}
export type TeamPlayCondition = {
  agentId: string
  kind: 'trigger' | 'recipient' | 'field_handoff' | 'resource' | 'original_anomaly'
  label: string
  referenceKeys: string[]
  sourceRefs: string[]
}
export type TeamPlayContribution = {
  providerAgentId: string
  recipientAgentId: string
  role: Exclude<TeamPlayRoleKind, 'primary_output'>
  effectKeys: string[]
  eventIds: string[]
  state: 'active' | 'conditional'
  sourceRefs: string[]
}
export type FiniteTeamPlay = {
  contract: typeof finiteTeamPlayContract
  memberIds: string[]
  primaryOutputAgentId: string
  outputSystem: 'direct_damage' | 'attribute_anomaly' | 'rupture' | 'aftershock' | 'sharp'
  roles: TeamPlayRole[]
  contributions: TeamPlayContribution[]
  conditions: TeamPlayCondition[]
  reason: string
  tradeoffs: string[]
  /** Source-bound admission is separate from the older structural contract. */
  mechanismProof?: import('./teamPlayMechanismContract').TeamPlayMechanismProof
}
const named = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(named)
const sourced = (value: unknown): value is string[] => strings(value) && value.length > 0
const kinds = new Set(['trigger', 'recipient', 'field_handoff', 'resource', 'original_anomaly'])
const roles = new Set<TeamPlayRoleKind>([
  'primary_output',
  'support',
  'stun',
  'ordinary_anomaly',
  'background_output',
  'activation_partner',
])

/** Validate a producer's linked three-member play, not merely three role labels.
 * Source truth is established by its producer; this rejects incomplete joins. */
export function isCompleteFiniteTeamPlay(play: FiniteTeamPlay | null | undefined, key: string) {
  if (
    !play ||
    play.contract !== finiteTeamPlayContract ||
    !strings(play.memberIds) ||
    play.memberIds.length !== 3 ||
    new Set(play.memberIds).size !== 3 ||
    [...play.memberIds].sort().join('|') !== key ||
    !play.memberIds.includes(play.primaryOutputAgentId) ||
    !['direct_damage', 'attribute_anomaly', 'rupture', 'aftershock', 'sharp'].includes(
      play.outputSystem,
    ) ||
    !Array.isArray(play.roles) ||
    play.roles.length !== 3 ||
    new Set(play.roles.map((role) => role?.agentId)).size !== 3 ||
    !play.roles.every(
      (role) =>
        role &&
        play.memberIds.includes(role.agentId) &&
        roles.has(role.role) &&
        named(role.purpose) &&
        strings(role.eventIds) &&
        sourced(role.sourceRefs),
    ) ||
    play.roles.filter((role) => role.role === 'primary_output').length !== 1 ||
    !play.roles.some(
      (role) =>
        role.agentId === play.primaryOutputAgentId &&
        role.role === 'primary_output' &&
        role.eventIds.length > 0,
    ) ||
    !Array.isArray(play.conditions) ||
    !play.conditions.length ||
    !play.conditions.every(
      (condition) =>
        condition &&
        play.memberIds.includes(condition.agentId) &&
        kinds.has(condition.kind) &&
        named(condition.label) &&
        strings(condition.referenceKeys) &&
        sourced(condition.sourceRefs),
    ) ||
    !Array.isArray(play.contributions) ||
    play.contributions.length < 2 ||
    !named(play.reason) ||
    !sourced(play.tradeoffs)
  )
    return false
  const hasCondition = (id: string, kind: TeamPlayCondition['kind']) =>
    play.conditions.some((condition) => condition.agentId === id && condition.kind === kind)
  if (!hasCondition(play.primaryOutputAgentId, 'resource')) return false
  for (const link of play.contributions) {
    const role = play.roles.find((candidate) => candidate.agentId === link?.providerAgentId)
    if (
      !role ||
      role.role === 'primary_output' ||
      role.role !== link.role ||
      link.recipientAgentId !== play.primaryOutputAgentId ||
      !['active', 'conditional'].includes(link.state) ||
      !sourced(link.sourceRefs) ||
      !strings(link.eventIds) ||
      !link.eventIds.every((event) => role.eventIds.includes(event)) ||
      !strings(link.effectKeys)
    )
      return false
    if (role.role === 'support') {
      if (
        !link.effectKeys.length ||
        !hasCondition(role.agentId, 'trigger') ||
        !hasCondition(role.agentId, 'recipient')
      )
        return false
    } else {
      if (!link.eventIds.length || !link.eventIds.every((event) => role.eventIds.includes(event)))
        return false
      if (
        !hasCondition(
          role.agentId,
          role.role === 'background_output' ? 'resource' : 'field_handoff',
        )
      )
        return false
      if (role.role === 'ordinary_anomaly' && !hasCondition(role.agentId, 'original_anomaly'))
        return false
      if (role.role === 'activation_partner' && !link.effectKeys.length) return false
    }
  }
  return play.roles.every(
    (role) =>
      role.role === 'primary_output' ||
      play.contributions.some((link) => link.providerAgentId === role.agentId),
  )
}
