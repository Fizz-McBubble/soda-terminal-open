import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import {
  graduationCandidateProfileProjectionIdentity,
  graduationCandidateProfiles,
} from './generated/graduationCandidateProfiles'

export { graduationCandidateProfileProjectionIdentity }
export type GraduationCandidateProfile = (typeof graduationCandidateProfiles)[number]

function sourceAgentId(agentId: string) {
  const resolved = resolveCurrentReleasedIdentity(agentId)
  return resolved === 'agent-remielle' ? 'candidate-3.1-agent-remielle' : resolved
}

/**
 * Read-only runtime projection for the frozen Candidate Graduation Profile sidecar.
 * It intentionally has no Formal fallback and does not feed legacy target_panel data.
 */
export function getGraduationCandidateProfile(agentId: string): GraduationCandidateProfile | null {
  const profile = graduationCandidateProfiles.find(
    (item) => item.agentId === sourceAgentId(agentId),
  )
  if (!profile || profile.model_candidate !== true || profile.formal_supported !== false)
    return null
  return profile
}
