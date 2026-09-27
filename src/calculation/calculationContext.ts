import { z } from 'zod'
import type { GameData31CanonicalField } from '../gameDataPacks/gameData31Delta'
import { stableContentHash } from '../gameDataPacks/types'

export const calculationCapabilities = [
  'candidate_warehouse',
  'formal_event_damage_ready',
  'formal_event_set_ready',
  'formal_loadout_ready',
  'formal_single_event',
  'estimated_rotation',
  'formal_damage',
  'formal_dps',
  'formal_scenario_score',
] as const
export type CalculationCapability = (typeof calculationCapabilities)[number]

/** The six Formal readiness layers. Candidate warehouse comparison is intentionally excluded. */
export const formalReadinessCapabilities = [
  'formal_stat_ready',
  'formal_event_damage_ready',
  'formal_loadout_ready',
  'formal_event_set_ready',
  'estimated_rotation_ready',
  'simulation_ready',
] as const
export type FormalReadinessCapability = (typeof formalReadinessCapabilities)[number]

/** Legacy objectives remain stable while consumers migrate to the six-layer readiness model. */
export const legacyObjectiveCapabilityMap = {
  candidate_warehouse_score: 'candidate_warehouse',
  formal_damage: 'formal_event_damage_ready',
  formal_dps: 'estimated_rotation_ready',
  formal_scenario_score: 'simulation_ready',
} as const

export const calculationEvidenceSchema = z
  .object({
    fieldId: z.string().min(1),
    status: z.enum(['formal', 'candidate', 'missing']),
    applicability: z.enum([
      'verified_current',
      'continuous',
      'affected_unverified',
      'missing',
      'deprecated',
    ]),
    sourceRefs: z.array(z.string().min(1)),
    sourceVersion: z.string().min(1).nullable(),
    requiredFor: z.array(z.enum(calculationCapabilities)).min(1),
    conflict: z.boolean().default(false),
    stale: z.boolean().default(false),
    reason: z.string().min(1),
  })
  .superRefine((evidence, issue) => {
    if (evidence.status !== 'missing' && evidence.sourceRefs.length === 0)
      issue.addIssue({
        code: 'custom',
        path: ['sourceRefs'],
        message: '可用字段必须保留至少一个来源引用。',
      })
  })
export type CalculationEvidence = z.infer<typeof calculationEvidenceSchema>

const discSchema = z.object({
  id: z.string().min(1),
  slot: z.number().int().min(1).max(6),
  setId: z.string().min(1),
  level: z.number().int().min(0),
  statsHash: z.string().min(1),
})

const actorSchema = z
  .object({
    agentId: z.string().min(1),
    level: z.number().int().positive().nullable(),
    mindscape: z.number().int().min(0).nullable(),
    potential: z.number().int().min(0).max(6).nullable(),
    skillLevels: z.record(z.string(), z.number().int().nonnegative()).nullable(),
    wEngine: z
      .object({
        id: z.string().min(1),
        level: z.number().int().positive().nullable(),
        refinement: z.number().int().positive().nullable(),
      })
      .nullable(),
    discs: z.array(discSchema).max(6),
    finalStatsHash: z.string().min(1).nullable(),
  })
  .superRefine((actor, issue) => {
    const ids = actor.discs.map((disc) => disc.id)
    const slots = actor.discs.map((disc) => disc.slot)
    if (new Set(ids).size !== ids.length)
      issue.addIssue({
        code: 'custom',
        path: ['discs'],
        message: '同一角色不能重复使用同一驱动盘。',
      })
    if (new Set(slots).size !== slots.length)
      issue.addIssue({ code: 'custom', path: ['discs'], message: '同一角色不能重复使用同一盘位。' })
  })

export const calculationContextCoreSchema = z
  .object({
    schemaVersion: z.literal('calculation-context-v2'),
    contextId: z.string().min(1),
    gameVersion: z.string().min(1),
    canonical: z.object({
      packageId: z.string().min(1),
      packageVersion: z.string().min(1),
      gameVersion: z.string().min(1),
      contentHash: z.string().min(1),
      status: z.enum(['formal', 'candidate']),
      rollbackPackageId: z.string().min(1).nullable(),
    }),
    accountSnapshot: z.object({
      accountId: z.string().min(1),
      rosterHash: z.string().min(1),
      warehouseHash: z.string().min(1),
      planningHash: z.string().min(1),
      capturedAt: z.string().datetime(),
      stale: z.boolean().default(false),
    }),
    scope: z
      .object({
        kind: z.enum(['agent', 'team']),
        agentIds: z.array(z.string().min(1)).min(1).max(3),
      })
      .superRefine((scope, issue) => {
        if (new Set(scope.agentIds).size !== scope.agentIds.length)
          issue.addIssue({
            code: 'custom',
            path: ['agentIds'],
            message: '计算范围不能包含重复代理人。',
          })
        if (scope.kind === 'agent' && scope.agentIds.length !== 1)
          issue.addIssue({
            code: 'custom',
            path: ['agentIds'],
            message: '单角色范围必须且只能包含一名代理人。',
          })
      }),
    actors: z.array(actorSchema).min(1).max(3),
    bangboo: z
      .object({
        id: z.string().min(1),
        level: z.number().int().positive().nullable(),
        coreLevel: z.number().int().nonnegative().nullable(),
      })
      .nullable(),
    scenario: z.object({
      playModeId: z.string().min(1).nullable(),
      scenarioId: z.string().min(1).nullable(),
      scenarioHash: z.string().min(1).nullable(),
      enemy: z
        .object({
          id: z.string().min(1),
          level: z.number().int().positive().nullable(),
          defense: z.number().nonnegative().nullable(),
          resistance: z.number().min(-1).max(1).nullable(),
          stunMultiplier: z.number().positive().nullable(),
          vulnerability: z.number().min(-1).nullable(),
        })
        .nullable(),
    }),
    cycle: z
      .object({
        id: z.string().min(1),
        durationSeconds: z.number().positive().nullable(),
        actionSequenceHash: z.string().min(1).nullable(),
        hitCount: z.number().int().positive().nullable(),
        buffWindowHash: z.string().min(1).nullable(),
        complete: z.boolean(),
      })
      .nullable(),
    objective: z.enum([
      'candidate_warehouse_score',
      'formal_damage',
      'formal_dps',
      'formal_scenario_score',
    ]),
    constraintsHash: z.string().min(1),
    evidence: z.array(calculationEvidenceSchema),
  })
  .superRefine((context, issue) => {
    const actorIds = context.actors.map((actor) => actor.agentId)
    if (
      actorIds.length !== context.scope.agentIds.length ||
      new Set(actorIds).size !== actorIds.length ||
      actorIds.some((id) => !context.scope.agentIds.includes(id)) ||
      context.scope.agentIds.some((id) => !actorIds.includes(id))
    )
      issue.addIssue({
        code: 'custom',
        path: ['actors'],
        message: '角色快照必须与计算范围完全一致。',
      })
    if (context.scope.kind === 'team') {
      const discIds = context.actors.flatMap((actor) => actor.discs.map((disc) => disc.id))
      if (new Set(discIds).size !== discIds.length)
        issue.addIssue({
          code: 'custom',
          path: ['actors'],
          message: '队伍范围内同一实体驱动盘不能分配给多名代理人。',
        })
    }
    const evidenceIds = context.evidence.map((evidence) => evidence.fieldId)
    if (new Set(evidenceIds).size !== evidenceIds.length)
      issue.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: '同一计算上下文不能重复声明同一字段证据。',
      })
  })

export const calculationContextSchema = calculationContextCoreSchema.extend({
  fingerprint: z.string().min(1),
  comparabilityKey: z.string().min(1),
  loadoutComparisonKey: z.string().min(1),
})
export type CalculationContext = z.infer<typeof calculationContextSchema>
export type CalculationContextInput = z.input<typeof calculationContextCoreSchema>

const generalAdapterEvidenceRefs = z.array(z.string().min(1)).min(1)
const generalAdapterModifier = z.object({
  value: z.number(),
  conditionRefs: z.array(z.string().min(1)),
  sourceEvidenceRefs: generalAdapterEvidenceRefs,
})

/**
 * R16's fail-closed boundary. It wraps, rather than replaces, CalculationContext:
 * source facts, loadout facts and Soda benchmark policy remain separate objects.
 */
export const generalAdapterCalculationContextSchema = z
  .object({
    contextId: z.string().min(1),
    sourceVersion: z.string().min(1),
    targetVersion: z.string().min(1),
    calculationContext: calculationContextSchema,
    actor: z.object({
      stableId: z.string().min(1),
      level: z.number().int().positive(),
      promotion: z.number().int().nonnegative(),
      mindscape: z.number().int().min(0).max(6),
      skills: z.record(z.string().min(1), z.number().int().positive()),
      finalStats: z.object({
        attack: z.number().positive(),
        critRate: z.number().min(0).max(1),
        critDamage: z.number().nonnegative(),
        damageBonus: z.number(),
        defenseReduction: z.number(),
        penetrationRatio: z.number(),
        penetrationFlat: z.number().nonnegative(),
        resistanceReduction: z.number(),
      }),
    }),
    equipment: z.object({
      wEngineId: z.string().min(1).nullable(),
      driveDiscIds: z.array(z.string().min(1)),
    }),
    buffs: z.array(
      z.object({
        buffId: z.string().min(1),
        modifiers: z.record(z.string().min(1), generalAdapterModifier),
      }),
    ),
    enemy: z.object({
      benchmarkId: z.string().min(1),
      level: z.number().int().positive(),
      defense: z.number().nonnegative(),
      resistance: z.number().min(-1).max(1),
      stunState: z.number().positive(),
      vulnerability: z.number().min(-1),
    }),
    policy: z.object({
      fixedEventSet: z.array(z.object({ eventId: z.string().min(1), weight: z.literal(1) })).min(1),
      displayPrecision: z.literal(2),
      comparisonScope: z.literal('strict_same_CalculationContext_except_loadout'),
      fallback: z.literal('none'),
      evidenceRefs: generalAdapterEvidenceRefs,
    }),
    evidenceRefs: generalAdapterEvidenceRefs,
  })
  .superRefine((value, issue) => {
    if (value.contextId !== value.calculationContext.contextId)
      issue.addIssue({ code: 'custom', path: ['contextId'], message: 'adapter contextId mismatch' })
    if (value.targetVersion !== value.calculationContext.gameVersion)
      issue.addIssue({
        code: 'custom',
        path: ['targetVersion'],
        message: 'adapter target version mismatch',
      })
    const contextActor = value.calculationContext.actors[0]
    if (
      value.calculationContext.scope.kind !== 'agent' ||
      value.calculationContext.scope.agentIds.length !== 1 ||
      contextActor?.agentId !== value.actor.stableId ||
      contextActor.level !== value.actor.level ||
      contextActor.mindscape !== value.actor.mindscape
    )
      issue.addIssue({
        code: 'custom',
        path: ['actor'],
        message: 'adapter actor identity mismatch',
      })
  })

export type GeneralAdapterCalculationContext = z.infer<
  typeof generalAdapterCalculationContextSchema
>

export function generalAdapterComparisonKey(context: GeneralAdapterCalculationContext) {
  return stableContentHash({
    loadoutComparisonKey: context.calculationContext.loadoutComparisonKey,
    sourceVersion: context.sourceVersion,
    targetVersion: context.targetVersion,
    actor: {
      stableId: context.actor.stableId,
      level: context.actor.level,
      promotion: context.actor.promotion,
      mindscape: context.actor.mindscape,
      skills: context.actor.skills,
    },
    buffs: context.buffs,
    enemy: context.enemy,
    policy: context.policy,
    evidenceRefs: context.evidenceRefs,
  })
}

function comparisonIdentity(context: z.output<typeof calculationContextCoreSchema>) {
  return {
    schemaVersion: context.schemaVersion,
    gameVersion: context.gameVersion,
    canonical: context.canonical,
    accountId: context.accountSnapshot.accountId,
    rosterHash: context.accountSnapshot.rosterHash,
    warehouseHash: context.accountSnapshot.warehouseHash,
    planningHash: context.accountSnapshot.planningHash,
    scope: context.scope,
    actors: context.actors,
    bangboo: context.bangboo,
    scenario: context.scenario,
    cycle: context.cycle,
    objective: context.objective,
    constraintsHash: context.constraintsHash,
  }
}

function loadoutComparisonIdentity(context: z.output<typeof calculationContextCoreSchema>) {
  return {
    schemaVersion: context.schemaVersion,
    gameVersion: context.gameVersion,
    canonical: context.canonical,
    accountSnapshot: {
      accountId: context.accountSnapshot.accountId,
      rosterHash: context.accountSnapshot.rosterHash,
      warehouseHash: context.accountSnapshot.warehouseHash,
      planningHash: context.accountSnapshot.planningHash,
    },
    scope: context.scope,
    actors: context.actors.map((actor) => ({
      agentId: actor.agentId,
      level: actor.level,
      mindscape: actor.mindscape,
      potential: actor.potential,
      skillLevels: actor.skillLevels,
    })),
    bangboo: context.bangboo,
    scenario: context.scenario,
    objective: context.objective,
    constraintsHash: context.constraintsHash,
  }
}

export function createCalculationContext(input: CalculationContextInput): CalculationContext {
  const core = calculationContextCoreSchema.parse(input)
  const fingerprint = stableContentHash(core)
  return calculationContextSchema.parse({
    ...core,
    fingerprint,
    comparabilityKey: stableContentHash(comparisonIdentity(core)),
    loadoutComparisonKey: stableContentHash(loadoutComparisonIdentity(core)),
  })
}

export function validateCalculationContext(
  input: unknown,
): { success: true; context: CalculationContext } | { success: false; reason: string } {
  const parsed = calculationContextSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: '统一计算上下文格式无效。' }
  const core = calculationContextCoreSchema.parse(parsed.data)
  if (parsed.data.fingerprint !== stableContentHash(core))
    return { success: false, reason: '计算上下文指纹校验失败。' }
  if (parsed.data.comparabilityKey !== stableContentHash(comparisonIdentity(core)))
    return { success: false, reason: '计算比较键校验失败。' }
  if (parsed.data.loadoutComparisonKey !== stableContentHash(loadoutComparisonIdentity(core)))
    return { success: false, reason: '配装比较键校验失败。' }
  return { success: true, context: parsed.data }
}

export type ContextComparison = {
  comparable: boolean
  mismatchKinds: Array<
    | 'version'
    | 'canonical'
    | 'account'
    | 'scope'
    | 'members'
    | 'scenario'
    | 'cycle'
    | 'objective'
    | 'asset-snapshot'
    | 'constraints'
  >
}

export function compareCalculationContexts(
  leftInput: unknown,
  rightInput: unknown,
): ContextComparison {
  const leftResult = validateCalculationContext(leftInput)
  const rightResult = validateCalculationContext(rightInput)
  if (!leftResult.success) throw new Error(leftResult.reason)
  if (!rightResult.success) throw new Error(rightResult.reason)
  const left = leftResult.context
  const right = rightResult.context
  const mismatchKinds: ContextComparison['mismatchKinds'] = []
  if (left.gameVersion !== right.gameVersion) mismatchKinds.push('version')
  if (
    left.canonical.packageId !== right.canonical.packageId ||
    left.canonical.contentHash !== right.canonical.contentHash
  )
    mismatchKinds.push('canonical')
  if (left.accountSnapshot.accountId !== right.accountSnapshot.accountId)
    mismatchKinds.push('account')
  if (left.scope.kind !== right.scope.kind) mismatchKinds.push('scope')
  if (stableContentHash(left.scope.agentIds) !== stableContentHash(right.scope.agentIds))
    mismatchKinds.push('members')
  if (stableContentHash(left.scenario) !== stableContentHash(right.scenario))
    mismatchKinds.push('scenario')
  if (stableContentHash(left.cycle) !== stableContentHash(right.cycle)) mismatchKinds.push('cycle')
  if (left.objective !== right.objective) mismatchKinds.push('objective')
  if (
    left.accountSnapshot.rosterHash !== right.accountSnapshot.rosterHash ||
    left.accountSnapshot.warehouseHash !== right.accountSnapshot.warehouseHash ||
    left.accountSnapshot.planningHash !== right.accountSnapshot.planningHash ||
    stableContentHash(left.actors) !== stableContentHash(right.actors)
  )
    mismatchKinds.push('asset-snapshot')
  if (left.constraintsHash !== right.constraintsHash) mismatchKinds.push('constraints')
  return { comparable: mismatchKinds.length === 0, mismatchKinds }
}

export function evidenceFromCurrentCanonicalField(
  field: GameData31CanonicalField,
  requiredFor: CalculationCapability[],
): CalculationEvidence {
  return calculationEvidenceSchema.parse({
    fieldId: field.id,
    status: field.status,
    applicability: field.currentApplicability,
    sourceRefs: field.sourceRefs,
    sourceVersion: field.lastChangeVersion ?? field.originalSourceVersion,
    requiredFor,
    conflict: field.change === 'conflict',
    stale: false,
    reason: field.reason,
  })
}
