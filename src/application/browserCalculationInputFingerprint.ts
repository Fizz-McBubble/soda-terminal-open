import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { contentHash } from './contentHash'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

// Owned inputs can also be mutated in place. Retain a digest only while both the
// object and its projected serializable content still match the previous call.
const observed = new WeakMap<AccountDecisionQueryInput, { serialized: string; digest: string }>()

/** A light, synchronous UI change detector. The Worker returns the authoritative core fingerprint. */
export function browserCalculationInputFingerprint(input: AccountDecisionQueryInput): string {
  const projected = projectRemoteAccountDecisionInput(input)
  const serialized = JSON.stringify(projected)
  const previous = observed.get(input)
  if (previous?.serialized === serialized) return previous.digest
  const digest = contentHash({
    ...projected,
    // The core fingerprint treats this legacy display preference as non-calculating.
    preference: { ...projected.preference, favoriteAgentIds: [] },
    drafts: [...projected.drafts].sort((a, b) => a.id.localeCompare(b.id)),
    warehouse: {
      ...projected.warehouse,
      discs: [...projected.warehouse.discs].sort((a, b) => a.id.localeCompare(b.id)),
      roster: {
        ...projected.warehouse.roster,
        updatedAt: undefined,
        agents: [...projected.warehouse.roster.agents]
          .sort((a, b) => a.agentId.localeCompare(b.agentId))
          .map((agent) => ({ ...agent, syncedAt: undefined })),
      },
    },
  })
  observed.set(input, { serialized, digest })
  return digest
}
