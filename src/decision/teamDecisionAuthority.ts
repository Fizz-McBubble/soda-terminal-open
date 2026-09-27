import { z } from 'zod'

import { stableContentHash } from '../gameDataPacks/types'

const identifierSchema = z.string().min(1)
const explanationSchema = z.string().min(1)

export const teamDecisionAuthorityContractId = 'soda-team-decision-authority/v1' as const

export const decisionProvenanceKinds = [
  'source_fact',
  'baseline_assumption',
  'derived_state',
] as const
export type DecisionProvenanceKind = (typeof decisionProvenanceKinds)[number]

export const unsupportedDecisionClasses = [
  'mechanic_critical',
  'benchmark_relevant',
  'rotation_sensitive',
  'environment_specific',
] as const
export type UnsupportedDecisionClass = (typeof unsupportedDecisionClasses)[number]

export const hardPruneReasons = [
  'non_current_entity',
  'not_available_in_selected_scope',
  'required_activation_impossible',
  'required_mechanic_impossible',
  'physical_asset_conflict_unsatisfied',
  'explicit_mechanic_exclusion',
  'authority_stale_or_invalid',
] as const
export type HardPruneReason = (typeof hardPruneReasons)[number]

export const teamRatingDimensions = [
  'mechanic_synergy',
  'cycle_stability',
  'output_potential',
  'field_time_efficiency',
  'team_effect_quality',
  'flexibility_robustness',
  'evidence_confidence',
] as const
export type TeamRatingDimension = (typeof teamRatingDimensions)[number]

export const teamFeatureBands = ['excellent', 'good', 'mixed', 'weak', 'unknown'] as const
export type TeamFeatureBand = (typeof teamFeatureBands)[number]

export const teamRatingBands = ['S+', 'S', 'A+', 'A', 'B', 'Experimental'] as const
export type TeamRatingBand = (typeof teamRatingBands)[number]

export const decisionConfidenceBands = ['high', 'medium', 'low', 'experimental'] as const
export type DecisionConfidenceBand = (typeof decisionConfidenceBands)[number]

export const cultivationPriorityTiers = [
  'ready_now',
  'short_upgrade',
  'strategic_build',
  'experimental',
] as const
export type CultivationPriorityTier = (typeof cultivationPriorityTiers)[number]

export const decisionEvidenceSchema = z
  .object({
    evidenceId: identifierSchema,
    provenance: z.enum(decisionProvenanceKinds),
    reference: identifierSchema,
    explanation: explanationSchema,
    contentHash: identifierSchema,
  })
  .strict()
export type DecisionEvidence = z.infer<typeof decisionEvidenceSchema>

export const unsupportedDecisionIssueSchema = z
  .object({
    issueId: identifierSchema,
    conditionKey: identifierSchema,
    classification: z.enum(unsupportedDecisionClasses),
    impact: explanationSchema,
    evidenceRefs: z.array(identifierSchema),
  })
  .strict()
export type UnsupportedDecisionIssue = z.infer<typeof unsupportedDecisionIssueSchema>

export const hardPruneDecisionSchema = z
  .object({
    reason: z.enum(hardPruneReasons),
    subjectId: identifierSchema,
    explanation: explanationSchema,
    evidenceRefs: z.array(identifierSchema).min(1),
  })
  .strict()
export type HardPruneDecision = z.infer<typeof hardPruneDecisionSchema>

export const teamFeatureDimensionSchema = z
  .object({
    dimension: z.enum(teamRatingDimensions),
    band: z.enum(teamFeatureBands),
    confidence: z.enum(decisionConfidenceBands),
    positiveEvidenceRefs: z.array(identifierSchema),
    penalties: z.array(explanationSchema),
    missingIssueIds: z.array(identifierSchema),
    explanation: explanationSchema,
  })
  .strict()
export type TeamFeatureDimension = z.infer<typeof teamFeatureDimensionSchema>

export const benchmarkEvidenceSchema = z
  .object({
    status: z.enum(['complete', 'partial', 'unavailable']),
    baselineId: identifierSchema.nullable(),
    outputIndex: z.number().nonnegative().nullable(),
    unsupportedIssueIds: z.array(identifierSchema),
    explanation: explanationSchema,
  })
  .strict()
  .superRefine((benchmark, context) => {
    if (benchmark.status === 'complete') {
      if (benchmark.baselineId === null || benchmark.outputIndex === null)
        context.addIssue({
          code: 'custom',
          message: '完整 Benchmark 必须具名 baseline 并提供 Output Index。',
        })
      if (benchmark.unsupportedIssueIds.length)
        context.addIssue({
          code: 'custom',
          path: ['unsupportedIssueIds'],
          message: '完整 Benchmark 不能保留 unsupported issue。',
        })
    }
    if (benchmark.status === 'partial') {
      if (benchmark.baselineId === null)
        context.addIssue({
          code: 'custom',
          path: ['baselineId'],
          message: '部分 Benchmark 仍必须具名比较 baseline。',
        })
      if (!benchmark.unsupportedIssueIds.length)
        context.addIssue({
          code: 'custom',
          path: ['unsupportedIssueIds'],
          message: '部分 Benchmark 必须说明未闭合 issue。',
        })
    }
    if (benchmark.status === 'unavailable' && benchmark.outputIndex !== null)
      context.addIssue({
        code: 'custom',
        path: ['outputIndex'],
        message: '不可用 Benchmark 不能提供 Output Index。',
      })
  })
export type BenchmarkEvidence = z.infer<typeof benchmarkEvidenceSchema>

const teamFeatureVectorInputSchema = z
  .object({
    contract: z.literal(teamDecisionAuthorityContractId),
    candidateId: identifierSchema,
    memberIds: z.array(identifierSchema).length(3),
    bangbooId: identifierSchema.nullable(),
    hardPrunes: z.array(hardPruneDecisionSchema),
    dimensions: z.array(teamFeatureDimensionSchema).length(teamRatingDimensions.length),
    benchmark: benchmarkEvidenceSchema,
    evidence: z.array(decisionEvidenceSchema),
    unsupportedIssues: z.array(unsupportedDecisionIssueSchema),
  })
  .strict()
  .superRefine((vector, context) => {
    if (new Set(vector.memberIds).size !== vector.memberIds.length)
      context.addIssue({
        code: 'custom',
        path: ['memberIds'],
        message: 'Team Feature Vector 不能包含重复成员。',
      })

    const dimensions = vector.dimensions.map((item) => item.dimension)
    if (new Set(dimensions).size !== dimensions.length)
      context.addIssue({
        code: 'custom',
        path: ['dimensions'],
        message: 'Team Rating 维度不能重复。',
      })
    for (const dimension of teamRatingDimensions)
      if (!dimensions.includes(dimension))
        context.addIssue({
          code: 'custom',
          path: ['dimensions'],
          message: `Team Feature Vector 缺少 ${dimension}。`,
        })

    const evidenceIds = vector.evidence.map((item) => item.evidenceId)
    if (new Set(evidenceIds).size !== evidenceIds.length)
      context.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'Decision Evidence 不能重复。',
      })
    const issueIds = vector.unsupportedIssues.map((item) => item.issueId)
    if (new Set(issueIds).size !== issueIds.length)
      context.addIssue({
        code: 'custom',
        path: ['unsupportedIssues'],
        message: 'Unsupported issue 不能重复。',
      })

    const knownEvidence = new Set(evidenceIds)
    const knownIssues = new Set(issueIds)
    const checkEvidenceRefs = (refs: readonly string[], path: (string | number)[]) => {
      for (const reference of refs)
        if (!knownEvidence.has(reference))
          context.addIssue({
            code: 'custom',
            path,
            message: `未知 Decision Evidence：${reference}。`,
          })
    }
    vector.hardPrunes.forEach((prune, index) =>
      checkEvidenceRefs(prune.evidenceRefs, ['hardPrunes', index, 'evidenceRefs']),
    )
    vector.unsupportedIssues.forEach((issue, index) =>
      checkEvidenceRefs(issue.evidenceRefs, ['unsupportedIssues', index, 'evidenceRefs']),
    )
    vector.dimensions.forEach((dimension, index) => {
      checkEvidenceRefs(dimension.positiveEvidenceRefs, [
        'dimensions',
        index,
        'positiveEvidenceRefs',
      ])
      for (const issueId of dimension.missingIssueIds)
        if (!knownIssues.has(issueId))
          context.addIssue({
            code: 'custom',
            path: ['dimensions', index, 'missingIssueIds'],
            message: `未知 Unsupported issue：${issueId}。`,
          })
    })
    for (const issueId of vector.benchmark.unsupportedIssueIds)
      if (!knownIssues.has(issueId))
        context.addIssue({
          code: 'custom',
          path: ['benchmark', 'unsupportedIssueIds'],
          message: `Benchmark 引用了未知 Unsupported issue：${issueId}。`,
        })
  })

export type TeamFeatureVectorInput = z.input<typeof teamFeatureVectorInputSchema>
export type TeamFeatureVector = z.output<typeof teamFeatureVectorInputSchema> & {
  fingerprint: string
}

export function createTeamFeatureVector(input: TeamFeatureVectorInput): TeamFeatureVector {
  const parsed = teamFeatureVectorInputSchema.parse(input)
  return { ...parsed, fingerprint: stableContentHash(parsed) }
}

export function teamRatingBlockerIssueIds(issues: readonly UnsupportedDecisionIssue[]) {
  return issues
    .filter((issue) => issue.classification === 'mechanic_critical')
    .map((issue) => issue.issueId)
}

export function deriveTeamRatingReadiness(vector: TeamFeatureVector) {
  if (vector.hardPrunes.length)
    return {
      status: 'hard_invalid' as const,
      blockers: vector.hardPrunes.map((prune) => prune.reason),
    }
  const blockers = teamRatingBlockerIssueIds(vector.unsupportedIssues)
  return blockers.length
    ? { status: 'blocked' as const, blockers }
    : { status: 'ready' as const, blockers: [] }
}

export const teamRatingResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      contract: z.literal(teamDecisionAuthorityContractId),
      status: z.literal('rated'),
      candidateId: identifierSchema,
      featureFingerprint: identifierSchema,
      ratingBand: z.enum(teamRatingBands),
      confidence: z.enum(decisionConfidenceBands),
      explanation: explanationSchema,
      tradeoffs: z.array(explanationSchema),
    })
    .strict(),
  z
    .object({
      contract: z.literal(teamDecisionAuthorityContractId),
      status: z.enum(['hard_invalid', 'blocked']),
      candidateId: identifierSchema,
      featureFingerprint: identifierSchema,
      blockerIds: z.array(identifierSchema).min(1),
      explanation: explanationSchema,
    })
    .strict(),
])
export type TeamRatingResult = z.infer<typeof teamRatingResultSchema>

export const accountDecisionReadinessBands = [
  'ready',
  'near_ready',
  'development',
  'blocked',
  'not_evaluated',
] as const
export const investmentCostBands = ['low', 'medium', 'high', 'unknown'] as const
export const assetConflictBands = ['none', 'resolvable', 'blocking', 'not_evaluated'] as const
export const marginalGainBands = ['transformative', 'high', 'medium', 'low', 'unknown'] as const
export const coverageGainBands = [
  'new_required_team',
  'new_scenario',
  'redundancy',
  'none',
  'unknown',
] as const
export const replacementCostBands = ['low', 'medium', 'high', 'unknown'] as const

export const cultivationPriorityInputSchema = z
  .object({
    contract: z.literal(teamDecisionAuthorityContractId),
    candidateId: identifierSchema,
    teamRating: teamRatingResultSchema,
    currentReadiness: z.enum(accountDecisionReadinessBands),
    investmentCost: z.enum(investmentCostBands),
    assetConflict: z.enum(assetConflictBands),
    marginalAccountGain: z.enum(marginalGainBands),
    coverageGain: z.enum(coverageGainBands),
    replacementCost: z.enum(replacementCostBands),
    buildCompletionDistance: z
      .object({
        missingAgents: z.number().int().nonnegative(),
        missingWEngines: z.number().int().nonnegative(),
        missingBangboos: z.number().int().nonnegative(),
        missingDiscSlots: z.number().int().nonnegative().nullable(),
        missingSkillInvestments: z.number().int().nonnegative(),
        // Kept separate from skill levels: this is a source-reviewed team
        // activation prerequisite, not a generic level-up estimate.
        missingPotentialInvestments: z.number().int().nonnegative().default(0),
      })
      .strict(),
    potentialGaps: z
      .array(
        z
          .object({
            agentId: identifierSchema,
            agentName: explanationSchema,
            current: z.number().int().min(0).max(6),
            minimum: z.number().int().min(1).max(6),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.teamRating.candidateId !== input.candidateId)
      context.addIssue({
        code: 'custom',
        path: ['teamRating', 'candidateId'],
        message: 'Cultivation Priority 必须绑定同一 Team Rating candidate。',
      })
    if (input.teamRating.status !== 'rated')
      context.addIssue({
        code: 'custom',
        path: ['teamRating', 'status'],
        message: '未评级或 hard-invalid 队伍不能进入 Cultivation Priority。',
      })
  })
export type CultivationPriorityInput = z.infer<typeof cultivationPriorityInputSchema>

export const cultivationPriorityResultSchema = z
  .object({
    contract: z.literal(teamDecisionAuthorityContractId),
    candidateId: identifierSchema,
    tier: z.enum(cultivationPriorityTiers),
    teamRatingBand: z.enum(teamRatingBands),
    confidence: z.enum(decisionConfidenceBands),
    reasons: z.array(explanationSchema).min(1),
    tradeoffs: z.array(explanationSchema),
    nextAction: explanationSchema,
    inputFingerprint: identifierSchema,
  })
  .strict()
export type CultivationPriorityResult = z.infer<typeof cultivationPriorityResultSchema>

export function createCultivationPriorityInput(raw: unknown): CultivationPriorityInput {
  return cultivationPriorityInputSchema.parse(raw)
}

export function deriveCultivationPriorityTier(
  input: CultivationPriorityInput,
): CultivationPriorityTier {
  if (
    input.teamRating.status !== 'rated' ||
    input.teamRating.ratingBand === 'Experimental' ||
    input.teamRating.confidence === 'experimental' ||
    input.currentReadiness === 'blocked' ||
    input.assetConflict === 'blocking'
  )
    return 'experimental'
  if (
    input.currentReadiness === 'ready' &&
    input.investmentCost !== 'high' &&
    input.investmentCost !== 'unknown'
  )
    return 'ready_now'
  if (
    input.currentReadiness === 'near_ready' &&
    input.investmentCost !== 'high' &&
    input.investmentCost !== 'unknown'
  )
    return 'short_upgrade'
  return 'strategic_build'
}

export function cultivationPriorityInputFingerprint(input: CultivationPriorityInput) {
  return stableContentHash(cultivationPriorityInputSchema.parse(input))
}
