import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'

/**
 * Typed input boundary for the future Planning DPS formula family.  This is a
 * contract only: it never selects actions, evaluates a formula, or makes a
 * player-facing claim by itself.
 */
export const planningDpsCapabilities = ['planning_damage', 'planning_dps'] as const
export type PlanningDpsCapability = (typeof planningDpsCapabilities)[number]

const hashSchema = z.string().min(1)
const identifierSchema = z.string().min(1)

export const planningBaselineSchema = z
  .object({
    schemaVersion: z.literal('planning-baseline-v1'),
    baselineId: identifierSchema,
    gameVersion: identifierSchema,
    phaseId: identifierSchema,
    enemy: z
      .object({
        id: identifierSchema,
        defense: z.number().nonnegative(),
        resistance: z.number().min(-1).max(1),
        stunMultiplier: z.number().positive(),
        vulnerability: z.number().min(-1),
      })
      .strict(),
    rounding: z.literal('nearest-0.01'),
    formulaHash: hashSchema,
    sourcePackHash: hashSchema,
    declaredDurationSeconds: z.number().positive(),
    bangbooFixedEventObservation: z
      .object({
        activeUseCount: z.literal(1),
        chainUseCount: z.literal(1),
        durationSeconds: z.literal(30),
        authority: z.literal('declared_candidate_fixed_event_comparison'),
        sourceRefs: z.array(identifierSchema).min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
export type PlanningBaseline = z.infer<typeof planningBaselineSchema>

/** Account data records the identities actually available to a calculation. */
export const planningAccountSnapshotSchema = z
  .object({
    accountId: identifierSchema,
    rosterHash: hashSchema,
    warehouseHash: hashSchema,
    planningHash: hashSchema,
    ownedAgentIds: z.array(identifierSchema).min(1),
    ownedBangbooIds: z.array(identifierSchema),
    capturedAt: z.string().datetime(),
    stale: z.boolean(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (new Set(snapshot.ownedAgentIds).size !== snapshot.ownedAgentIds.length)
      context.addIssue({
        code: 'custom',
        path: ['ownedAgentIds'],
        message: '账户代理人身份不能重复。',
      })
    if (new Set(snapshot.ownedBangbooIds).size !== snapshot.ownedBangbooIds.length)
      context.addIssue({
        code: 'custom',
        path: ['ownedBangbooIds'],
        message: '账户邦布身份不能重复。',
      })
  })
export type PlanningAccountSnapshot = z.infer<typeof planningAccountSnapshotSchema>

/** This is the calculation subject, not a recommendation, template, or guide. */
export const planningCalculationTargetSchema = z
  .object({
    targetId: identifierSchema,
    scope: z.enum(['agent', 'team']),
    agentIds: z.array(identifierSchema).min(1).max(3),
    bangbooId: identifierSchema.nullable(),
  })
  .strict()
  .superRefine((target, context) => {
    if (new Set(target.agentIds).size !== target.agentIds.length)
      context.addIssue({ code: 'custom', path: ['agentIds'], message: '计算目标不能重复代理人。' })
    if (target.scope === 'agent' && target.agentIds.length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['agentIds'],
        message: '单代理人规划目标必须且只能包含一名代理人。',
      })
  })
export type PlanningCalculationTarget = z.infer<typeof planningCalculationTargetSchema>

export const calculationSupportKinds = [
  'personalFormula',
  'incomingModifier',
  'outgoingTeamEffect',
  'interaction',
  'pairOrTrio',
  'bangboo',
] as const
export type CalculationSupportKind = (typeof calculationSupportKinds)[number]

const completenessFieldSchema = z
  .object({
    fieldId: identifierSchema,
    status: z.enum(['ready', 'missing', 'stale', 'conflict']),
    reason: z.string().min(1),
  })
  .strict()

export const calculationCompletenessSchema = z
  .object({
    state: z.enum(['complete', 'partial', 'missing']),
    fields: z.array(completenessFieldSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.fields.map((field) => field.fieldId)).size !== value.fields.length)
      context.addIssue({ code: 'custom', path: ['fields'], message: '完整性字段不能重复。' })
    const unresolved = value.fields.some((field) => field.status !== 'ready')
    const missing = value.fields.some((field) => field.status === 'missing')
    if (value.state === 'complete' && unresolved)
      context.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'complete 不能包含缺失、过期或冲突字段。',
      })
    if (value.state === 'partial' && !unresolved)
      context.addIssue({ code: 'custom', path: ['state'], message: 'partial 必须说明未闭合字段。' })
    if (value.state === 'missing' && !missing)
      context.addIssue({ code: 'custom', path: ['state'], message: 'missing 必须包含缺失字段。' })
  })
export type CalculationCompleteness = z.infer<typeof calculationCompletenessSchema>

export const calculationSupportSchema = z
  .object({
    supportId: identifierSchema,
    kind: z.enum(calculationSupportKinds),
    applicability: z.enum(['required', 'not_applicable']),
    capabilities: z.array(z.enum(planningDpsCapabilities)).min(1),
    providerId: identifierSchema.nullable(),
    targetIds: z.array(identifierSchema).min(1).max(3),
    build: calculationCompletenessSchema,
    calculation: calculationCompletenessSchema,
    coverage: z
      .object({
        activeSeconds: z.number().nonnegative(),
        eligibleEventCount: z.number().int().nonnegative(),
        coveredEventCount: z.number().int().nonnegative(),
      })
      .strict(),
    sourceHash: hashSchema,
  })
  .strict()
  .superRefine((support, context) => {
    if (new Set(support.capabilities).size !== support.capabilities.length)
      context.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: 'support capability 不能重复。',
      })
    if (new Set(support.targetIds).size !== support.targetIds.length)
      context.addIssue({
        code: 'custom',
        path: ['targetIds'],
        message: 'support target 不能重复。',
      })
    if (support.coverage.coveredEventCount > support.coverage.eligibleEventCount)
      context.addIssue({
        code: 'custom',
        path: ['coverage', 'coveredEventCount'],
        message: '覆盖事件数不能超过可覆盖事件数。',
      })
    if (support.kind === 'bangboo' && support.providerId === null)
      context.addIssue({
        code: 'custom',
        path: ['providerId'],
        message: '邦布 support 必须具名来源。',
      })
  })
export type CalculationSupport = z.infer<typeof calculationSupportSchema>

export const planningCapabilityStateSchema = z
  .object({
    capability: z.enum(planningDpsCapabilities),
    state: z.enum(['ready', 'partial', 'unavailable']),
    supportIds: z.array(identifierSchema),
    blockers: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state === 'ready' && value.blockers.length)
      context.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: 'ready capability 不能保留 blocker。',
      })
    if (value.state !== 'ready' && !value.blockers.length)
      context.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: '未就绪 capability 必须说明 blocker。',
      })
  })
export type PlanningCapabilityState = z.infer<typeof planningCapabilityStateSchema>

export const planningCapabilityMatrixSchema = z
  .array(planningCapabilityStateSchema)
  .length(planningDpsCapabilities.length)
  .superRefine((matrix, context) => {
    const kinds = matrix.map((item) => item.capability)
    if (new Set(kinds).size !== kinds.length)
      context.addIssue({ code: 'custom', message: 'capability matrix 不能重复能力行。' })
    for (const capability of planningDpsCapabilities)
      if (!kinds.includes(capability))
        context.addIssue({ code: 'custom', message: `capability matrix 缺少 ${capability}。` })
  })
export type PlanningCapabilityMatrix = z.infer<typeof planningCapabilityMatrixSchema>

export const planningDpsInputSchema = z
  .object({
    schemaVersion: z.literal('planning-dps-input-v1'),
    equipmentBindingMode: z.enum(['account_inventory', 'scheme_parameters']).optional(),
    baseline: planningBaselineSchema,
    accountSnapshot: planningAccountSnapshotSchema,
    calculationTarget: planningCalculationTargetSchema,
    supports: z.array(calculationSupportSchema).min(1),
    supportHash: hashSchema,
    solverHash: hashSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.supports.map((support) => support.supportId)).size !== input.supports.length)
      context.addIssue({
        code: 'custom',
        path: ['supports'],
        message: 'CalculationSupport 不能重复。',
      })
    if (input.supportHash !== stableContentHash(input.supports))
      context.addIssue({
        code: 'custom',
        path: ['supportHash'],
        message: 'supportHash 与 CalculationSupport 不一致。',
      })
    input.calculationTarget.agentIds.forEach((agentId, index) => {
      if (!input.accountSnapshot.ownedAgentIds.includes(agentId))
        context.addIssue({
          code: 'custom',
          path: ['calculationTarget', 'agentIds', index],
          message: '计算目标代理人必须是账户快照中已拥有的身份。',
        })
    })
    if (
      input.equipmentBindingMode !== 'scheme_parameters' &&
      input.calculationTarget.bangbooId !== null &&
      !input.accountSnapshot.ownedBangbooIds.includes(input.calculationTarget.bangbooId)
    )
      context.addIssue({
        code: 'custom',
        path: ['calculationTarget', 'bangbooId'],
        message: '计算目标邦布必须是账户快照中已拥有的身份。',
      })
    input.supports.forEach((support, index) => {
      if (support.coverage.activeSeconds > input.baseline.declaredDurationSeconds)
        context.addIssue({
          code: 'custom',
          path: ['supports', index, 'coverage', 'activeSeconds'],
          message: '支持覆盖时长不能超过 PlanningBaseline 的声明时长。',
        })
      if (support.targetIds.some((id) => !input.calculationTarget.agentIds.includes(id)))
        context.addIssue({
          code: 'custom',
          path: ['supports', index, 'targetIds'],
          message: 'support target 必须属于 calculation target，而非账户快照。',
        })
      const permittedProviderIds = [
        ...input.calculationTarget.agentIds,
        ...(input.calculationTarget.bangbooId ? [input.calculationTarget.bangbooId] : []),
      ]
      if (support.providerId !== null && !permittedProviderIds.includes(support.providerId))
        context.addIssue({
          code: 'custom',
          path: ['supports', index, 'providerId'],
          message: 'support provider 必须是 calculation target 中已选身份。',
        })
      if (
        support.kind === 'personalFormula' &&
        (support.providerId === null ||
          support.targetIds.length !== 1 ||
          support.targetIds[0] !== support.providerId)
      )
        context.addIssue({
          code: 'custom',
          path: ['supports', index],
          message: 'personalFormula 必须由同一计算目标代理人提供并只作用于自身。',
        })
      if (support.kind === 'bangboo' && support.providerId !== input.calculationTarget.bangbooId)
        context.addIssue({
          code: 'custom',
          path: ['supports', index, 'providerId'],
          message: '邦布 support 必须匹配 calculation target 选择的邦布。',
        })
    })
  })
export type PlanningDpsInput = z.infer<typeof planningDpsInputSchema>

function supportState(support: CalculationSupport): 'ready' | 'partial' | 'unavailable' {
  if (support.build.state === 'missing' || support.calculation.state === 'missing')
    return 'unavailable'
  if (support.build.state === 'partial' || support.calculation.state === 'partial') return 'partial'
  return 'ready'
}

/** Consumers may expose one capability as ready while another remains partial;
 * this is deliberately independent of the legacy all-or-nothing Formal gate. */
export function derivePlanningCapabilityMatrix(
  input: Pick<PlanningDpsInput, 'accountSnapshot' | 'calculationTarget' | 'supports'>,
): PlanningCapabilityMatrix {
  const rows = planningDpsCapabilities.map((capability) => {
    const supports = input.supports.filter((support) => support.capabilities.includes(capability))
    const blockers: string[] = []
    let state: PlanningCapabilityState['state'] = 'ready'
    if (input.accountSnapshot.stale) {
      state = 'unavailable'
      blockers.push('账户资产快照已过期。')
    }
    if (!supports.length) {
      state = 'unavailable'
      blockers.push(`没有声明 ${capability} 所需的 CalculationSupport。`)
    }
    for (const agentId of input.calculationTarget.agentIds) {
      const personal = supports.find(
        (support) => support.kind === 'personalFormula' && support.providerId === agentId,
      )
      if (!personal) {
        state = 'unavailable'
        blockers.push(`计算目标代理人“${agentId}”缺少 ${capability} personalFormula。`)
      }
    }
    if (input.calculationTarget.scope === 'team') {
      const teamInteraction = supports.find(
        (support) => support.kind === 'interaction' || support.kind === 'pairOrTrio',
      )
      if (!teamInteraction) {
        state = 'unavailable'
        blockers.push(`队伍计算目标缺少 ${capability} interaction 或 pairOrTrio 声明。`)
      }
      if (input.calculationTarget.bangbooId !== null) {
        const bangboo = supports.find(
          (support) =>
            support.kind === 'bangboo' && support.providerId === input.calculationTarget.bangbooId,
        )
        if (!bangboo) {
          state = 'unavailable'
          blockers.push(
            `已选邦布“${input.calculationTarget.bangbooId}”缺少 ${capability} bangboo support。`,
          )
        }
      }
    }
    for (const support of supports) {
      const readiness = supportState(support)
      if (readiness === 'unavailable') {
        state = 'unavailable'
        blockers.push(`CalculationSupport “${support.supportId}”缺少 Build 或 Calculation 字段。`)
      } else if (readiness === 'partial' && state === 'ready') {
        state = 'partial'
        blockers.push(`CalculationSupport “${support.supportId}”仍有待核验字段。`)
      }
    }
    return { capability, state, supportIds: supports.map((support) => support.supportId), blockers }
  })
  return planningCapabilityMatrixSchema.parse(rows)
}

export type PlanningDpsContract = PlanningDpsInput & { fingerprint: string }

/** The fingerprint deliberately includes baseline, formula, support and solver
 * identity, as well as the actual account snapshot and calculation target. */
export function createPlanningDpsContract(input: PlanningDpsInput): PlanningDpsContract {
  const parsed = planningDpsInputSchema.parse(input)
  return {
    ...parsed,
    fingerprint: stableContentHash({
      baseline: parsed.baseline,
      formulaHash: parsed.baseline.formulaHash,
      supportHash: parsed.supportHash,
      solverHash: parsed.solverHash,
      accountSnapshot: parsed.accountSnapshot,
      calculationTarget: parsed.calculationTarget,
    }),
  }
}

const supportedResultBaseSchema = z
  .object({
    status: z.literal('supported'),
    baselineFingerprint: hashSchema,
    declaredDurationSeconds: z.number().positive(),
    capabilities: planningCapabilityMatrixSchema,
    totalDamage: z.number().nonnegative(),
    planningDps: z.number().nonnegative(),
  })
  .strict()
  .superRefine((result, context) => {
    const dps = result.capabilities.find((item) => item.capability === 'planning_dps')
    const damage = result.capabilities.find((item) => item.capability === 'planning_damage')
    if (dps?.state !== 'ready')
      context.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: 'Planning DPS 结果要求 planning_dps ready。',
      })
    if (damage?.state !== 'ready')
      context.addIssue({
        code: 'custom',
        path: ['capabilities'],
        message: 'Planning DPS 结果要求 planning_damage ready。',
      })
    if (
      Math.abs(result.totalDamage / result.declaredDurationSeconds - result.planningDps) > 0.000001
    )
      context.addIssue({
        code: 'custom',
        path: ['planningDps'],
        message: 'Planning DPS 必须等于总伤害除以声明时长。',
      })
  })

const teamContributionSchema = z
  .object({
    ownDamage: z.number().nonnegative(),
    bangbooDamage: z.number().nonnegative(),
    sharedDamage: z.number().nonnegative(),
    teamTotalDamage: z.number().nonnegative(),
  })
  .strict()
  .superRefine((contribution, context) => {
    const sum = contribution.ownDamage + contribution.bangbooDamage + contribution.sharedDamage
    if (Math.abs(sum - contribution.teamTotalDamage) > 0.000001)
      context.addIssue({
        code: 'custom',
        path: ['teamTotalDamage'],
        message: 'ownDamage + bangbooDamage + sharedDamage 必须守恒为 teamTotalDamage。',
      })
  })

const personalSoloResultSchema = supportedResultBaseSchema.extend({
  kind: z.literal('personal_solo'),
  subjectId: identifierSchema,
})
const memberInTeamResultSchema = supportedResultBaseSchema.extend({
  kind: z.literal('member_in_team'),
  subjectId: identifierSchema,
})
const teamResultSchema = supportedResultBaseSchema
  .extend({
    kind: z.literal('team'),
    contribution: teamContributionSchema,
  })
  .superRefine((result, context) => {
    if (Math.abs(result.totalDamage - result.contribution.teamTotalDamage) > 0.000001)
      context.addIssue({
        code: 'custom',
        path: ['contribution', 'teamTotalDamage'],
        message: 'team result 总伤害必须与贡献总伤害一致。',
      })
  })

const unsupportedResultSchema = z
  .object({
    status: z.literal('unsupported'),
    kind: z.enum(['personal_solo', 'member_in_team', 'team']),
    baselineFingerprint: hashSchema,
    capabilities: planningCapabilityMatrixSchema,
    blockers: z.array(z.string().min(1)).min(1),
  })
  .strict()

export const planningDpsResultSchema = z.union([
  personalSoloResultSchema,
  memberInTeamResultSchema,
  teamResultSchema,
  unsupportedResultSchema,
])
export type PlanningDpsResult = z.infer<typeof planningDpsResultSchema>
