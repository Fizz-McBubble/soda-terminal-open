export type L3MiyousheProductionCoverage = {
  readonly status: 'extends_existing' | 'new_independent_grain' | 'supersedes_existing'
  readonly mappingDecisionId: string
  readonly matchedProductionRecords: readonly {
    readonly recordId: string
    readonly entityId: string
    readonly fieldPath: string
    readonly value: string
    readonly conditions: readonly string[]
    readonly sourcePosts: readonly string[]
  }[]
  readonly relation: string
  readonly rationale: string
}
export type L3MiyousheCandidateClaim = {
  readonly strength: 'consensus' | 'limited'
  readonly claimKind: string
  readonly authorChain: string
  readonly authors: readonly string[]
  readonly posts: readonly string[]
  readonly conditions: readonly string[]
  readonly reviewedClaimId: string | null
  readonly contentHashes: readonly string[]
  readonly productionCoverage: L3MiyousheProductionCoverage | null
  readonly sourceEvaluation: boolean
  readonly formal: false
  readonly import: false
}
export type L3JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly L3JsonValue[]
  | { readonly [key: string]: L3JsonValue }
export type L3AgentDevelopmentEvidenceFact = {
  readonly recordId: string
  readonly fieldPath: string
  readonly sourceIds: readonly string[]
  readonly evidenceLocator: string | null
  readonly status: 'existing_verified' | 'candidate' | 'missing' | 'conflict' | 'gate'
  readonly partition: 'verified' | 'candidate' | 'gap'
  readonly value: L3JsonValue
  readonly gameVersion: string | null
  readonly valueType: string
  readonly unit: string | null
  readonly candidateClaim?: L3MiyousheCandidateClaim
}
