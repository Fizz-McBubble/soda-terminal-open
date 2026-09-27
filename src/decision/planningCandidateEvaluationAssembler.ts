import type { AccountRoster } from '../assault/types'
import { currentCapabilityGapMatrix } from '../gameDataPacks/currentCapabilityGapMatrix'
import type { DriveDisc } from '../domain/schemas'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamExecution } from './teamExecutionProjection'
import {
  planningCandidateAuthorityBlockers,
  type PlanningCandidateEvaluationAuthority,
} from './planningCandidateEvaluationAuthority'

/**
 * Read-only hand-off from the Account Decision Run to a future Team Planning
 * evaluator.  It deliberately does not manufacture a PlanningBaseline,
 * CalculationContext, final-stat projection, or unsupported member result.
 */
export type PlanningCandidateEvaluationAssembly = {
  candidateId: string
  status: 'ready_for_evaluation' | 'unsupported'
  blockers: string[]
  assets: {
    memberIds: [string, string, string]
    bangbooId: string | null
    members: Array<{
      agentId: string
      wEngineCopyId: string | null
      wEngineId: string | null
      discIds: string[]
      discSetIds: string[]
    }>
  } | null
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function calculationBlockers(agentId: string) {
  const row = currentCapabilityGapMatrix.rows.find((item) => item.stableId === agentId)
  if (!row) return [`成员“${agentId}”没有 current calculation support row。`]
  if (row.calculation.status === 'ready') return []
  return row.calculation.blockers.map((blocker) => `成员“${agentId}”：${blocker}`)
}

/**
 * Collects only account facts already selected by Team Execution.  Missing
 * calculation authority remains a named blocker so the BOX decision can
 * explain why a visible candidate did not receive a numeric rank.
 */
export function assemblePlanningCandidateEvaluations(input: {
  candidates: readonly TeamEngineCandidate[]
  executions: readonly TeamExecution[]
  roster: AccountRoster
  discs: readonly DriveDisc[]
  /** Injectable authority; omitted candidates remain explicitly unsupported. */
  authorityByCandidate?: Readonly<Record<string, PlanningCandidateEvaluationAuthority | undefined>>
}): PlanningCandidateEvaluationAssembly[] {
  const executionByCandidate = new Map(input.executions.map((item) => [item.candidateId, item]))
  const discById = new Map(input.discs.map((disc) => [disc.id, disc]))
  return input.candidates.map((candidate) => {
    const execution = executionByCandidate.get(candidate.candidateId)
    const blockers: string[] = []
    if (!execution) blockers.push('当前 Decision Run 没有该候选的 Team Execution 投影。')
    else {
      if (execution.status !== 'ready') blockers.push(...execution.blockers)
      if (execution.memberIds.join('|') !== candidate.memberIds.join('|'))
        blockers.push('Team Execution 成员与 Team Engine candidate 不一致。')
      if (execution.bangbooId !== (candidate.bangbooId ?? ''))
        blockers.push('Team Execution 邦布与 Team Engine candidate 不一致。')
    }

    const members = candidate.memberIds.map((agentId) => {
      const member = execution?.members.find((item) => item.agentId === agentId)
      const copyId = member?.suggested.wEngine?.copyId ?? null
      const engineId = member?.suggested.wEngine?.engineId ?? null
      const discIds = member?.suggested.discIds ?? []
      const discs = discIds
        .map((discId) => discById.get(discId))
        .filter((disc): disc is DriveDisc => Boolean(disc))

      const authority = input.authorityByCandidate?.[candidate.candidateId]
      if (!authority) blockers.push(...calculationBlockers(agentId))
      if (!member?.suggested.wEngine)
        blockers.push(`成员“${agentId}”的推荐音擎参数没有进入 Team Execution。`)
      if (discIds.length !== 6 || discs.length !== 6 || new Set(discIds).size !== 6)
        blockers.push(`成员“${agentId}”没有六张可验证的实体驱动盘。`)

      return {
        agentId,
        // Legacy transport field only. New evaluations consume engineId directly.
        wEngineCopyId: copyId,
        wEngineId: engineId,
        discIds,
        discSetIds: discs.map((disc) => disc.setId),
      }
    })

    const authorityCheck = planningCandidateAuthorityBlockers(
      candidate,
      input.authorityByCandidate?.[candidate.candidateId],
    )
    blockers.push(...authorityCheck.blockers)

    const assets = execution
      ? {
          memberIds: [...candidate.memberIds] as [string, string, string],
          bangbooId: candidate.bangbooId,
          members,
        }
      : null
    return {
      candidateId: candidate.candidateId,
      status: blockers.length ? 'unsupported' : 'ready_for_evaluation',
      blockers: unique(blockers),
      assets,
    }
  })
}
