import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { contentHash } from './contentHash'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

/** A light, synchronous UI change detector. The Worker returns the authoritative core fingerprint. */
export function browserCalculationInputFingerprint(input: AccountDecisionQueryInput): string {
  const projected = projectRemoteAccountDecisionInput(input)
  return contentHash({
    ...projected,
    warehouse: {
      ...projected.warehouse,
      roster: {
        ...projected.warehouse.roster,
        updatedAt: undefined,
        agents: projected.warehouse.roster.agents.map((agent) => ({
          ...agent,
          syncedAt: undefined,
        })),
      },
    },
  })
}
