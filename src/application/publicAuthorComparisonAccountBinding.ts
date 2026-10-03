import type { CoreWarehouse } from '../accounts/coreFlow'
import { contentHash } from './contentHash'

export type AuthorComparisonAccountBinding = {
  kind: 'account_fact_binding'
  bangbooId: null
  sourceFingerprint: string
  memberIds: string[]
  accountEquipmentHash: string
  fingerprint: string
}

/** Physical account facts, including absent engines, never source-recommended gear defaults. */
export function authorComparisonAccountBinding(
  warehouse: CoreWarehouse,
  memberIds: readonly string[],
  sourceFingerprint: string,
): AuthorComparisonAccountBinding {
  const ids = [...memberIds].sort()
  const facts = {
    agents: warehouse.roster.agents
      .filter((row) => ids.includes(row.agentId))
      .sort((a, b) => a.agentId.localeCompare(b.agentId)),
    wEngines: [...(warehouse.roster.wEngines ?? [])].sort((a, b) =>
      a.copyId.localeCompare(b.copyId),
    ),
  }
  const body = {
    kind: 'account_fact_binding' as const,
    bangbooId: null,
    sourceFingerprint,
    memberIds: ids,
    accountEquipmentHash: contentHash(facts),
  }
  return { ...body, fingerprint: contentHash(body) }
}
