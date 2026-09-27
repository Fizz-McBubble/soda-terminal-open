import { z } from 'zod'
import type { TeamEngineCandidate } from '../teamEngine/contracts'

const hashSchema = z.string().min(1)
const evidenceSchema = z.array(z.string().min(1)).min(1)

const authoritySchema = z
  .object({
    baseline: z
      .object({
        baselineId: z.string().min(1),
        formulaHash: hashSchema,
        sourcePackHash: hashSchema,
        declaredDurationSeconds: z.number().positive(),
      })
      .optional(),
    context: z
      .object({
        contextId: z.string().min(1),
        memberIds: z.array(z.string().min(1)).length(3),
        sourceHash: hashSchema,
      })
      .optional(),
    finalStats: z
      .array(
        z.object({
          agentId: z.string().min(1),
          finalStatsHash: hashSchema,
          evidenceRefs: evidenceSchema,
        }),
      )
      .optional(),
    memberAdapters: z
      .array(
        z.object({
          agentId: z.string().min(1),
          status: z.enum(['ready', 'unsupported']),
          sourceHash: hashSchema,
          blockers: z.array(z.string().min(1)),
        }),
      )
      .optional(),
    bangboo: z
      .object({
        bangbooId: z.string().min(1),
        status: z.enum(['ready', 'unsupported']),
        sourceHash: hashSchema,
        blockers: z.array(z.string().min(1)),
      })
      .optional(),
  })
  .strict()

export type PlanningCandidateEvaluationAuthority = z.infer<typeof authoritySchema>

function sameOrderedIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * The assembler accepts authority only through this explicit, versioned shape.
 * It changes readiness-to-evaluate, never manufactures an evaluation or a DPS
 * value; BoxNumericDecision still demands a complete Team Planning contract.
 */
export function planningCandidateAuthorityBlockers(
  candidate: TeamEngineCandidate,
  rawAuthority: unknown,
) {
  const parsed = authoritySchema.safeParse(rawAuthority)
  if (!parsed.success)
    return {
      authority: null,
      blockers: [
        '当前 Decision Run 未提供具名 PlanningBaseline。',
        '当前 Decision Run 未提供三成员同合同的 CalculationContext。',
        '当前 Decision Run 未提供三名成员的 verified finalStatsHash。',
        `邦布“${candidate.bangbooId ?? '未选择'}”未注入 current Planning damage adapter。`,
      ],
    }
  const authority = parsed.data
  const blockers: string[] = []
  if (!authority.baseline) blockers.push('当前 Decision Run 未提供具名 PlanningBaseline。')
  if (!authority.context)
    blockers.push('当前 Decision Run 未提供三成员同合同的 CalculationContext。')
  else if (!sameOrderedIds(authority.context.memberIds, candidate.memberIds))
    blockers.push('注入的 CalculationContext 成员与 Team Engine candidate 不一致。')

  const finalStatsByAgent = new Map(
    (authority.finalStats ?? []).map((item) => [item.agentId, item]),
  )
  candidate.memberIds.forEach((agentId) => {
    if (!finalStatsByAgent.get(agentId))
      blockers.push(`成员“${agentId}”未注入 verified finalStatsHash。`)
  })
  const adaptersByAgent = new Map(
    (authority.memberAdapters ?? []).map((item) => [item.agentId, item]),
  )
  candidate.memberIds.forEach((agentId) => {
    const adapter = adaptersByAgent.get(agentId)
    if (!adapter) blockers.push(`成员“${agentId}”未注入 current Team Planning formula adapter。`)
    else if (adapter.status !== 'ready')
      blockers.push(...adapter.blockers.map((item) => `成员“${agentId}”：${item}`))
  })

  if (!candidate.bangbooId) blockers.push('Team Engine candidate 未选择具名邦布。')
  else if (!authority.bangboo || authority.bangboo.bangbooId !== candidate.bangbooId)
    blockers.push(`邦布“${candidate.bangbooId}”未注入 current Planning damage adapter。`)
  else if (authority.bangboo.status !== 'ready') blockers.push(...authority.bangboo.blockers)

  return { authority, blockers: [...new Set(blockers)] }
}
