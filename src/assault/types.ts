import type { DriveDisc } from '../domain/schemas'

export type OptimizationScope =
  | 'single_agent'
  | 'single_team'
  | 'roster_independent'
  | 'account_global'
  | 'deadly_assault'
  | 'custom'

export type OptimizationScenario = {
  id: string
  rotationId: string | null
  scope: OptimizationScope
  gameVersion: string
  agentIds: string[]
  enemyIds: string[]
  buffs: Array<{ id: string; coverage: number; source: string; target: 'self' | 'team' }>
  objective: 'template_score' | 'team_damage' | 'reward_lexicographic'
  discReuse: 'independent' | 'globally_unique'
  minimumTarget: number | null
  fixedDiscIds: string[]
  excludedDiscIds: string[]
  lockedAgentIds: string[]
  excludedAgentIds: string[]
  lockedTeamIds: string[]
  excludedTeamIds: string[]
  enemyModel?: {
    defenseMultiplier: number
    resistanceMultiplier: number
    stunMultiplier: number
    verified: boolean
    source: string
  }
}

export type ObservedAgentField =
  | 'owned'
  | 'level'
  | 'ascension'
  | 'mindscape'
  | `skillLevels.${'basic' | 'dodge' | 'assist' | 'special' | 'chain' | 'core'}`
  | `wEngineDetails.${'id' | 'name' | 'level' | 'ascension' | 'refinement'}`
  | 'equippedDiscIds'

export type ObservedAgentFacts = {
  schemaVersion: 1
  source: 'asset_quick_read'
  protocolVersion: '3.2'
  fields: Partial<Record<ObservedAgentField, { capturedAt: string; snapshotSha256: string }>>
}

export type RosterAgent = {
  agentId: string
  owned: boolean
  priority: number
  level: number
  /** Optional explicit phase at a level boundary; old rows retain the existing derived default. */
  ascension?: number | null
  mindscape: number
  /** Only agents carrying the catalog capability use this field. */
  potentialImage?: number | null
  skills: string
  wEngine: string
  refinement: number
  agentVersion: string
  completeness: 'complete' | 'partial' | 'missing'
  currentEquipment: 'known' | 'unknown'
  source: 'manual' | 'roster_snapshot' | 'showcase' | 'external_export' | 'asset_quick_read'
  /** Per-field provenance from an explicitly confirmed observation, never a manual override. */
  observedFacts?: ObservedAgentFacts
  manualSource: 'manual_initial_default' | 'manual_override' | null
  /** Distinguishes a deliberate progression edit from the account baseline projection. */
  progressionManuallySet?: boolean
  syncedAt: string
  lockedFields: string[]
  skillLevels: {
    basic: number | null
    dodge: number | null
    assist: number | null
    special: number | null
    chain: number | null
    core: number | null
  }
  wEngineDetails: {
    id: string | null
    name: string | null
    level: number | null
    ascension?: number | null
    refinement: number | null
  }
  /** Legacy compatibility reference only. New production reads use wEngineDetails. */
  wEngineCopyId: string | null
  equippedDiscIds: string[] | null
  damageInput?: {
    attack: number
    multiplier: number
    damageBonus: number
    critRate: number
    critDamage: number
    anomalyDamage: number
    cycleSeconds: number
    source: string
    updatedAt: string
  }
}

export type AccountRoster = {
  schemaVersion: 3
  sourceCompleteness: 'complete' | 'partial' | 'showcase'
  agents: RosterAgent[]
  bangboos: Array<{
    bangbooId: string
    owned: boolean
    level: number | null
    stars: number | null
    /** Explicit player-confirmed levels; legacy rows migrate to null. */
    skillLevel: number | null
    additionalAbilityLevel: number | null
    manualSource: 'manual_initial_default' | 'manual_override' | null
    /** A missing marker uses the S-rank one-star account baseline. */
    starsManuallySet?: boolean
  }>
  wEngines?: Array<{
    copyId: string
    engineId: string
    level: number
    refinement: number
    equippedAgentId: string | null
    manualSource: 'manual_initial_default' | 'manual_override'
    /** A missing marker uses the S-rank refinement-one account baseline. */
    refinementManuallySet?: boolean
  }>
  updatedAt: string
}

export type AssignedDisc = { disc: DriveDisc; score: number; effectiveHits: number }
export type AgentLoadout = {
  agentId: string
  discs: AssignedDisc[]
  totalScore: number
  confidence: 'high' | 'medium' | 'low'
  boundary: string
}

export type DamageBreakdown = {
  status: 'supported' | 'estimated' | 'unsupported'
  direct: number | null
  anomaly: number | null
  cycleDamage: number | null
  dps: number | null
  scoreEstimate: { low: number; high: number } | null
  factors: Array<{ label: string; value: number; source: string }>
  boundary: string
}

export type ScenarioResult = {
  scenario: OptimizationScenario
  loadouts: AgentLoadout[]
  teams: Array<{
    id: string
    bossId: string | null
    agentIds: string[]
    bangbooId: string | null
    damage: DamageBreakdown
    reachedMinimum: boolean | null
    reasons: string[]
  }>
  reachedTargets: number
  totalScore: number
  riskCount: number
  warnings: string[]
  warehouseHash: string
  rosterHash: string
  dataVersion: string
  modelVersion: string
  elapsedMs: number
}
