import { koledaFixedEventConditionsInputSchema32 } from '../application/publicKoledaFixedEventConditions32'
import { savedPlanningBenchmark32Schema } from '../application/publicSavedPlanningBenchmark32'
import { z } from 'zod'
import { rosterSnapshotSchema } from './publicRosterSnapshot'
import { databaseSchemaVersion } from '../db/databaseCore'
import { scanImportBatchMetaSchema, scanImportItemSchema } from '../domain/scanImportStaging'
import { discEvaluationSchema, driveDiscSchema, statKeySchema } from '../domain/schemas'
import { accountIdSchema, accountProfileSchema } from './types'
import { accountScopeShape, optimizationResultSchema } from './backupRecordSchemas'
import {
  authorComparisonMembershipSchema,
  authorComparisonAccountFactBindingSchema,
  refineAuthorComparisonBangbooIdentity,
} from './backupAuthorComparisonSchemas'

export const accountBackupFormat = 'soda-terminal-account-backup'
export const accountBackupFormatVersion = 1
export const vaultBackupFormat = 'soda-terminal-vault-backup'
export const vaultBackupFormatVersion = 1

const preferenceSchema = z.object({
  scopedId: z.string().min(1),
  accountId: accountIdSchema,
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.string().datetime(),
})

const planningSolutionContextSchema = z.object({
  contract: z.literal('soda-solution-context/v1'),
  scope: z.enum(['agent_independent', 'team_joint', 'portfolio_joint']),
  resourcePolicy: z.enum(['advisory', 'within_team_exclusive', 'cross_team_exclusive']),
  sourceCandidateId: z.string().min(1),
  inputFingerprint: z.string().min(1),
  solverMethod: z.string().min(1),
  gameVersion: z.string().min(1),
  knowledgeVersion: z.string().min(1),
  exactVariantKey: z.string().min(1).nullable(),
  comparisonParameters: z
    .object({
      wEngine: z
        .object({
          engineId: z.string().min(1),
          level: z.number().int().min(1).max(60),
          ascension: z.number().int().min(0).max(5).optional(),
          refinement: z.number().int().min(1).max(5),
        })
        .optional(),
      potential: z.number().int().min(0).max(6).optional(),
    })
    .optional(),
})

const candidateWarehouseSchema = z.object({
  inventoryTransition: z.literal(true).optional(),
  scope: z.enum(['agent', 'team', 'portfolio']),
  totalScore: z.number(),
  loadouts: z.array(
    z.object({
      agentId: z.string().min(1),
      totalScore: z.number(),
      discIds: z.array(z.string().min(1)),
      effectiveRolls: z.number(),
      setPattern: z.enum(['4+2', '2+2+2']),
      degraded: z.boolean(),
    }),
  ),
  boundary: z.string(),
  panelObjectiveNote: z.string().optional(),
})

const teamEquipmentParameterSelectionSchema = z
  .object({
    wEngines: z.array(
      z
        .object({
          agentId: z.string().min(1),
          engineId: z.string().min(1),
          refinement: z.number().int().min(0),
          level: z.number().int().min(1).max(60).optional(),
          ascension: z.number().int().min(0).max(5).optional(),
        })
        .strict(),
    ),
    potentialByAgentId: z.record(z.string().min(1), z.number().int().min(0).max(6)).optional(),
    koledaFixedEventConditions32: koledaFixedEventConditionsInputSchema32.optional(),
    bangbooId: z.string().min(1),
    bangbooStars: z.number().int().min(0),
  })
  .strict()

const teamEquipmentParametersSchema = teamEquipmentParameterSelectionSchema
  .extend({
    source: z.enum(['source_defaults', 'player_confirmed']),
  })
  .strict()

const teamExecutionWEngineSchema = z
  .object({
    engineId: z.string().min(1),
    copyId: z.string().min(1).nullable(),
    refinement: z.number().int().min(0),
    fact: z.enum([
      'confirmed',
      'manual_initial_default_assumption',
      'scheme_default_recommendation',
      'source_default_parameter',
      'player_confirmed_parameter',
    ]),
  })
  .strict()

const teamExecutionActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('keep_current_build'), agentId: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('change_w_engine'),
      agentId: z.string().min(1),
      fromCopyId: z.string().min(1).nullable(),
      toCopyId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('change_discs'),
      agentId: z.string().min(1),
      removeDiscIds: z.array(z.string().min(1)),
      equipDiscIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      kind: z.literal('borrow_w_engine'),
      agentId: z.string().min(1),
      copyId: z.string().min(1),
      fromAgentId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('borrow_discs'),
      agentId: z.string().min(1),
      discIds: z.array(z.string().min(1)),
      fromAgentIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      kind: z.literal('confirm_w_engine_fact'),
      agentId: z.string().min(1),
      engineId: z.string().min(1),
      reason: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('missing_equipment'),
      agentId: z.string().min(1),
      equipment: z.enum(['w_engine', 'drive_disc']),
      reason: z.string(),
    })
    .strict(),
])

const teamExecutionImpactSchema = z
  .object({
    kind: z.enum(['current_equipment', 'active_plan', 'saved_plan']),
    equipment: z.enum(['w_engine', 'drive_disc']),
    assetIds: z.array(z.string().min(1)),
    agentId: z.string().min(1).nullable(),
    planId: z.string().min(1).nullable(),
    planName: z.string().min(1).nullable(),
  })
  .strict()

const teamExecutionMemberSchema = z
  .object({
    agentId: z.string().min(1),
    current: z
      .object({ wEngineCopyId: z.string().min(1).nullable(), discIds: z.array(z.string().min(1)) })
      .strict(),
    suggested: z
      .object({
        wEngine: teamExecutionWEngineSchema.nullable(),
        discIds: z.array(z.string().min(1)),
      })
      .strict(),
    actions: z.array(teamExecutionActionSchema),
    impacts: z.array(teamExecutionImpactSchema),
    status: z.enum(['ready', 'needs_confirmation', 'missing_equipment']),
  })
  .strict()

const teamExecutionSchema = z
  .object({
    contract: z.literal('soda-team-execution/r1'),
    candidateId: z.string().min(1),
    reusePolicy: z.enum(['cross_scenario_reuse', 'simultaneous_lock']),
    scenario: z.object({ identity: z.string().min(1), tags: z.array(z.string()) }).strict(),
    memberIds: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    deploymentOrder: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]).optional(),
    bangbooId: z.string().min(1).nullable(),
    authorComparisonMembership: authorComparisonMembershipSchema.optional(),
    bangbooStar: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional(),
    wEngineBindingMode: z.enum(['scheme_parameters', 'account_fact_binding']).optional(),
    members: z.array(teamExecutionMemberSchema),
    physicalDiscIds: z.array(z.string().min(1)),
    confirmedWEngineCopyIds: z.array(z.string().min(1)),
    status: z.enum(['ready', 'needs_confirmation', 'missing_equipment']),
    blockers: z.array(z.string()),
    sideEffect: z.literal('read_only'),
  })
  .strict()
  .superRefine((execution, context) => {
    refineAuthorComparisonBangbooIdentity(execution, context)
    if (!execution.deploymentOrder) return
    const memberIds = execution.members.map((member) => member.agentId)
    const declaredMemberIds = execution.memberIds
    const order = execution.deploymentOrder
    if (
      memberIds.length !== 3 ||
      new Set(memberIds).size !== 3 ||
      new Set(declaredMemberIds).size !== 3 ||
      !declaredMemberIds.every((agentId) => memberIds.includes(agentId)) ||
      new Set(order).size !== 3 ||
      !order.every((agentId) => memberIds.includes(agentId) && declaredMemberIds.includes(agentId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deploymentOrder'],
        message: '站位顺序必须恰好包含执行快照中的三名不同代理人。',
      })
    }
  })

export const teamExecutionPortfolioSnapshotSchema = z
  .object({
    contract: z.literal('soda-team-execution/r1'),
    reusePolicy: z.literal('simultaneous_lock'),
    requestedTeamCount: z.union([z.literal(2), z.literal(3)]),
    wEngineBindingMode: z.enum(['scheme_parameters', 'account_fact_binding']).optional(),
    executions: z.array(teamExecutionSchema),
    uniqueConfirmedWEngineCopyIds: z.array(z.string().min(1)),
    uniquePhysicalDiscIds: z.array(z.string().min(1)),
    status: z.enum(['ready', 'needs_confirmation', 'missing_equipment']),
    blockers: z.array(z.string()),
    sideEffect: z.literal('read_only'),
  })
  .strict()

const portfolioBuildSourceSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    sourceVersion: z.string().nullable(),
    checkedAt: z.string().min(1),
    contentHash: z.string().min(1),
    licenseBoundary: z.string().min(1),
    verified: z.boolean(),
  })
  .strict()

const portfolioSetPlanSchema = z
  .object({
    pattern: z.enum(['4+2', '2+2+2']),
    primarySetIds: z.array(z.string().min(1)),
    secondarySetIds: z.array(z.string().min(1)),
    sourceText: z.string().optional(),
  })
  .strict()

const portfolioConstraintSchema = z
  .object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    gameVersion: z.enum(['3.0', '3.1']),
    status: z.enum(['candidate', 'missing']),
    setPlanReadiness: z.discriminatedUnion('status', [
      z
        .object({
          status: z.literal('executable'),
          pattern: z.enum(['4+2', '2+2+2']),
          primarySetIds: z.array(z.string().min(1)),
          secondarySetIds: z.array(z.string().min(1)),
        })
        .strict(),
      z
        .object({
          status: z.literal('non_executable'),
          reason: z.enum(['missing_secondary_set', 'unresolved_set_roles']),
          missingEvidence: z.string().min(1),
        })
        .strict(),
    ]),
    sources: z.array(portfolioBuildSourceSchema),
    setIds: z.array(z.string().min(1)),
    setPlans: z.array(portfolioSetPlanSchema).optional(),
    unresolvedSetDirections: z.array(z.string()).optional(),
    mainStats: z
      .object({
        4: z.array(statKeySchema).optional(),
        5: z.array(statKeySchema).optional(),
        6: z.array(statKeySchema).optional(),
      })
      .strict(),
    subStatWeights: z.record(statKeySchema, z.number()),
    wEngineDirections: z.array(z.string()),
    teamAndBangbooPreconditions: z.array(z.string()),
    progressionDirection: z.array(z.string()),
    targetPanel: z
      .object({
        level: z.literal(60),
        values: z.record(
          z.enum(['atk', 'hp', 'def', 'critRate', 'critDamage']),
          z.union([
            z.number(),
            z
              .object({
                min: z.number(),
                max: z.number().optional(),
                upperOpen: z.boolean().optional(),
              })
              .strict(),
          ]),
        ),
        conditions: z.array(z.string()),
        sourceIds: z.array(z.string().min(1)),
        label: z.literal('guide_reference_range'),
      })
      .strict()
      .optional(),
    gaps: z.array(z.string()),
    boundary: z.string(),
    contentHash: z.string().min(1),
  })
  .strict()

const teamPortfolioBuildIntentSchema = z
  .object({
    contract: z.literal('soda-build-intent/v1'),
    scope: z.literal('portfolio_joint'),
    resourcePolicy: z.literal('cross_team_exclusive'),
    agentIds: z.array(z.string().min(1)),
    recommendations: z.array(
      z
        .object({ agentId: z.string().min(1), constraint: portfolioConstraintSchema.nullable() })
        .strict(),
    ),
    teamCount: z.union([z.literal(2), z.literal(3)]),
    lockedCandidateIds: z.array(z.string().min(1)),
    equipmentParametersByCandidateId: z
      .record(z.string().min(1), teamEquipmentParameterSelectionSchema)
      .optional(),
    resolvedTeams: z
      .array(z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]))
      .optional(),
    agentPotentialById: z.record(z.string().min(1), z.number().int().min(0)).optional(),
    fingerprint: z.string().min(1),
  })
  .strict()

const teamPortfolioDiscChoicesSchema = z
  .object({
    contract: z.literal('soda-team-portfolio-disc-choices/r1'),
    loadouts: z.array(
      z
        .object({
          agentId: z.string().min(1),
          choices: z.array(
            z
              .object({
                discId: z.string().min(1),
                score: z.number().finite(),
                mainStatScore: z.number().finite(),
                subStatScore: z.number().finite(),
                effectiveLines: z.number().int().nonnegative(),
                effectiveRolls: z.number().int().nonnegative(),
                wastedUpgrades: z.number().int().nonnegative(),
                reasons: z.array(z.string()),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict()

const planningDraftSchema = z.object({
  scopedId: z.string().min(1),
  accountId: accountIdSchema,
  id: z.string().min(1),
  kind: z.enum(['agent', 'team']),
  name: z.string().min(1),
  state: z.enum(['draft', 'saved']),
  selection: z.object({
    agentIds: z.array(z.string()),
    bangbooId: z.string().nullable(),
    scenario: z.string(),
  }),
  manualOverrides: z.object({
    wEngineDirection: z.string(),
    discDirection: z.string(),
    progressionDirection: z.string(),
    notes: z.string(),
  }),
  knowledgeRefs: z.array(
    z.object({
      profileId: z.string(),
      status: z.enum(['formal', 'candidate', 'missing']),
      version: z.string(),
      source: z.string(),
    }),
  ),
  warehouseRefs: z.array(z.string()),
  solutionContext: planningSolutionContextSchema.optional(),
  savedRole: z.enum(['current_reference', 'history']).optional(),
  candidateWarehouse: candidateWarehouseSchema.optional(),
  teamExecutionSnapshot: teamExecutionSchema.optional(),
  teamPortfolioSnapshot: teamExecutionPortfolioSnapshotSchema.optional(),
  teamPortfolioBuildIntent: teamPortfolioBuildIntentSchema.optional(),
  teamPortfolioDiscChoices: teamPortfolioDiscChoicesSchema.optional(),
  teamEquipmentParameters: teamEquipmentParametersSchema.optional(),
  planningBenchmark32: savedPlanningBenchmark32Schema.optional(),
  teamAccountFactBinding: authorComparisonAccountFactBindingSchema.optional(),
  comparisonCapability: z.enum(['formal', 'direction']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().nonnegative(),
})

const accountBackupDataSchema = z.object({
  driveDiscs: z.array(driveDiscSchema.extend(accountScopeShape)),
  discEvaluations: z.array(discEvaluationSchema.extend(accountScopeShape)),
  scanBatches: z.array(scanImportBatchMetaSchema.extend(accountScopeShape)),
  scanItems: z.array(scanImportItemSchema.extend(accountScopeShape)),
  roster: rosterSnapshotSchema.nullable(),
  optimizationResults: z.array(optimizationResultSchema),
  preferences: z.array(preferenceSchema),
  planningDrafts: z.array(planningDraftSchema).default([]),
})

const accountBackupCountsSchema = z.object({
  driveDiscs: z.number().int().nonnegative(),
  discEvaluations: z.number().int().nonnegative(),
  scanBatches: z.number().int().nonnegative(),
  scanItems: z.number().int().nonnegative(),
  roster: z.number().int().min(0).max(1),
  optimizationResults: z.number().int().nonnegative(),
  preferences: z.number().int().nonnegative(),
  planningDrafts: z.number().int().nonnegative().default(0),
})

export const accountBackupSchema = z.object({
  format: z.literal(accountBackupFormat),
  formatVersion: z.literal(accountBackupFormatVersion),
  exportedAt: z.string().datetime(),
  databaseSchemaVersion: z.number().int().positive().max(databaseSchemaVersion),
  account: accountProfileSchema,
  dataPackRefs: z.object({
    gameDataVersion: z.string().min(1),
    buildKnowledgeVersion: z.string().min(1).nullable(),
    rotationId: z.string().min(1).nullable(),
  }),
  counts: accountBackupCountsSchema,
  data: accountBackupDataSchema,
})

export const vaultBackupSchema = z.object({
  format: z.literal(vaultBackupFormat),
  formatVersion: z.literal(vaultBackupFormatVersion),
  exportedAt: z.string().datetime(),
  databaseSchemaVersion: z.number().int().positive().max(databaseSchemaVersion),
  accounts: z.array(accountBackupSchema),
})

export type AccountBackup = z.infer<typeof accountBackupSchema>
export type VaultBackup = z.infer<typeof vaultBackupSchema>

export type AccountBackupPreflight = {
  success: boolean
  backup?: AccountBackup
  errors: string[]
  conflicts: string[]
  risks: string[]
  identity?: AccountBackupIdentity
}

export type AccountBackupIdentity = 'same_id' | 'same_name_different_id' | 'new_account'
