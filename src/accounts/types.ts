import { z } from 'zod'
import type { AccountRoster, ScenarioResult } from '../assault/types'
import type { ScanImportBatchMeta, ScanImportItem } from '../domain/scanImportStaging'
import type { DiscEvaluation, DriveDisc } from '../domain/schemas'

export const accountIdSchema = z.string().regex(/^account-[a-z0-9][a-z0-9-]{2,63}$/)

export const accountProfileSchema = z.object({
  id: accountIdSchema,
  displayName: z.string().trim().min(1).max(40),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isDefault: z.boolean(),
  status: z.enum(['active', 'archived']),
  source: z.enum(['manual', 'legacy_migration', 'backup_restore']),
})

export type AccountProfile = z.infer<typeof accountProfileSchema>

export type AccountScope = {
  scopedId: string
  accountId: string
  sourceLegacyId: string | null
  migratedAt: string | null
}

export type AccountDriveDisc = DriveDisc & AccountScope
export type AccountDiscEvaluation = DiscEvaluation & AccountScope
export type AccountScanImportBatch = ScanImportBatchMeta & AccountScope
export type AccountScanImportItem = ScanImportItem & AccountScope

export type AccountRosterRecord = {
  accountId: string
  roster: AccountRoster
  updatedAt: string
  source: 'manual' | 'legacy_migration' | 'backup_restore'
}

export type AccountOptimizationResult = {
  scopedId: string
  accountId: string
  id: string
  result: ScenarioResult
  createdAt: string
  sourceLegacyId: string | null
}

export type AccountPreference = {
  scopedId: string
  accountId: string
  key: string
  value: unknown
  updatedAt: string
}

export type PlanningSolutionScope = 'agent_independent' | 'team_joint' | 'portfolio_joint'

export type PlanningResourcePolicy = 'advisory' | 'within_team_exclusive' | 'cross_team_exclusive'

export type PlanningSolutionContext = {
  contract: 'soda-solution-context/v1'
  scope: PlanningSolutionScope
  resourcePolicy: PlanningResourcePolicy
  sourceCandidateId: string
  inputFingerprint: string
  solverMethod: string
  gameVersion: string
  knowledgeVersion: string
  exactVariantKey: string | null
  /** Explicit comparison choices, saved only with the player-owned proposal. */
  comparisonParameters?: {
    wEngine?: { engineId: string; level: number; ascension?: number; refinement: number }
    potential?: number
  }
}

/** A player-owned loadout proposal. It deliberately stores directions and references only. */
export type AccountPlanningDraft = {
  scopedId: string
  accountId: string
  id: string
  kind: 'agent' | 'team'
  name: string
  state: 'draft' | 'saved'
  selection: {
    agentIds: string[]
    bangbooId: string | null
    scenario: string
  }
  manualOverrides: {
    wEngineDirection: string
    discDirection: string
    progressionDirection: string
    notes: string
  }
  knowledgeRefs: Array<{
    profileId: string
    status: 'formal' | 'candidate' | 'missing'
    version: string
    source: string
  }>
  warehouseRefs: string[]
  /** Added by v9. Legacy rows without this field are migrated before new writes are enabled. */
  solutionContext?: PlanningSolutionContext
  /** Agent plans only: the single restorable reference or a retained legacy/history alternative. */
  savedRole?: 'current_reference' | 'history'
  /** Candidate-only snapshot for restoring a concrete warehouse comparison without asset writes. */
  candidateWarehouse?: {
    inventoryTransition?: true
    scope: 'agent' | 'team' | 'portfolio'
    totalScore: number
    loadouts: Array<{
      agentId: string
      totalScore: number
      discIds: string[]
      effectiveRolls: number
      setPattern: '4+2' | '2+2+2' | 'scattered'
      degraded: boolean
    }>
    boundary: string
    panelObjectiveNote?: string
  }
  /** Exact read-only execution projection captured with a saved team result for faithful restore. */
  teamExecutionSnapshot?: import('../decision/teamExecutionProjection').TeamExecution
  /**
   * Exact read-only simultaneous multi-team projection.  Legacy and ordinary
   * three-agent team drafts intentionally omit it.
   */
  teamPortfolioSnapshot?: import('../decision/teamExecutionProjection').TeamExecutionPortfolio
  /** Frozen source-consumed constraints and potential state for a simultaneous portfolio replay. */
  teamPortfolioBuildIntent?: import('../decision/buildIntent').PortfolioJointBuildIntent
  /**
   * Minimal per-disc score evidence from the saved portfolio solve.  This is
   * deliberately a reference to the account disc ids rather than a second copy
   * of the player's discs, so historical card readback never recalculates or
   * invents a score when an asset later disappears.
   */
  teamPortfolioDiscChoices?: {
    contract: 'soda-team-portfolio-disc-choices/r1'
    loadouts: Array<{
      agentId: string
      choices: Array<{
        discId: string
        score: number
        mainStatScore: number
        subStatScore: number
        effectiveLines: number
        effectiveRolls: number
        wastedUpgrades: number
        reasons: string[]
      }>
    }>
  }
  /**
   * Exact normalized equipment parameters used by a newly saved team calculation. Historical
   * drafts deliberately remain readable without it, but cannot be treated as current results.
   */
  teamEquipmentParameters?: import('../decision/targetTeamEquipmentParameters').EffectiveTargetTeamEquipmentParameters
  planningBenchmark32?: import('../application/publicSavedPlanningBenchmark32').SavedPlanningBenchmark32
  teamAccountFactBinding?: import('../application/publicAuthorComparisonAccountBinding').AuthorComparisonAccountBinding
  comparisonCapability: 'formal' | 'direction'
  createdAt: string
  updatedAt: string
  revision: number
}

export function getScopedId(accountId: string, id: string) {
  return `${accountId}:${id}`
}

export function getAccountDisplayLabel(account: AccountProfile) {
  return `${account.displayName} · 创建 ${account.createdAt.slice(0, 10)} · 更新 ${account.updatedAt.slice(0, 10)} · ${account.id.slice(-8)}`
}

export function scopeLegacyEntity<T extends { id: string }>(
  accountId: string,
  entity: T,
  migratedAt: string,
): T & AccountScope {
  return {
    ...entity,
    scopedId: getScopedId(accountId, entity.id),
    accountId,
    sourceLegacyId: entity.id,
    migratedAt,
  }
}
