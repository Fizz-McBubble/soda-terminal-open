import { formalDamageUnsupportedContext } from './formalDamageUnsupportedContext'
import { z } from 'zod'
import {
  type CalculationCapability,
  type CalculationContext,
  validateCalculationContext,
} from './calculationContext'

const formalPackSchema = z.object({
  id: z.string().min(1),
  packageVersion: z.string().min(1),
  contentHash: z.string().min(1),
  gameVersion: z.string().min(1),
  status: z.enum(['formal', 'candidate', 'expired', 'rolled_back']),
})

export const damageCalculationContextSchema = z.object({
  contextId: z.string().min(1),
  calculationModelVersion: z.literal('damage-direct-v1'),
  gameVersion: z.string().min(1),
  gameBase: formalPackSchema,
  buildKnowledge: formalPackSchema.extend({
    profileId: z.string().min(1),
    profileHash: z.string().min(1),
  }),
  rotation: formalPackSchema.extend({
    scenarioId: z.string().min(1),
    scenarioHash: z.string().min(1),
  }),
  playerSnapshot: z.object({
    accountId: z.string().min(1),
    rosterHash: z.string().min(1),
    discWarehouseHash: z.string().min(1),
    capturedAt: z.string().datetime(),
  }),
  combatSnapshot: z
    .object({
      agentId: z.string().min(1),
      agentLevel: z.number().int().positive(),
      skillLevels: z.record(z.string(), z.number().int().nonnegative()),
      wEngineId: z.string().min(1),
      wEngineLevel: z.number().int().positive(),
      wEngineRefinement: z.number().int().positive(),
      bangbooId: z.string().min(1).nullable(),
      discIds: z.array(z.string().min(1)).length(6),
      finalStatsHash: z.string().min(1),
    })
    .nullable(),
  enemySnapshot: z
    .object({
      id: z.string().min(1),
      defense: z.number().positive(),
      resistance: z.number().min(-1).max(1),
      stunMultiplier: z.number().positive(),
    })
    .nullable(),
  cycleSnapshot: z
    .object({
      id: z.string().min(1),
      seconds: z.number().positive(),
      complete: z.boolean(),
      multiplier: z.number().positive().nullable(),
    })
    .nullable(),
  fieldContinuity: z
    .object({
      carriedForwardFieldIds: z.array(z.string().min(1)).default([]),
      affectedUnverifiedFieldIds: z.array(z.string().min(1)).default([]),
    })
    .optional(),
  directDamage: z.boolean(),
})

export type DamageCalculationContext = z.infer<typeof damageCalculationContextSchema>
export type DamageGateResult = {
  status: 'calculable' | 'estimated' | 'unsupported'
  missing: Array<{
    field: string
    scope: string
    reason: string
    requiredSourceKind: 'formal' | 'player'
  }>
  blockedPackageIds: string[]
}

export type CalculationCapabilityResult = {
  allowed: boolean
  blockers: CalculationGateBlocker[]
}

export type CalculationGateBlocker = {
  code:
    | 'invalid-context'
    | 'canonical-not-formal'
    | 'missing-field'
    | 'candidate-field'
    | 'conflict'
    | 'affected-unverified'
    | 'cross-version'
    | 'stale'
    | 'deprecated'
    | 'asset-snapshot'
    | 'enemy'
    | 'cycle'
  fieldId: string
  capability: CalculationCapability
  reason: string
}

export type UnifiedCalculationGateResult = {
  status: 'formal_damage_reproducible' | 'candidate_warehouse_comparable' | 'unsupported'
  context: CalculationContext | null
  capabilities: {
    candidateWarehouse: CalculationCapabilityResult
    formalSingleEvent: CalculationCapabilityResult
    formalEventSet: CalculationCapabilityResult
    formalLoadout: CalculationCapabilityResult
    estimatedRotation: CalculationCapabilityResult
    formalDamage: CalculationCapabilityResult
    formalDps: CalculationCapabilityResult
    formalScenarioScore: CalculationCapabilityResult
  }
  blockers: CalculationGateBlocker[]
}

const emptyCapabilities = () => ({
  candidateWarehouse: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalSingleEvent: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalEventSet: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalLoadout: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  estimatedRotation: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalDamage: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalDps: { allowed: false, blockers: [] as CalculationGateBlocker[] },
  formalScenarioScore: { allowed: false, blockers: [] as CalculationGateBlocker[] },
})

function capabilityBlockers(
  context: CalculationContext,
  capability: CalculationCapability,
): CalculationGateBlocker[] {
  const blockers: CalculationGateBlocker[] = []
  const formal = capability !== 'candidate_warehouse'
  const relevantEvidence = context.evidence.filter((item) => item.requiredFor.includes(capability))

  if (relevantEvidence.length === 0)
    blockers.push({
      code: 'missing-field',
      fieldId: `${capability}-evidence`,
      capability,
      reason: `缺少“${capability}”能力所需的字段证据声明。`,
    })

  for (const evidence of relevantEvidence) {
    const add = (code: CalculationGateBlocker['code'], reason: string) =>
      blockers.push({ code, fieldId: evidence.fieldId, capability, reason })
    if (evidence.stale) add('stale', `字段“${evidence.fieldId}”引用已过期，需要重新核验。`)
    if (evidence.conflict) add('conflict', `字段“${evidence.fieldId}”存在未裁决冲突。`)
    if (evidence.applicability === 'affected_unverified')
      add('affected-unverified', `字段“${evidence.fieldId}”受当前版本影响但尚未核验。`)
    if (evidence.applicability === 'deprecated')
      add('deprecated', `字段“${evidence.fieldId}”已弃用。`)
    if (evidence.status === 'missing' || evidence.applicability === 'missing')
      add('missing-field', `字段“${evidence.fieldId}”缺少可用证据。`)
    if (formal && evidence.status === 'candidate')
      add('candidate-field', `字段“${evidence.fieldId}”只有候选证据，不能生成正式伤害。`)
    if (
      evidence.sourceVersion &&
      evidence.sourceVersion !== context.gameVersion &&
      evidence.applicability !== 'continuous'
    )
      add(
        'cross-version',
        `字段“${evidence.fieldId}”来自 ${evidence.sourceVersion}，且没有连续适用证据。`,
      )
  }

  return blockers
}

/**
 * Pure capability gate shared by future damage, loadout and warehouse consumers.
 * It never reads or writes an account repository.
 */
export function evaluateCalculationGate(input: unknown): UnifiedCalculationGateResult {
  const parsed = validateCalculationContext(input)
  const capabilities = emptyCapabilities()
  if (!parsed.success) {
    const blocker: CalculationGateBlocker = {
      code: 'invalid-context',
      fieldId: 'context',
      capability: 'candidate_warehouse',
      reason: parsed.reason,
    }
    capabilities.candidateWarehouse.blockers = [blocker]
    return { status: 'unsupported', context: null, capabilities, blockers: [blocker] }
  }

  const context = parsed.context
  const warehouseBlockers = capabilityBlockers(context, 'candidate_warehouse')
  if (context.canonical.gameVersion !== context.gameVersion)
    warehouseBlockers.push({
      code: 'cross-version',
      fieldId: 'canonical',
      capability: 'candidate_warehouse',
      reason: `canonical ${context.canonical.gameVersion} 与计算版本 ${context.gameVersion} 不一致。`,
    })
  if (context.accountSnapshot.stale)
    warehouseBlockers.push({
      code: 'asset-snapshot',
      fieldId: 'account-snapshot',
      capability: 'candidate_warehouse',
      reason: '账户资产快照已变化，候选仓库方案需要重新计算。',
    })
  if (context.actors.some((actor) => actor.discs.length !== 6))
    warehouseBlockers.push({
      code: 'missing-field',
      fieldId: 'six-disc-loadout',
      capability: 'candidate_warehouse',
      reason: '候选仓库比较需要每名代理人的完整六盘方案。',
    })
  capabilities.candidateWarehouse = {
    allowed: warehouseBlockers.length === 0,
    blockers: warehouseBlockers,
  }

  const formalDamageBlockers = capabilityBlockers(context, 'formal_damage')
  if (context.canonical.gameVersion !== context.gameVersion)
    formalDamageBlockers.push({
      code: 'cross-version',
      fieldId: 'canonical',
      capability: 'formal_damage',
      reason: `canonical ${context.canonical.gameVersion} 与计算版本 ${context.gameVersion} 不一致。`,
    })
  if (context.canonical.status !== 'formal')
    formalDamageBlockers.push({
      code: 'canonical-not-formal',
      fieldId: 'canonical',
      capability: 'formal_damage',
      reason: '当前 canonical 数据不是可用于正式伤害的 formal 基线。',
    })
  if (context.accountSnapshot.stale)
    formalDamageBlockers.push({
      code: 'asset-snapshot',
      fieldId: 'account-snapshot',
      capability: 'formal_damage',
      reason: '账户资产快照已过期。',
    })
  if (
    !context.scenario.enemy ||
    context.scenario.enemy.defense === null ||
    context.scenario.enemy.resistance === null ||
    context.scenario.enemy.stunMultiplier === null
  )
    formalDamageBlockers.push({
      code: 'enemy',
      fieldId: 'enemy',
      capability: 'formal_damage',
      reason: '缺少敌人 DEF、RES 或失衡倍率。',
    })
  if (
    !context.cycle?.complete ||
    context.cycle.durationSeconds === null ||
    context.cycle.actionSequenceHash === null ||
    context.cycle.hitCount === null ||
    context.cycle.buffWindowHash === null
  )
    formalDamageBlockers.push({
      code: 'cycle',
      fieldId: 'cycle',
      capability: 'formal_damage',
      reason: '缺少完整动作序列、命中、时长或 Buff 窗口。',
    })
  capabilities.formalDamage = {
    allowed: formalDamageBlockers.length === 0,
    blockers: formalDamageBlockers,
  }

  // Legacy formal_damage keeps its complete-cycle contract. A single event uses
  // the same formal evidence and enemy snapshot, but deliberately excludes cycle time.
  const singleEventBlockers = formalDamageBlockers.filter((blocker) => blocker.code !== 'cycle')
  capabilities.formalSingleEvent = {
    allowed: singleEventBlockers.length === 0,
    blockers: singleEventBlockers.map((blocker) => ({
      ...blocker,
      capability: 'formal_single_event',
    })),
  }
  const formalEventBaseBlockers: CalculationGateBlocker[] = []
  if (context.canonical.gameVersion !== context.gameVersion)
    formalEventBaseBlockers.push({
      code: 'cross-version',
      fieldId: 'canonical',
      capability: 'formal_event_set_ready',
      reason: `canonical ${context.canonical.gameVersion} 与计算版本 ${context.gameVersion} 不一致。`,
    })
  if (context.canonical.status !== 'formal')
    formalEventBaseBlockers.push({
      code: 'canonical-not-formal',
      fieldId: 'canonical',
      capability: 'formal_event_set_ready',
      reason: '当前 canonical 数据不是可用于正式事件的 formal 基线。',
    })
  if (context.accountSnapshot.stale)
    formalEventBaseBlockers.push({
      code: 'asset-snapshot',
      fieldId: 'account-snapshot',
      capability: 'formal_event_set_ready',
      reason: '账户资产快照已过期。',
    })
  if (
    !context.scenario.enemy ||
    context.scenario.enemy.defense === null ||
    context.scenario.enemy.resistance === null ||
    context.scenario.enemy.stunMultiplier === null
  )
    formalEventBaseBlockers.push({
      code: 'enemy',
      fieldId: 'enemy',
      capability: 'formal_event_set_ready',
      reason: '缺少敌人 DEF、RES 或失衡倍率。',
    })
  const eventDamageOnly = capabilityBlockers(context, 'formal_event_damage_ready')
  const eventSetOnly = capabilityBlockers(context, 'formal_event_set_ready')
  capabilities.formalEventSet = {
    allowed:
      formalEventBaseBlockers.length === 0 &&
      eventDamageOnly.length === 0 &&
      eventSetOnly.length === 0,
    blockers: [...formalEventBaseBlockers, ...eventDamageOnly, ...eventSetOnly],
  }
  const loadoutOnly = capabilityBlockers(context, 'formal_loadout_ready')
  capabilities.formalLoadout = {
    allowed:
      formalEventBaseBlockers.length === 0 &&
      eventDamageOnly.length === 0 &&
      loadoutOnly.length === 0 &&
      context.actors.every((actor) => actor.discs.length === 6),
    blockers: [
      ...formalEventBaseBlockers.map((blocker) => ({
        ...blocker,
        capability: 'formal_loadout_ready' as const,
      })),
      ...eventDamageOnly.map((blocker) => ({
        ...blocker,
        capability: 'formal_loadout_ready' as const,
      })),
      ...loadoutOnly,
      ...(context.actors.some((actor) => actor.discs.length !== 6)
        ? [
            {
              code: 'missing-field' as const,
              fieldId: 'six-disc-loadout',
              capability: 'formal_loadout_ready' as const,
              reason: '正式配装比较需要每名代理人的完整六盘方案。',
            },
          ]
        : []),
    ],
  }
  capabilities.estimatedRotation = {
    allowed: formalDamageBlockers.length === 0,
    blockers: formalDamageBlockers.map((blocker) => ({
      ...blocker,
      capability: 'estimated_rotation',
    })),
  }

  const dpsOnly = capabilityBlockers(context, 'formal_dps')
  capabilities.formalDps = {
    allowed: formalDamageBlockers.length === 0 && dpsOnly.length === 0,
    blockers: [...formalDamageBlockers, ...dpsOnly],
  }
  const scenarioOnly = capabilityBlockers(context, 'formal_scenario_score')
  capabilities.formalScenarioScore = {
    allowed: formalDamageBlockers.length === 0 && scenarioOnly.length === 0,
    blockers: [...formalDamageBlockers, ...scenarioOnly],
  }

  const relevant =
    context.objective === 'candidate_warehouse_score'
      ? capabilities.candidateWarehouse
      : context.objective === 'formal_damage'
        ? capabilities.formalDamage
        : context.objective === 'formal_dps'
          ? capabilities.formalDps
          : capabilities.formalScenarioScore
  const status =
    relevant.allowed && context.objective === 'candidate_warehouse_score'
      ? 'candidate_warehouse_comparable'
      : relevant.allowed
        ? 'formal_damage_reproducible'
        : 'unsupported'
  return { status, context, capabilities, blockers: relevant.blockers }
}

export function evaluateDamageCalculationGate(input: unknown): DamageGateResult {
  const parsed = damageCalculationContextSchema.safeParse(input)
  if (!parsed.success)
    return {
      status: 'unsupported',
      blockedPackageIds: [],
      missing: [
        {
          field: 'context',
          scope: '计算上下文',
          reason: '计算输入不完整或格式无效。',
          requiredSourceKind: 'formal',
        },
      ],
    }
  const value = parsed.data
  const missing: DamageGateResult['missing'] = []
  const packs = [value.gameBase, value.buildKnowledge, value.rotation]
  const blockedPackageIds = packs
    .filter((pack) => pack.status !== 'formal' || pack.gameVersion !== value.gameVersion)
    .map((pack) => pack.id)
  if (blockedPackageIds.length)
    missing.push({
      field: 'data-pack',
      scope: '版本化数据',
      reason: '游戏、构筑和场景数据必须是同版本 formal；候选或过期包不可用于精确伤害。',
      requiredSourceKind: 'formal',
    })
  if (!value.directDamage)
    missing.push({
      field: 'damage-model',
      scope: '伤害模型',
      reason: '当前角色不是已支持的直接伤害闭环。',
      requiredSourceKind: 'formal',
    })
  if (!value.combatSnapshot)
    missing.push({
      field: 'player-combat-input',
      scope: '玩家盘面与最终属性',
      reason: '缺少角色、音擎、邦布、六件驱动盘或最终属性快照。',
      requiredSourceKind: 'player',
    })
  if (!value.enemySnapshot)
    missing.push({
      field: 'enemy',
      scope: '敌人与场景',
      reason: '缺少敌人 DEF、RES 或失衡参数。',
      requiredSourceKind: 'formal',
    })
  if (!value.cycleSnapshot?.complete || !value.cycleSnapshot.multiplier)
    missing.push({
      field: 'cycle',
      scope: '循环与技能倍率',
      reason: '缺少完整固定循环、技能倍率或动作时长。',
      requiredSourceKind: 'formal',
    })
  if (value.fieldContinuity?.affectedUnverifiedFieldIds.length)
    missing.push({
      field: 'affected-version-field',
      scope: '版本增量',
      reason: `受本次版本影响的关键字段尚未完成核验：${value.fieldContinuity.affectedUnverifiedFieldIds.join('、')}。未受影响的历史字段可继续沿用原始版本，但不能补足该缺口。`,
      requiredSourceKind: 'formal',
    })
  return { status: missing.length ? 'unsupported' : 'calculable', missing, blockedPackageIds }
}

export function formalDamageUnsupportedReason() {
  return evaluateDamageCalculationGate(formalDamageUnsupportedContext)
}
