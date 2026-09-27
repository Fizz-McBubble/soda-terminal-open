import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import {
  createPlanningDpsContract,
  derivePlanningCapabilityMatrix,
  planningDpsInputSchema,
  planningDpsResultSchema,
} from './planningDpsContract'
import { planningDpsExecutionSchema } from './planningDpsExecution'

const identifierSchema = z.string().min(1)
const hashSchema = z.string().min(1)

const additionalDamageBucketSchema = z
  .object({
    bucketId: identifierSchema,
    kind: z.enum(['bangboo', 'shared']),
    supportId: identifierSchema,
    providerId: identifierSchema,
    totalDamage: z.number().nonnegative(),
    sourceHash: hashSchema,
  })
  .strict()

export const planningTeamDpsInputSchema = z
  .object({
    planning: planningDpsInputSchema,
    memberExecutions: z.array(planningDpsExecutionSchema).length(3),
    additionalDamageBuckets: z.array(additionalDamageBucketSchema),
  })
  .strict()

const memberContributionSchema = z
  .object({
    agentId: identifierSchema,
    ownDamage: z.number().nonnegative(),
    damageShare: z.number().min(0).max(1),
    memberResultHash: hashSchema,
  })
  .strict()

const supportedTeamProjectionSchema = z
  .object({
    status: z.literal('supported'),
    result: planningDpsResultSchema,
    members: z.array(memberContributionSchema).length(3),
    bangbooDamage: z.number().nonnegative(),
    sharedDamage: z.number().nonnegative(),
    projectionHash: hashSchema,
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.result.status !== 'supported' || projection.result.kind !== 'team') {
      context.addIssue({
        code: 'custom',
        path: ['result'],
        message: 'supported team projection 必须包含 supported team result。',
      })
      return
    }
    const ownDamage = projection.members.reduce((sum, member) => sum + member.ownDamage, 0)
    if (Math.abs(ownDamage - projection.result.contribution.ownDamage) > 0.000001)
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: '成员 ownDamage 必须守恒为 team contribution ownDamage。',
      })
    const share = projection.members.reduce((sum, member) => sum + member.damageShare, 0)
    const expectedShare =
      projection.result.totalDamage === 0 ? 0 : ownDamage / projection.result.totalDamage
    if (Math.abs(share - expectedShare) > 0.000001)
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: '成员 damageShare 必须由 ownDamage / teamTotalDamage 派生。',
      })
  })

const unsupportedTeamProjectionSchema = z
  .object({
    status: z.literal('unsupported'),
    result: planningDpsResultSchema,
    blockers: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.result.status !== 'unsupported' || projection.result.kind !== 'team')
      context.addIssue({
        code: 'custom',
        path: ['result'],
        message: 'unsupported team projection 必须包含 unsupported team result。',
      })
  })

export const planningTeamDpsProjectionSchema = z.union([
  supportedTeamProjectionSchema,
  unsupportedTeamProjectionSchema,
])
export type PlanningTeamDpsProjection = z.infer<typeof planningTeamDpsProjectionSchema>

function unavailableCapabilities(reason: string) {
  return [
    {
      capability: 'planning_damage' as const,
      state: 'unavailable' as const,
      supportIds: [],
      blockers: [reason],
    },
    {
      capability: 'planning_dps' as const,
      state: 'unavailable' as const,
      supportIds: [],
      blockers: [reason],
    },
  ]
}

function unsupported(
  baselineFingerprint: string,
  capabilities:
    | ReturnType<typeof derivePlanningCapabilityMatrix>
    | ReturnType<typeof unavailableCapabilities>,
  blockers: readonly string[],
): PlanningTeamDpsProjection {
  const reasons = [...new Set(blockers.length ? blockers : ['Team Planning DPS 输入不完整。'])]
  return planningTeamDpsProjectionSchema.parse({
    status: 'unsupported',
    blockers: reasons,
    result: {
      status: 'unsupported',
      kind: 'team',
      baselineFingerprint,
      capabilities,
      blockers: reasons,
    },
  })
}

/**
 * Deterministic Team Planning DPS composition boundary. Member damage must
 * already be recalculated as member_in_team under this exact team contract;
 * Personal Solo results are deliberately rejected instead of being relabelled.
 */
export function composePlanningTeamDps(input: unknown): PlanningTeamDpsProjection {
  const parsed = planningTeamDpsInputSchema.safeParse(input)
  if (!parsed.success) {
    const rawBaseline =
      typeof input === 'object' && input !== null && 'planning' in input
        ? (input as { planning?: { baseline?: unknown } }).planning?.baseline
        : { state: 'missing-team-planning-baseline' }
    const reason = 'Team Planning DPS 输入、成员 execution 或 damage bucket 不完整。'
    return unsupported(stableContentHash(rawBaseline), unavailableCapabilities(reason), [reason])
  }

  const value = parsed.data
  const contract = createPlanningDpsContract(value.planning)
  const baselineFingerprint = stableContentHash(contract.baseline)
  const capabilities = derivePlanningCapabilityMatrix(contract)
  const blockers = capabilities.flatMap((capability) => capability.blockers)
  const target = contract.calculationTarget

  if (target.scope !== 'team' || target.agentIds.length !== 3)
    blockers.push('Team Planning DPS 必须具名三名代理人的 team calculationTarget。')

  const membersById = new Map<string, (typeof value.memberExecutions)[number]>()
  for (const execution of value.memberExecutions) {
    if (execution.contractFingerprint !== contract.fingerprint)
      blockers.push('Member execution 与 team contract fingerprint 不一致。')
    if (execution.baselineFingerprint !== baselineFingerprint)
      blockers.push('Member execution 与 Team PlanningBaseline 不一致。')
    if (execution.result.status !== 'supported' || execution.result.kind !== 'member_in_team') {
      blockers.push('Team 只能聚合 supported Member In-Team execution。')
      continue
    }
    if (execution.result.declaredDurationSeconds !== contract.baseline.declaredDurationSeconds)
      blockers.push(
        `成员“${execution.result.subjectId}”的声明时长与 Team PlanningBaseline 不一致。`,
      )
    if (membersById.has(execution.result.subjectId))
      blockers.push(`成员“${execution.result.subjectId}”重复。`)
    membersById.set(execution.result.subjectId, execution)
  }
  target.agentIds
    .filter((agentId) => !membersById.has(agentId))
    .forEach((agentId) => blockers.push(`缺少成员“${agentId}”的 Member In-Team execution。`))
  ;[...membersById.keys()]
    .filter((agentId) => !target.agentIds.includes(agentId))
    .forEach((agentId) => blockers.push(`成员“${agentId}”不属于 Team calculationTarget。`))

  const seenBucketIds = new Set<string>()
  let bangbooDamage = 0
  let sharedDamage = 0
  for (const bucket of value.additionalDamageBuckets) {
    if (seenBucketIds.has(bucket.bucketId)) blockers.push(`Damage bucket“${bucket.bucketId}”重复。`)
    seenBucketIds.add(bucket.bucketId)
    const support = contract.supports.find((item) => item.supportId === bucket.supportId)
    if (!support) {
      blockers.push(`Damage bucket“${bucket.bucketId}”缺少对应 CalculationSupport。`)
      continue
    }
    if (support.providerId !== bucket.providerId || support.sourceHash !== bucket.sourceHash)
      blockers.push(`Damage bucket“${bucket.bucketId}”的 provider/sourceHash 与 support 不一致。`)
    if (support.build.state !== 'complete' || support.calculation.state !== 'complete')
      blockers.push(`Damage bucket“${bucket.bucketId}”的 CalculationSupport 未完整。`)
    if (bucket.kind === 'bangboo') {
      if (support.kind !== 'bangboo' || bucket.providerId !== target.bangbooId)
        blockers.push(`Damage bucket“${bucket.bucketId}”不是当前 team 的具名 Bangboo support。`)
      bangbooDamage += bucket.totalDamage
    } else {
      if (!['outgoingTeamEffect', 'interaction', 'pairOrTrio'].includes(support.kind))
        blockers.push(`Damage bucket“${bucket.bucketId}”不是 shared damage support。`)
      sharedDamage += bucket.totalDamage
    }
  }
  if (
    target.bangbooId !== null &&
    !value.additionalDamageBuckets.some((item) => item.kind === 'bangboo')
  )
    blockers.push(`已选邦布“${target.bangbooId}”缺少具名 damage bucket，不能按 0 处理。`)

  if (capabilities.some((capability) => capability.state !== 'ready') || blockers.length)
    return unsupported(baselineFingerprint, capabilities, blockers)

  const memberRows = target.agentIds.map((agentId) => {
    const execution = membersById.get(agentId)!
    const result = execution.result
    if (result.status !== 'supported') throw new Error('unreachable unsupported member')
    return { agentId, ownDamage: result.totalDamage, memberResultHash: execution.resultHash }
  })
  const ownDamage = memberRows.reduce((sum, member) => sum + member.ownDamage, 0)
  const teamTotalDamage = ownDamage + bangbooDamage + sharedDamage
  const result = planningDpsResultSchema.parse({
    status: 'supported',
    kind: 'team',
    baselineFingerprint,
    declaredDurationSeconds: contract.baseline.declaredDurationSeconds,
    capabilities,
    totalDamage: teamTotalDamage,
    planningDps: teamTotalDamage / contract.baseline.declaredDurationSeconds,
    contribution: { ownDamage, bangbooDamage, sharedDamage, teamTotalDamage },
  })
  const members = memberRows.map((member) => ({
    ...member,
    damageShare: teamTotalDamage === 0 ? 0 : member.ownDamage / teamTotalDamage,
  }))
  const projection = {
    status: 'supported' as const,
    result,
    members,
    bangbooDamage,
    sharedDamage,
  }
  return planningTeamDpsProjectionSchema.parse({
    ...projection,
    projectionHash: stableContentHash(projection),
  })
}
