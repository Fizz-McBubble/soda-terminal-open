import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { l3TeamRecommendationSeeds } from '../gameDataPacks/l3TeamRecommendationSeedProjection'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentitySourceRegistry } from '../gameDataPacks/currentReleasedIdentityMap'

export const current31SemanticCoverageRoles = [
  'primary_family',
  'third_agent_variant',
  'default_bangboo',
  'alternative_bangboo',
  'viable',
  'weak_substitute',
  'anti_pattern',
  'degraded',
  'structural_exclusion',
] as const

export type Current31SemanticCoverageRole = (typeof current31SemanticCoverageRoles)[number]

export type Current31SemanticCoverageSourceRef = {
  sourceId: string
  locator: string
  kind:
    | 'l3_provenance'
    | 'mechanic_contract'
    | 'gold_evidence'
    | 'reality_profile'
    | 'team_method'
    | 'anti_pattern'
}

export type Current31SemanticCoverageSample = {
  sampleId: string
  memberIds: readonly [string, string, string]
  exactFormationKey: string
  familyId: string
  familyStatus: 'aggregated' | 'exact_only'
  exactAgentVariantId: string
  bangbooId: string | null
  bangbooVariantId: string
  authority: 'semantic_coverage_only'
  runtimeUse: 'semantic_coverage_only'
  evidenceClass: 'legacy_product_synthesis' | 'mechanic_synergy_contract'
  strength: 'unknown'
  sourceRefs: readonly Current31SemanticCoverageSourceRef[]
}

export type Current31SemanticRoleCase = {
  role: Current31SemanticCoverageRole
  status: 'covered' | 'missing'
  sampleId: string | null
  exactFormationKey: string | null
  memberIds: readonly [string, string, string] | null
  bangbooId: string | null
  sourceRefs: readonly Current31SemanticCoverageSourceRef[]
  reason: string
  selectionStatus?: 'compatible_fallback' | 'no_activation_match'
  ruleDerivedBangbooId?: string
  ruleDerivedSourceIds?: readonly string[]
  hardPruneReason?: 'not_available_in_selected_scope'
  failureCode?: 'missing_core_agent' | 'no_eligible_third'
}

export type ReleasedAgent = (typeof currentAssetProjection.agents)[number]

export type MechanicSynergySeed = {
  seedId: string
  partnerIds: readonly string[]
  primaryOutputSource: string
  sourceMapIds: readonly string[]
}

export function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort((left, right) => left.localeCompare(right)).join('|')
}

export function asFormation(memberIds: readonly string[]): [string, string, string] | null {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return null
  return [memberIds[0]!, memberIds[1]!, memberIds[2]!]
}

// This is the frozen 3.1 semantic evidence cohort, not the growing installed directory.
// New release identities need their own samples before joining a later semantic gate.
const reviewed31AgentIds = new Set<string>([
  ...agentCatalog.map(([stableId]) => stableId),
  ...currentReleasedIdentitySourceRegistry.sources
    .filter((source) => source.sourceVersion === '3.1')
    .flatMap((source) => source.stableIds.filter((id) => id.startsWith('agent-'))),
])
export const releasedAgents: readonly ReleasedAgent[] = currentAssetProjection.agents
  .filter(
    (agent) =>
      agent.releaseState === 'released' &&
      agent.accountOwnable &&
      reviewed31AgentIds.has(agent.stableId),
  )
  .sort((left, right) => left.stableId.localeCompare(right.stableId))

export const releasedAgentIds = new Set(releasedAgents.map((agent) => agent.stableId))

export function isReleasedFormation(memberIds: readonly string[]) {
  return (
    memberIds.length === 3 &&
    new Set(memberIds).size === 3 &&
    memberIds.every((agentId) => releasedAgentIds.has(agentId))
  )
}

export function l3SourceRefs(seed: (typeof l3TeamRecommendationSeeds)[number]) {
  const sourceRefs: Current31SemanticCoverageSourceRef[] = seed.source_map_ids.map((sourceId) => ({
    sourceId,
    locator: `${seed.provenance.sheet} row ${seed.provenance.row}`,
    kind: 'l3_provenance',
  }))
  sourceRefs.push({
    sourceId: `l3-seed:${seed.seed_id}`,
    locator: `${seed.provenance.sheet} row ${seed.provenance.row}; ${seed.team_name}`,
    kind: 'l3_provenance',
  })
  return sourceRefs
}

export function mechanicSourceRefs(agentId: string, seed: MechanicSynergySeed) {
  const refs: Current31SemanticCoverageSourceRef[] = seed.sourceMapIds.map((sourceId) => ({
    sourceId,
    locator: `${agentId}/${seed.seedId}`,
    kind: 'mechanic_contract',
  }))
  refs.push({
    sourceId: `mechanic:${agentId}:${seed.seedId}`,
    locator: seed.primaryOutputSource,
    kind: 'mechanic_contract',
  })
  return refs
}
