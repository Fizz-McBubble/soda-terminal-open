import generated from './generated/l3-40356c64ad0d6d5a5e01/teamRecommendationSeeds.json'

export type ProductSynthesisTeamSeed = {
  schema: 'soda-product-synthesis-team-seed/v1'
  seed_id: string
  seed_type: 'product_synthesis_candidate_seed'
  source_class: 'user_confirmed_product_synthesis'
  strength: 'product_synthesis_candidate_seed'
  terminal: 'current_limited' | 'historical_continuity'
  team_name: string
  member_stable_ids: readonly [string, string, string]
  members_original: readonly [string, string, string]
  team_formation_version: string
  formation_version_meaning: string
  current_status_3_1: string
  system: string
  primary_output_source: string
  scene: string
  alternatives: string
  bangboo: string
  evaluation: {
    single_target_1_5: number
    group_1_5: number
    burst_1_5: number
    sustain_1_5: number
    operation_difficulty_1_5: number
    development_cost_1_5: number
    non_damage_tier: string
    non_damage_index: number
    disclaimer: string
  }
  source_map_ids: readonly string[]
  source_map_match: boolean
  source_confidence: string
  notes: string
  production_dedup: {
    relation: 'extends_existing' | 'new_product_seed'
    matchedTemplateIds: readonly string[]
  }
  provenance: {
    kind: 'user_confirmed_product_synthesis'
    row: number
    sheet: 'TEAM_RECOMMENDATIONS_3.1'
    workbookSha256: string
    cells: Readonly<Record<string, string | readonly string[]>>
    rawExtractIdentity: {
      extractPath: string
      extractSha256: string
      workbookKey: 'GPT_R2'
      workbookSha256: string
      boundary: string
    }
  }
  boundaries: {
    community_evidence: false
    formal: false
    import: false
    dps: false
    mathematical_optimum: false
    complete_template: false
    hard_gate_authority: false
  }
}

export type ProductSynthesisPersonalizationInput = Pick<
  ProductSynthesisTeamSeed,
  | 'seed_id'
  | 'terminal'
  | 'team_name'
  | 'member_stable_ids'
  | 'scene'
  | 'alternatives'
  | 'bangboo'
  | 'evaluation'
>

const data = generated as unknown as {
  schema: 'soda-static-product-synthesis-team-seeds/v1'
  packageId: string
  partitionSha256: string
  seeds: ProductSynthesisTeamSeed[]
}

export const l3TeamRecommendationSeedProjectionIdentity = {
  packageId: data.packageId,
  partitionSha256: data.partitionSha256,
  seedCount: data.seeds.length,
} as const

export const l3TeamRecommendationSeeds: readonly ProductSynthesisTeamSeed[] = Object.freeze(
  data.seeds,
)

export function getL3TeamRecommendationSeed(seedId: string) {
  return l3TeamRecommendationSeeds.find((seed) => seed.seed_id === seedId) ?? null
}

export function listL3TeamRecommendationSeeds(terminal?: ProductSynthesisTeamSeed['terminal']) {
  return terminal
    ? l3TeamRecommendationSeeds.filter((seed) => seed.terminal === terminal)
    : l3TeamRecommendationSeeds
}

export function getL3TeamRecommendationPersonalizationInputs(): readonly ProductSynthesisPersonalizationInput[] {
  return l3TeamRecommendationSeeds.map(
    ({
      seed_id,
      terminal,
      team_name,
      member_stable_ids,
      scene,
      alternatives,
      bangboo,
      evaluation,
    }) => ({
      seed_id,
      terminal,
      team_name,
      member_stable_ids,
      scene,
      alternatives,
      bangboo,
      evaluation,
    }),
  )
}
