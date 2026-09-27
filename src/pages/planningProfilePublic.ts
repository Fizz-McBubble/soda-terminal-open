import projection from '../data/agent-directions-public.v1.json'
import type { PlanningProfile } from './planningProfileTypes'

type PublicAgentDirectionEntry = {
  profile: Record<string, unknown>
  preferredStatKeys: string[]
}

const agents = (projection as { agents: Record<string, PublicAgentDirectionEntry> }).agents
const fallbackProfile = (projection as { fallbackProfile: Record<string, unknown> }).fallbackProfile

/**
 * Public resolver: the reviewed directions come from the build-time display projection of the
 * released catalog (no internal profile, constraint or evidence ledger is bundled). The pages read
 * the same subset they read on the desktop, so no page needs a second code path.
 */
export function getPlanningProfile(agentId: string): PlanningProfile {
  const entry = agents[agentId]
  if (!entry)
    return {
      ...fallbackProfile,
      agentId,
      agentName: agentId,
      id: `public-agent-directions-missing-${agentId}`,
    } as unknown as PlanningProfile
  return {
    ...entry.profile,
    // The evidence and constraint ledgers stay private; the projection carries the display fields.
    sourceEvidence: [],
    constraints: {},
  } as unknown as PlanningProfile
}

/** Published preferred sub-stat keys for one agent, or null when the agent is not published. */
export function publicPreferredStatKeys(agentId: string): string[] | null {
  const entry = agents[agentId]
  return entry ? [...entry.preferredStatKeys] : null
}
