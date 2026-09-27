import { z } from 'zod'
import {
  teamFeatureBands,
  type BenchmarkEvidence,
  type DecisionEvidence,
  type HardPruneDecision,
  type UnsupportedDecisionIssue,
} from './teamDecisionAuthority'

export const identifierSchema = z.string().min(1)

export const teamFeatureExtractionSignalsSchema = z
  .object({
    candidateId: identifierSchema,
    memberIds: z.array(identifierSchema).length(3),
    bangbooId: identifierSchema.nullable(),
    rulesComplete: z.boolean(),
    fieldTimeWithinBudget: z.boolean(),
    resourceLoopClosed: z.boolean(),
    activationAtBase: z.boolean(),
    observedPartnerRelationCount: z.number().int().min(0).max(3),
    effectRecipientCounts: z
      .object({
        self: z.number().int().nonnegative(),
        active_agent: z.number().int().nonnegative(),
        team: z.number().int().nonnegative(),
        enemy: z.number().int().nonnegative(),
      })
      .strict(),
    distinctSpecialtyCount: z.number().int().min(0).max(3),
    distinctAttributeCount: z.number().int().min(0).max(3),
    outputPotentialBand: z.enum(teamFeatureBands),
    benchmark: z.custom<BenchmarkEvidence>(),
    evidence: z.array(z.custom<DecisionEvidence>()),
    unsupportedIssues: z.array(z.custom<UnsupportedDecisionIssue>()),
    hardPrunes: z.array(z.custom<HardPruneDecision>()),
  })
  .strict()
  .superRefine((signals, context) => {
    if (new Set(signals.memberIds).size !== signals.memberIds.length)
      context.addIssue({
        code: 'custom',
        path: ['memberIds'],
        message: 'Team Rating signals 不能包含重复成员。',
      })
    if (signals.benchmark.status === 'complete' && signals.outputPotentialBand === 'unknown')
      context.addIssue({
        code: 'custom',
        path: ['outputPotentialBand'],
        message: '完整 Benchmark 必须提供同 baseline 的 Output Potential band。',
      })
    if (signals.benchmark.status === 'unavailable' && signals.outputPotentialBand !== 'unknown')
      context.addIssue({
        code: 'custom',
        path: ['outputPotentialBand'],
        message: '不可用 Benchmark 的 Output Potential 必须保持 unknown。',
      })
  })

export type TeamFeatureExtractionSignals = z.input<typeof teamFeatureExtractionSignalsSchema>
