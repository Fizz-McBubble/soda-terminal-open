import type { currentPlanningConditionCatalogIdentity32 } from './currentPlanningConditionCatalog32'

export type PlanningConditionDef32 = {
  providerAgentId: string
  referenceKey: string
  label: string
  valueKind: 'boolean' | 'number' | 'enum'
  options?: Array<{ value: string | number | boolean; label: string }>
  minimum?: number
  maximum?: number
  sourceRefs: string[]
}

export type PlanningConditionCatalogInput32 = {
  subjectAgentId: string
  memberIds: readonly string[]
  equippedWEngines?: readonly { providerAgentId: string; engineId: string }[]
  equippedDriveDiscs?: readonly { providerAgentId: string; setId: string; pieces: number }[]
  sourceIdentity?: Readonly<{
    [K in keyof typeof currentPlanningConditionCatalogIdentity32]: string
  }>
}

export type PlanningConditionEvidence32 = {
  providerAgentId: string
  referenceKey: string
  engineId?: string
  discSetId?: string
  unit: 'boolean_state' | 'integer_stack' | 'source_enum'
  meaning: string
  integerOnly: boolean
  runtimeReference: string
  effectKeys: string[]
  eventScopes: Array<{
    effectKey: string
    applicationScope: string
    damageType: string | null
    eventIds: string[]
    sourceRefs?: string[]
  }>
  sourceRefs: string[]
}

export type PlanningConditionProjection32 = {
  status: 'supported' | 'unsupported'
  defs: PlanningConditionDef32[]
  evidence: PlanningConditionEvidence32[]
  blockedReferences: Array<{
    providerAgentId: string
    referenceKey: string
    reason: string
    sourceRefs: string[]
    eventScopes?: PlanningConditionEvidence32['eventScopes']
  }>
  derivedReferences: Array<{
    providerAgentId: string
    referenceKey: string
    engineId?: string
    producer: string
  }>
  blockers: string[]
  sourceIdentity: typeof currentPlanningConditionCatalogIdentity32
}
