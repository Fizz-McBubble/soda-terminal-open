import type { AccountRoster } from '../assault/types'
import { currentBangbooDirectory } from '../assault/catalog'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import {
  evaluateSourceBackedPlanningTeamDps,
  type SourceBackedPlanningEffectBucket,
} from '../calculation/currentPlanningTeamDpsRuntime'
import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { projectCurrent31ExhaustiveAccountCandidates } from '../teamEngine/current31ExhaustiveAccountCandidateProjection'
import { selectAuthoritativeBangbooRecommendation } from './bangbooRecommendationAuthority'
import { classifyCurrentBangbooDecisionBlockerCounts } from './teamDecisionIssueClassification'
import { resolveCurrent31VariantBangbooRecommendation } from './current31VariantBangbooRecommendation'
import {
  type BangbooDamageBucket,
  FNV_OFFSET,
  hashWord,
  absorbFingerprintWord,
  fingerprintFromWord,
  createBangbooEvaluationAudits,
  projectCurrentBangbooComposition,
  compositionCacheKey,
  evaluateBangbooFixedEvent,
} from './exhaustiveBangbooScoring'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import type { PotentialApplicationEvent } from '../calculation/potentialApplicationBinding'
import { compileAgentAlternatives, bestDistinctAssignment } from './exhaustiveAgentScoring'
import { compileIncremental32PlanningSourceSelection } from './incremental32PlanningSourceSelection'
import { projectTargetTeamWEngineModifiers } from '../calculation/targetTeamEquipmentModifierProjection'

export { projectCurrentBangbooComposition } from './exhaustiveBangbooScoring'

/**
 * Production identity/rating input. It preserves the complete legal formation universe without
 * running the exhaustive numeric oracle. Numeric evaluation belongs after the intrinsic shortlist.
 */
export function projectCurrent31ProductionDecisionUniverse(roster: AccountRoster) {
  const ownedAgentIds = roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId)
  const ownedBangbooCount = currentBangbooDirectory.filter(
    (bangboo) => bangboo.releaseState === 'released',
  ).length
  const formationProjection = projectCurrent31ExhaustiveAccountCandidates(ownedAgentIds)
  const authorityFormations = formationProjection.candidates.map((candidate) => {
    const bestBangbooId = resolveCurrent31VariantBangbooRecommendation(candidate.memberIds)
    return {
      ...candidate,
      rank: null,
      wEngineBindings: [],
      bestBangbooId,
      bangbooRecommendationStatus: bestBangbooId
        ? ('selected' as const)
        : ('no_authoritative_recommendation' as const),
      rawDamageLeaderBangbooId: null,
      planningDps: null,
    }
  })
  const decisionIssueClassification = classifyCurrentBangbooDecisionBlockerCounts({})
  const coverage = {
    ownedAgentCount: ownedAgentIds.length,
    ownedBangbooCount,
    scoredBangbooChoiceCount: 0,
    sourceBackedBangbooChoiceCount: new Set<string>(
      authorityFormations
        .map((candidate) => candidate.bestBangbooId)
        .filter((bangbooId) => bangbooId !== null),
    ).size,
    eligibleFormationCount: formationProjection.coverage.eligibleFormationCount,
    mechanicClosedAtBaseCount: formationProjection.coverage.mechanicClosedAtBaseCount,
    limitedButNotPrunedCount: formationProjection.coverage.limitedButNotPrunedCount,
    assetBoundFormationCount: 0,
    formationBangbooCandidateCount:
      formationProjection.coverage.eligibleFormationCount * (ownedBangbooCount + 1),
    scoredFormationBangbooCandidateCount: 0,
    sourceBackedBangbooRecommendationCount: authorityFormations.filter(
      (candidate) => candidate.bestBangbooId !== null,
    ).length,
    unsupportedBangbooCandidateCount: 0,
    bangbooBlockerCounts: {} as Record<string, number>,
    decisionIssueClassification,
    missingAssetFormationCount: formationProjection.coverage.eligibleFormationCount,
    complete: false,
  }
  return {
    contract: 'soda-production-decision-universe/v1' as const,
    rankedFormations: [] as ReturnType<
      typeof scoreCurrent31ExhaustiveAccountCandidates
    >['rankedFormations'],
    authorityFormations,
    coverage,
    fingerprint: stableContentHash({
      universe: formationProjection.fingerprint,
      ownedBangbooCount,
      mode: 'identity_and_intrinsic_rating_only',
    }),
    boundary:
      '生产 Query 只投影完整合法 formation identity 与账户无关 Team Rating；不在线执行 Exhaustive numeric oracle。Team Warehouse Fit 与 Account-bound Benchmark 必须在 shortlist 后按候选专属三人资产域求解。',
  }
}

export function scoreCurrent31ExhaustiveAccountCandidates(input: {
  roster: AccountRoster
  allocation: AccountBuildResult
  discs: readonly DriveDisc[]
  engineRuntimeByCopyId?: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
}) {
  const ownedAgentIds = input.roster.agents
    .filter((agent) => agent.owned)
    .map((agent) => agent.agentId)
  const formationProjection = projectCurrent31ExhaustiveAccountCandidates(ownedAgentIds)
  const alternatives = compileAgentAlternatives(input)
  const bangbooAudits = createBangbooEvaluationAudits(input.roster)
  const scored: Array<{
    candidateId: string
    memberIds: readonly string[]
    mechanicState: string
    limitations: readonly string[]
    wEngineBindings: Array<{
      agentId: string
      wEngineCopyId: string
      wEngineId: string
      finalStatsHash: string
    }>
    bestBangbooId: string | null
    bangbooRecommendationStatus: 'selected' | 'no_authoritative_recommendation'
    rawDamageLeaderBangbooId: string | null
    totalDamage: number
    planningDps: number
    contribution: {
      ownDamage: number
      bangbooDamage: number
      sharedDamage: number
      teamTotalDamage: number
    }
    bangbooBucket: BangbooDamageBucket | null
    noBangbooEvaluationFingerprint: string
    bangbooEvaluationFingerprint: string
    sourceBackedEffectBuckets: SourceBackedPlanningEffectBucket[]
    directEffectBucketCount: number
    outsideDirectEventFormulaBucketCount: number
  }> = []
  const bangbooBlockerCounts: Record<string, number> = Object.create(null)
  let formationBangbooCandidateCount = 0
  let scoredFormationBangbooCandidateCount = 0
  let unsupportedBangbooCandidateCount = 0
  let candidateEvaluationFingerprintWord = FNV_OFFSET
  const supportedBangbooIds = new Set<string>()
  const bangbooEvaluationCache = new Map<
    string,
    { evaluation: ReturnType<typeof evaluateBangbooFixedEvent>; fingerprintWord: number }
  >()
  for (const candidate of formationProjection.candidates) {
    const assignment = bestDistinctAssignment(candidate.memberIds, alternatives)
    const candidateWord = hashWord(candidate.candidateId)
    const composition = projectCurrentBangbooComposition(candidate.memberIds)
    // The no-Bangboo option is itself a real candidate evaluation. It is
    // counted even when account assets cannot bind it, but only successful
    // evaluations contribute to the ranked DPS list.
    formationBangbooCandidateCount += 1
    candidateEvaluationFingerprintWord = absorbFingerprintWord(
      candidateEvaluationFingerprintWord,
      candidateWord,
    )
    candidateEvaluationFingerprintWord = absorbFingerprintWord(
      candidateEvaluationFingerprintWord,
      0,
    )
    if (!assignment) {
      candidateEvaluationFingerprintWord = absorbFingerprintWord(
        candidateEvaluationFingerprintWord,
        1,
      )
      for (const audit of bangbooAudits) {
        formationBangbooCandidateCount += 1
        unsupportedBangbooCandidateCount += 1
        candidateEvaluationFingerprintWord = absorbFingerprintWord(
          absorbFingerprintWord(candidateEvaluationFingerprintWord, candidateWord),
          audit.fingerprintWord,
        )
      }
      continue
    }
    const sourceSelection = compileIncremental32PlanningSourceSelection({
      members: assignment.map((item) => item.runtimeMember),
      eventUsages: assignment.flatMap((item) => item.eventUsages),
    })
    const sourceTeamEquipment = sourceSelection.sourcePackets.length
      ? projectTargetTeamWEngineModifiers({
          memberIds: candidate.memberIds,
          members: assignment.map((item) => item.runtimeMember),
          parameters: {
            wEngines: assignment.map((item) => ({
              agentId: item.agentId,
              engineId: item.wEngineId,
              refinement: item.progression.refinement,
              level: item.progression.engineLevel,
            })),
          },
          runtimeByAgentId: Object.fromEntries(
            assignment.map((item) => {
              const declared = input.engineRuntimeByCopyId?.[item.wEngineCopyId]
              return [
                item.agentId,
                {
                  ...declared,
                  flags: {
                    ...sourceSelection.runtimeByAgentId[item.agentId]?.flags,
                    ...declared?.flags,
                  },
                },
              ]
            }),
          ),
        })
      : null
    const teamDamage = evaluateSourceBackedPlanningTeamDps({
      memberIds: candidate.memberIds,
      members: assignment.map((item) => item.runtimeMember),
      eventUsages: sourceSelection.eventUsages,
      baseline: currentNormalizedPlanningBaseline,
      equipmentModifierBuckets: sourceTeamEquipment
        ? [
            ...assignment.flatMap((item) =>
              item.equipmentModifierBuckets.filter(
                (bucket) => !bucket.effectKey.startsWith('wengine:'),
              ),
            ),
            ...sourceTeamEquipment.directRuntime.buckets,
          ]
        : assignment.flatMap((item) => item.equipmentModifierBuckets),
      baselineReferencesByAgentId: {
        ...sourceSelection.referencesByAgentId,
        ...input.baselineReferencesByAgentId,
      },
      potentialEvents: input.potentialEvents,
    })
    if (
      sourceSelection.status !== 'supported' ||
      (sourceTeamEquipment && sourceTeamEquipment.status !== 'supported') ||
      teamDamage.status === 'unsupported'
    ) {
      candidateEvaluationFingerprintWord = absorbFingerprintWord(
        candidateEvaluationFingerprintWord,
        2,
      )
      for (const audit of bangbooAudits) {
        formationBangbooCandidateCount += 1
        unsupportedBangbooCandidateCount += 1
        candidateEvaluationFingerprintWord = absorbFingerprintWord(
          absorbFingerprintWord(candidateEvaluationFingerprintWord, candidateWord),
          audit.fingerprintWord,
        )
      }
      continue
    }
    const memberDamage = teamDamage.memberDamage.reduce((sum, item) => sum + item.totalDamage, 0)
    const noBangbooContribution = {
      ownDamage: memberDamage,
      bangbooDamage: 0,
      sharedDamage: 0,
      teamTotalDamage: memberDamage,
    }
    const noBangbooEvaluationFingerprint = stableContentHash({
      candidateId: candidate.candidateId,
      memberDamage: teamDamage.memberDamage,
      contribution: noBangbooContribution,
      effectBuckets: teamDamage.effectBuckets,
      bangbooBucket: null,
    })
    scoredFormationBangbooCandidateCount += 1
    candidateEvaluationFingerprintWord = absorbFingerprintWord(
      candidateEvaluationFingerprintWord,
      3,
    )
    let formationBangbooEvaluationFingerprintWord = FNV_OFFSET
    const bangbooDamageById = new Map<string, number | null>(
      bangbooAudits.map((audit) => [audit.bangbooId, null]),
    )
    const bangbooBucketById = new Map<string, BangbooDamageBucket>()
    for (const audit of bangbooAudits) {
      formationBangbooCandidateCount += 1
      const cacheKey = compositionCacheKey(audit, composition)
      let cached = bangbooEvaluationCache.get(cacheKey)
      if (!cached) {
        const evaluation = evaluateBangbooFixedEvent({ audit, composition })
        cached = {
          evaluation,
          fingerprintWord: hashWord(
            evaluation.status === 'supported'
              ? evaluation.evaluationHash
              : stableContentHash({
                  audit: audit.sourceContractHash,
                  composition,
                  blockers: evaluation.blockers,
                }),
          ),
        }
        bangbooEvaluationCache.set(cacheKey, cached)
      }
      const evaluation = cached.evaluation
      const evaluationWord = cached.fingerprintWord
      const pairFingerprintWord = absorbFingerprintWord(
        absorbFingerprintWord(candidateWord, evaluationWord),
        4,
      )
      formationBangbooEvaluationFingerprintWord = absorbFingerprintWord(
        formationBangbooEvaluationFingerprintWord,
        pairFingerprintWord,
      )
      candidateEvaluationFingerprintWord = absorbFingerprintWord(
        candidateEvaluationFingerprintWord,
        pairFingerprintWord,
      )
      if (evaluation.status === 'unsupported') {
        unsupportedBangbooCandidateCount += 1
        for (const blocker of evaluation.blockers)
          bangbooBlockerCounts[blocker] = (bangbooBlockerCounts[blocker] ?? 0) + 1
        continue
      }
      scoredFormationBangbooCandidateCount += 1
      supportedBangbooIds.add(audit.bangbooId)
      bangbooDamageById.set(audit.bangbooId, evaluation.totalDamage)
      bangbooBucketById.set(audit.bangbooId, evaluation.bucket)
    }
    const bangbooRecommendation = selectAuthoritativeBangbooRecommendation({
      memberIds: candidate.memberIds,
      damageCandidates: [...bangbooDamageById].map(([bangbooId, totalDamage]) => ({
        bangbooId,
        totalDamage,
      })),
      agentRules: current31TeamEngineD1Pack.agentRules,
      bangbooRules: current31TeamEngineD1Pack.bangbooRules,
      kernels: current31TeamEngineD1Pack.kernels,
    })
    const bestBangbooId = bangbooRecommendation.bangbooId
    const bestBangbooBucket = bestBangbooId ? (bangbooBucketById.get(bestBangbooId) ?? null) : null
    const bestBangbooDamage = bestBangbooBucket?.totalDamage ?? 0
    const contribution = {
      ownDamage: memberDamage,
      bangbooDamage: bestBangbooDamage,
      sharedDamage: 0,
      teamTotalDamage: memberDamage + bestBangbooDamage,
    }
    scored.push({
      candidateId: candidate.candidateId,
      memberIds: candidate.memberIds,
      mechanicState: candidate.mechanicState,
      limitations: candidate.limitations,
      wEngineBindings: assignment.map((item) => ({
        agentId: item.agentId,
        wEngineCopyId: item.wEngineCopyId,
        wEngineId: item.wEngineId,
        finalStatsHash: item.finalStatsHash,
      })),
      bestBangbooId,
      bangbooRecommendationStatus: bangbooRecommendation.status,
      rawDamageLeaderBangbooId: bangbooRecommendation.rawDamageLeaderId,
      totalDamage: contribution.teamTotalDamage,
      planningDps:
        contribution.teamTotalDamage / currentNormalizedPlanningBaseline.declaredDurationSeconds,
      contribution,
      bangbooBucket: bestBangbooBucket,
      noBangbooEvaluationFingerprint,
      bangbooEvaluationFingerprint: fingerprintFromWord(formationBangbooEvaluationFingerprintWord),
      sourceBackedEffectBuckets: teamDamage.effectBuckets,
      directEffectBucketCount: teamDamage.directEffectBucketCount,
      outsideDirectEventFormulaBucketCount: teamDamage.outsideDirectEventFormulaBucketCount,
    })
  }
  scored.sort(
    (left, right) =>
      right.planningDps - left.planningDps || left.candidateId.localeCompare(right.candidateId),
  )
  const decisionIssueClassification =
    classifyCurrentBangbooDecisionBlockerCounts(bangbooBlockerCounts)
  const scoredByCandidateId = new Map(scored.map((candidate) => [candidate.candidateId, candidate]))
  const rankByCandidateId = new Map(
    scored.map((candidate, index) => [candidate.candidateId, index + 1]),
  )
  return {
    contract: 'soda-exhaustive-account-candidate-score/v1' as const,
    rankedFormations: scored.map((candidate, index) => ({ rank: index + 1, ...candidate })),
    authorityFormations: formationProjection.candidates.map((candidate) => {
      const benchmark = scoredByCandidateId.get(candidate.candidateId)
      const defaultBangbooId = resolveCurrent31VariantBangbooRecommendation(candidate.memberIds)
      return benchmark
        ? { ...benchmark, rank: rankByCandidateId.get(candidate.candidateId)! }
        : {
            ...candidate,
            rank: null,
            wEngineBindings: [],
            bestBangbooId: defaultBangbooId,
            bangbooRecommendationStatus: defaultBangbooId
              ? ('selected' as const)
              : ('no_authoritative_recommendation' as const),
            rawDamageLeaderBangbooId: null,
            planningDps: null,
          }
    }),
    coverage: {
      ownedAgentCount: ownedAgentIds.length,
      ownedBangbooCount: bangbooAudits.length,
      scoredBangbooChoiceCount: supportedBangbooIds.size,
      eligibleFormationCount: formationProjection.coverage.eligibleFormationCount,
      mechanicClosedAtBaseCount: formationProjection.coverage.mechanicClosedAtBaseCount,
      limitedButNotPrunedCount: formationProjection.coverage.limitedButNotPrunedCount,
      assetBoundFormationCount: scored.length,
      formationBangbooCandidateCount,
      scoredFormationBangbooCandidateCount,
      unsupportedBangbooCandidateCount,
      bangbooBlockerCounts,
      decisionIssueClassification,
      missingAssetFormationCount:
        formationProjection.coverage.eligibleFormationCount - scored.length,
      complete:
        scored.length === formationProjection.coverage.eligibleFormationCount &&
        scoredFormationBangbooCandidateCount === formationBangbooCandidateCount,
    },
    fingerprint: stableContentHash({
      scored: scored.map((candidate) => [
        candidate.candidateId,
        candidate.wEngineBindings,
        candidate.bestBangbooId,
        candidate.bangbooRecommendationStatus,
        candidate.rawDamageLeaderBangbooId,
        candidate.planningDps,
        candidate.contribution,
        candidate.bangbooBucket,
        candidate.noBangbooEvaluationFingerprint,
        candidate.bangbooEvaluationFingerprint,
        candidate.sourceBackedEffectBuckets.map((bucket: SourceBackedPlanningEffectBucket) => [
          bucket.effectKey,
          bucket.value,
          bucket.application,
        ]),
      ]),
      candidateEvaluations: fingerprintFromWord(candidateEvaluationFingerprintWord),
    }),
    boundary:
      '当前数值只使用逐代理人 independent projection 与三份互斥音擎，避免 Team Engine 排序污染；成员间驱动盘仍可能复用，因此它只是固定事件 diagnostic，不是候选专属三人+18盘 Warehouse Fit、Account-bound optimum 或正式 DPS。raw damage leader 与玩家推荐严格分离，只有 activation 与 suitability 均来源化成立时才进入推荐。',
  }
}
