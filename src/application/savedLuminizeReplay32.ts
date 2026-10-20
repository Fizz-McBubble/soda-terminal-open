import { z } from 'zod'
import type { AccountPlanningDraft } from '../accounts/types'
import { savedDeclaredLuminizeSettlement32Schema } from '../accounts/luminizeSavedContract32'
import { historicalLuminizeSettlementSchema32 } from '../calculation/luminizeSettlementContract32'
import { reviewedLumifluxMechanicsHash32 } from '../calculation/reviewedLumifluxMechanics32'
import { contentHash } from './contentHash'

type PlanContext = Pick<AccountPlanningDraft, 'kind' | 'solutionContext'> &
  Partial<Pick<AccountPlanningDraft, 'selection' | 'teamExecutionSnapshot'>>

/** Lightweight seal/source inspection; no calculation producer enters the browser graph. */
export function inspectSavedLuminizeReplay32(plan: PlanContext) {
  const raw = plan.solutionContext?.declaredLuminizeSettlement32
  if (raw === undefined) return { status: 'not_declared' as const }
  const invalid = (blocker: string) => ({ status: 'invalid' as const, blockers: [blocker] })
  const parsed = savedDeclaredLuminizeSettlement32Schema.safeParse(raw)
  if (!parsed.success) return invalid('luminize_saved_snapshot_invalid')
  const snapshot = parsed.data
  const members = snapshot.declaration.memberAgentIds
  const selected = plan.selection?.agentIds
  const sameMembers = (ids: unknown): ids is string[] =>
    Array.isArray(ids) &&
    ids.length === members.length &&
    new Set(ids).size === ids.length &&
    ids.every((agentId) => members.includes(agentId))
  if (
    plan.kind !== 'team' ||
    plan.solutionContext?.contract !== 'soda-solution-context/v1' ||
    plan.solutionContext.scope !== 'team_joint' ||
    plan.solutionContext.resourcePolicy !== 'within_team_exclusive' ||
    new Set(members).size !== members.length ||
    !sameMembers(selected)
  )
    return invalid('luminize_saved_team_mismatch')
  const execution = plan.teamExecutionSnapshot
  if (
    execution &&
    (!sameMembers(execution.memberIds) ||
      (execution.deploymentOrder !== undefined &&
        (!sameMembers(execution.deploymentOrder) ||
          execution.deploymentOrder.some((agentId, index) => agentId !== members[index]))))
  )
    return invalid('luminize_saved_deployment_mismatch')
  if (snapshot.declaration.sourceIdentityHash !== reviewedLumifluxMechanicsHash32)
    return { status: 'stale' as const, blockers: ['luminize_saved_source_stale'] }
  return { status: 'current' as const, snapshot }
}

const id = z.string().trim().min(1)
const instance = z
  .object({
    id,
    ownerAgentId: id,
    attribute: historicalLuminizeSettlementSchema32.shape.voidflares.element.shape.attribute,
    damage: z.number().finite().nonnegative(),
  })
  .strict()
const replayBodySchema = z
  .object({
    contract: z.literal('soda-saved-luminize-replay32/v1'),
    status: z.enum(['declared_arithmetic', 'stale', 'invalid', 'unavailable']),
    sourceIdentityHash: id.nullable(),
    snapshotFingerprint: id.nullable(),
    inputFingerprint: id.nullable(),
    totalDamage: z.number().finite().nonnegative().nullable(),
    instances: z.array(instance).max(3),
    blockers: z.array(id),
    boundary: id,
    formalCycleReady: z.literal(false),
    modelQualification32: z.null(),
  })
  .strict()

export const savedLuminizeReplaySchema32 = replayBodySchema
  .extend({ fingerprint: id })
  .superRefine((value, context) => {
    const { fingerprint, ...body } = value
    const success = body.status === 'declared_arithmetic'
    const sum = body.instances.reduce((total, row) => total + row.damage, 0)
    if (
      fingerprint !== contentHash(body) ||
      (success &&
        (body.sourceIdentityHash !== reviewedLumifluxMechanicsHash32 ||
          !body.snapshotFingerprint ||
          !body.inputFingerprint ||
          body.totalDamage === null ||
          !body.instances.length ||
          new Set(body.instances.map((row) => row.id)).size !== body.instances.length ||
          body.blockers.length > 0 ||
          !Number.isFinite(sum) ||
          Math.abs(sum - body.totalDamage) > Math.max(1e-9, Math.abs(sum) * 1e-12))) ||
      (!success &&
        (body.totalDamage !== null || body.instances.length > 0 || !body.blockers.length))
    )
      context.addIssue({ code: 'custom', message: '保存辉映回放身份、状态或数值无效。' })
  })

export type SavedLuminizeReplay32 = z.infer<typeof savedLuminizeReplaySchema32>

export function sealSavedLuminizeReplay32(
  body: z.infer<typeof replayBodySchema>,
): SavedLuminizeReplay32 {
  return savedLuminizeReplaySchema32.parse({ ...body, fingerprint: contentHash(body) })
}
