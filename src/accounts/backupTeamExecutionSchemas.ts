import { z } from 'zod'
import { savedTeamCultivationSchema } from '../domain/savedTeamCultivationSchema'
import {
  authorComparisonMembershipSchema,
  refineAuthorComparisonBangbooIdentity,
} from './backupAuthorComparisonSchemas'

const teamExecutionWEngineSchema = z
  .object({
    engineId: z.string().min(1),
    copyId: z.string().min(1).nullable(),
    refinement: z.number().int().min(0),
    level: z.number().int().min(0).max(60).optional(),
    ascension: z.number().int().min(0).max(5).optional(),
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
    cultivation: savedTeamCultivationSchema.optional(),
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

export const teamExecutionSchema = z
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
