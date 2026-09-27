import { z } from 'zod'
import { currentCapabilityGapMatrix } from '../gameDataPacks/currentCapabilityGapMatrix'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import { createPlanningDpsContract, planningDpsInputSchema } from './planningDpsContract'
import { planningDpsExecutionSchema } from './planningDpsExecution'
import { planningTeamDpsProjectionSchema } from './planningTeamDps'
import type { TeamDpsAuthorityCalibration } from './currentTeamDpsAuthorityCalibration'

export const boxNumericDecisionVersion = 'soda-box-numeric-decision/v1' as const

const accountSchema = z
  .object({
    accountId: z.string().min(1),
    rosterHash: z.string().min(1),
    warehouseHash: z.string().min(1),
    planningHash: z.string().min(1),
    stale: z.boolean(),
  })
  .strict()

const assetBindingCoreSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            agentId: z.string().min(1),
            wEngineCopyId: z.string().min(1),
            discIds: z.array(z.string().min(1)).length(6),
            finalStatsHash: z.string().min(1),
          })
          .strict()
          .superRefine((member, context) => {
            if (new Set(member.discIds).size !== member.discIds.length)
              context.addIssue({
                code: 'custom',
                path: ['discIds'],
                message: '实体驱动盘不能重复。',
              })
          }),
      )
      .length(3),
    bangbooId: z.string().min(1).nullable(),
    bangbooStars: z.number().int().min(1).max(5).nullable().optional(),
    bangbooParameterHash: z.string().min(1).nullable().optional(),
  })
  .strict()

export const boxPlanningAssetBindingSchema = assetBindingCoreSchema
  .extend({ assetHash: z.string().min(1) })
  .strict()
  .superRefine((binding, context) => {
    if (new Set(binding.members.map((member) => member.agentId)).size !== 3)
      context.addIssue({ code: 'custom', path: ['members'], message: '资产绑定成员不能重复。' })
    const discIds = binding.members.flatMap((member) => member.discIds)
    if (new Set(discIds).size !== discIds.length)
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: '三名成员不能复用实体驱动盘。',
      })
    const wEngineCopyIds = binding.members.map((member) => member.wEngineCopyId)
    if (new Set(wEngineCopyIds).size !== wEngineCopyIds.length)
      context.addIssue({
        code: 'custom',
        path: ['members'],
        message: '三名成员不能复用实体音擎副本。',
      })
    if (
      binding.assetHash !==
      stableContentHash({
        members: binding.members,
        bangbooId: binding.bangbooId,
        ...(binding.bangbooStars !== undefined ? { bangbooStars: binding.bangbooStars } : {}),
        ...(binding.bangbooParameterHash !== undefined
          ? { bangbooParameterHash: binding.bangbooParameterHash }
          : {}),
      })
    )
      context.addIssue({
        code: 'custom',
        path: ['assetHash'],
        message: '实体资产绑定 hash 校验失败。',
      })
  })
export type BoxPlanningAssetBinding = z.infer<typeof boxPlanningAssetBindingSchema>

export const candidateEvaluationSchema = z
  .object({
    candidateId: z.string().min(1),
    planning: planningDpsInputSchema,
    assetBinding: boxPlanningAssetBindingSchema,
    projection: planningTeamDpsProjectionSchema,
    execution: planningDpsExecutionSchema,
  })
  .strict()

export type BoxNumericDecisionInput = {
  account: z.infer<typeof accountSchema>
  candidates: readonly TeamEngineCandidate[]
  evaluations: readonly unknown[]
  /** Read-only assembly blockers from the Decision Run; never substituted for an evaluation. */
  assemblyBlockersByCandidate?: Readonly<Record<string, readonly string[]>>
}

export type BoxNumericDecision = {
  contract: typeof boxNumericDecisionVersion
  status: 'ready' | 'unsupported'
  claim: {
    strength: 'current_box_static_model_optimal' | 'supported_scope_optimal' | 'unsupported'
    label: '当前 BOX 静态模型最优' | '已支持范围内最优' | '当前无可比较数值结果'
    blockers: string[]
  }
  ranked: Array<{
    rank: number
    candidateId: string
    memberIds: [string, string, string]
    bangbooId: string | null
    teamPlanningDps: number
    teamTotalDamage: number
    resultHash: string
    assetBinding: BoxPlanningAssetBinding
    preferredAgentCount: number
  }>
  excluded: Array<{ candidateId: string; reasons: string[] }>
  coverage: {
    legalCandidateCount: number
    numericCandidateCount: number
    excludedCandidateCount: number
    complete: boolean
  }
  fingerprint: string
  authorityCalibration?: TeamDpsAuthorityCalibration
  boundary: string
}

function sameIds(left: readonly string[], right: readonly string[]) {
  return stableContentHash(left) === stableContentHash(right)
}

function memberCoverageReasons(memberIds: readonly string[]) {
  return memberIds.flatMap((agentId) => {
    const row = currentCapabilityGapMatrix.rows.find((item) => item.stableId === agentId)
    if (!row) return [`成员“${agentId}”没有 current calculation support row。`]
    return row.calculation.status === 'ready'
      ? []
      : row.calculation.blockers.map((blocker) => `成员“${agentId}”：${blocker}`)
  })
}

function invalidEvaluationReasons(
  account: z.infer<typeof accountSchema>,
  candidate: TeamEngineCandidate,
  input: unknown,
) {
  const parsed = candidateEvaluationSchema.safeParse(input)
  if (!parsed.success) return { reasons: ['Team Planning evaluation 合同无效。'], value: null }
  const value = parsed.data
  const reasons: string[] = []
  const contract = createPlanningDpsContract(value.planning)
  const snapshot = contract.accountSnapshot
  const target = contract.calculationTarget

  if (value.candidateId !== candidate.candidateId)
    reasons.push('evaluation candidateId 与 Team Engine candidate 不一致。')
  if (target.scope !== 'team' || !sameIds(target.agentIds, candidate.memberIds))
    reasons.push('Planning calculationTarget 与 Team Engine 三名成员不一致。')
  if (target.bangbooId !== candidate.bangbooId)
    reasons.push('Planning calculationTarget 与 Team Engine 选中邦布不一致。')
  if (
    !sameIds(
      value.assetBinding.members.map((member) => member.agentId),
      candidate.memberIds,
    )
  )
    reasons.push('Planning 实体资产绑定成员与 Team Engine candidate 不一致。')
  if (value.assetBinding.bangbooId !== candidate.bangbooId)
    reasons.push('Planning 实体资产绑定邦布与 Team Engine candidate 不一致。')
  if (
    snapshot.accountId !== account.accountId ||
    snapshot.rosterHash !== account.rosterHash ||
    snapshot.warehouseHash !== account.warehouseHash ||
    snapshot.planningHash !== account.planningHash
  )
    reasons.push('Planning account snapshot 与当前 BOX 决策快照不一致。')
  if (account.stale || snapshot.stale) reasons.push('账户或资产快照已 stale。')
  if (value.execution.contractFingerprint !== contract.fingerprint)
    reasons.push('Team execution 与 Planning contract fingerprint 不一致。')
  if (value.projection.status !== 'supported')
    reasons.push('Team projection 为 unsupported，不能进入数值排序。')
  if (value.execution.result.status !== 'supported' || value.execution.result.kind !== 'team')
    reasons.push('Team execution 未提供 supported Team Planning DPS。')
  if (
    value.projection.status === 'supported' &&
    !sameIds(
      value.projection.members.map((member) => member.agentId),
      candidate.memberIds,
    )
  )
    reasons.push('Team contribution 成员与 Team Engine candidate 不一致。')
  if (
    value.projection.status === 'supported' &&
    value.execution.resultHash !== stableContentHash(value.projection.result)
  )
    reasons.push('Team execution resultHash 与 contribution projection 不一致。')

  return { reasons: [...new Set(reasons)], value }
}

/**
 * Coverage-gated numeric ranking over Team Engine-qualified candidates.
 * Team Engine score is intentionally never read: it remains candidate/search
 * ordering evidence and cannot overrule a valid Team Planning DPS result.
 */
export function buildBoxNumericDecision(input: BoxNumericDecisionInput): BoxNumericDecision {
  const account = accountSchema.parse(input.account)
  const evaluationByCandidate = new Map<string, unknown>()
  const duplicateEvaluationIds = new Set<string>()
  for (const raw of input.evaluations) {
    const parsed = candidateEvaluationSchema.safeParse(raw)
    if (!parsed.success) continue
    if (evaluationByCandidate.has(parsed.data.candidateId))
      duplicateEvaluationIds.add(parsed.data.candidateId)
    evaluationByCandidate.set(parsed.data.candidateId, raw)
  }

  const ranked: BoxNumericDecision['ranked'] = []
  const excluded: BoxNumericDecision['excluded'] = []
  const legalCandidates = input.candidates.filter(
    (candidate) =>
      candidate.classification !== 'cannot_close' &&
      candidate.classification !== 'assemble_only_not_recommended' &&
      candidate.kernelId !== null &&
      candidate.failures.length === 0,
  )

  for (const candidate of input.candidates) {
    const reasons: string[] = []
    if (candidate.classification === 'cannot_close' || candidate.failures.length)
      reasons.push('Team Engine 已判定该候选违反机制或合法性约束。')
    if (candidate.classification === 'assemble_only_not_recommended' || candidate.kernelId === null)
      reasons.push('仅有历史组装证据，未取得 Team Engine 数值候选资格。')
    if (new Set(candidate.memberIds).size !== 3)
      reasons.push('Team Engine candidate 必须包含三名不同成员。')
    if (duplicateEvaluationIds.has(candidate.candidateId))
      reasons.push('同一 candidate 存在重复 Team Planning evaluation。')
    const evaluation = evaluationByCandidate.get(candidate.candidateId)
    if (!evaluation) {
      reasons.push('该候选没有 Team Planning evaluation。')
      reasons.push(...(input.assemblyBlockersByCandidate?.[candidate.candidateId] ?? []))
      reasons.push(...memberCoverageReasons(candidate.memberIds))
      if (candidate.bangbooId)
        reasons.push(`邦布“${candidate.bangbooId}”尚无可执行 Planning damage adapter。`)
    }

    const checked = evaluation
      ? invalidEvaluationReasons(account, candidate, evaluation)
      : { reasons: [], value: null }
    reasons.push(...checked.reasons)
    if (reasons.length || !checked.value) {
      excluded.push({ candidateId: candidate.candidateId, reasons: [...new Set(reasons)] })
      continue
    }

    const result = checked.value.execution.result
    if (result.status !== 'supported' || result.kind !== 'team') continue
    ranked.push({
      rank: 0,
      candidateId: candidate.candidateId,
      memberIds: candidate.memberIds,
      bangbooId: candidate.bangbooId,
      teamPlanningDps: result.planningDps,
      teamTotalDamage: result.totalDamage,
      resultHash: checked.value.execution.resultHash,
      assetBinding: checked.value.assetBinding,
      preferredAgentCount: candidate.preferredAgentCount,
    })
  }

  ranked.sort(
    (left, right) =>
      right.teamPlanningDps - left.teamPlanningDps ||
      right.preferredAgentCount - left.preferredAgentCount ||
      left.candidateId.localeCompare(right.candidateId),
  )
  ranked.forEach((item, index) => (item.rank = index + 1))
  const complete = legalCandidates.length > 0 && ranked.length === legalCandidates.length
  const strength: BoxNumericDecision['claim']['strength'] = !ranked.length
    ? 'unsupported'
    : complete
      ? 'current_box_static_model_optimal'
      : 'supported_scope_optimal'
  const label: BoxNumericDecision['claim']['label'] =
    strength === 'current_box_static_model_optimal'
      ? '当前 BOX 静态模型最优'
      : strength === 'supported_scope_optimal'
        ? '已支持范围内最优'
        : '当前无可比较数值结果'
  const claimBlockers =
    strength === 'current_box_static_model_optimal'
      ? []
      : excluded
          .flatMap((item) => item.reasons)
          .filter((reason, index, all) => all.indexOf(reason) === index)
  const core = {
    contract: boxNumericDecisionVersion,
    status: ranked.length ? ('ready' as const) : ('unsupported' as const),
    claim: { strength, label, blockers: claimBlockers },
    ranked,
    excluded,
    coverage: {
      legalCandidateCount: legalCandidates.length,
      numericCandidateCount: ranked.length,
      excludedCandidateCount: excluded.length,
      complete,
    },
    boundary:
      '只对 Team Engine 合法且 Team Planning contract 完整的候选做数值排序；unsupported 不补零，Warehouse/Meta score 不参与最终名次。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
