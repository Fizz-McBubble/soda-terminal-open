import type { AccountRoster } from '../assault/types'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { inspectCurrent31FormationMechanicState } from '../teamEngine/current31FormationMechanicAudit'
import { stableContentHash } from '../gameDataPacks/types'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { projectCurrent31TeamStrength } from './current31TeamStrengthCalibration'
import type { TeamRatingResult } from './teamDecisionAuthority'
import { teamDecisionAuthorityContractId } from './teamDecisionAuthority'
import {
  evaluateTeamRating,
  extractTeamFeatureVector,
  projectAgentRulesToTeamFeatureSignals,
} from './teamRatingEvaluator'
import {
  createAccountBandContext,
  deriveAccountBands,
  type RankedFormation,
} from './accountDecisionBands'
import { exactMemberIds } from './accountDecisionOrdering'
import type { projectOutputPotentialBands } from './outputPotentialBand'
import { lookupCurrent31TeamIntrinsicSummary } from './current31TeamIntrinsicIndex'

export const intrinsicRatingBenchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation:
    'Team Rating 当前只使用与账户仓库无关的机制证据；固定事件 numeric diagnostic 单独展示，不进入内在评级。',
}

export class Current31TeamIntrinsicIndexMismatchError extends Error {
  override name = 'Current31TeamIntrinsicIndexMismatchError'
}

type Cohort = ReturnType<typeof projectOutputPotentialBands> | null

function indexedRating(
  candidateId: string,
  memberIds: readonly [string, string, string],
  hardPruneReasons: readonly string[],
) {
  const summary = lookupCurrent31TeamIntrinsicSummary(memberIds)
  if (hardPruneReasons.length)
    return {
      summary,
      rating: {
        contract: teamDecisionAuthorityContractId,
        status: 'hard_invalid' as const,
        candidateId,
        featureFingerprint: `indexed-prune:${stableContentHash({ memberIds, hardPruneReasons })}`,
        blockerIds: [...hardPruneReasons],
        explanation: '候选未满足玩家当前固定成员或邦布约束。',
      } satisfies TeamRatingResult,
    }
  if (!summary || summary.ratingStatus !== 'rated' || !summary.ratingBand || !summary.confidence)
    return null
  return {
    summary,
    rating: {
      contract: teamDecisionAuthorityContractId,
      status: 'rated' as const,
      candidateId,
      featureFingerprint: `intrinsic-index:${summary.indexContentHash}:${memberIds.join('|')}`,
      ratingBand: summary.ratingBand,
      confidence: summary.confidence,
      explanation: '由当前版本构建期精确三人内在评级索引投影；完整依据在消费短名单按原算法恢复。',
      tradeoffs: [],
    } satisfies TeamRatingResult,
  }
}

export function assertIntrinsicSummaryMatchesCurrentRating(
  memberIds: readonly [string, string, string],
  current: ReturnType<typeof evaluateCurrent31TeamRating>,
) {
  const summary = lookupCurrent31TeamIntrinsicSummary(memberIds)
  if (!summary) return
  const actual = {
    ratingStatus: current.rating.status,
    ratingBand: current.rating.status === 'rated' ? current.rating.ratingBand : null,
    confidence: current.rating.status === 'rated' ? current.rating.confidence : null,
    recommendationScore: current.metaCalibration.recommendationScore ?? null,
    mechanicValidity: current.mechanicValidity,
    mainstreamStatus: current.mainstreamRecognition.status,
    metaAuthority: current.metaCalibration.authority,
  }
  const expected = {
    ratingStatus: summary.ratingStatus,
    ratingBand: summary.ratingBand,
    confidence: summary.confidence,
    recommendationScore: summary.recommendationScore,
    mechanicValidity: summary.mechanicValidity,
    mainstreamStatus: summary.mainstreamStatus,
    metaAuthority: summary.metaAuthority,
  }
  if (stableContentHash(actual) !== stableContentHash(expected))
    throw new Current31TeamIntrinsicIndexMismatchError(
      `构建期三人评级索引与当前算法不一致：${memberIds.join('|')}。`,
    )
}

export function projectAccountIntrinsicCandidates(input: {
  rankedFormations: readonly RankedFormation[]
  roster: AccountRoster
  allocation: AccountBuildResult
  preference: TeamPortfolioPreference
  cohort: Cohort
  mode: 'indexed' | 'direct'
}) {
  const outputById = new Map(
    (input.cohort?.candidates ?? []).map((candidate) => [candidate.candidateId, candidate]),
  )
  const preferenceEvidence = {
    evidenceId: `account-preference:${stableContentHash(input.preference)}`,
    provenance: 'source_fact' as const,
    reference: 'account-team-portfolio-preference',
    explanation: '玩家当前 BOX 硬约束与队伍数量偏好。',
    contentHash: stableContentHash(input.preference),
  }
  const accountContext = createAccountBandContext(input.roster, input.allocation)
  const ratingByEquivalenceKey = new Map<string, TeamRatingResult>()
  return input.rankedFormations.map((candidate) => {
    const memberIds = exactMemberIds(candidate)
    const output = outputById.get(candidate.candidateId)
    const hardPrunes = [
      ...(input.preference.fixedAgentIds.every((agentId) => memberIds.includes(agentId))
        ? []
        : [
            {
              reason: 'not_available_in_selected_scope' as const,
              subjectId: candidate.candidateId,
              explanation: '候选未满足玩家固定成员约束。',
              evidenceRefs: [preferenceEvidence.evidenceId],
            },
          ]),
      ...(input.preference.fixedBangbooIds.length === 0 ||
      (candidate.bestBangbooId !== null &&
        input.preference.fixedBangbooIds.includes(candidate.bestBangbooId))
        ? []
        : [
            {
              reason: 'not_available_in_selected_scope' as const,
              subjectId: candidate.candidateId,
              explanation: '候选未满足玩家固定邦布约束。',
              evidenceRefs: [preferenceEvidence.evidenceId],
            },
          ]),
    ]
    const accountBoundBenchmark = output
      ? {
          status: 'complete' as const,
          baselineId: input.cohort!.baselineId,
          outputIndex: output.outputIndex,
          unsupportedIssueIds: [],
          explanation:
            '当前账户 roster 的 independent projection cohort 中同 baseline 固定事件诊断。',
        }
      : {
          status: 'unavailable' as const,
          baselineId: null,
          outputIndex: null,
          unsupportedIssueIds: [],
          explanation:
            '当前 formation 缺少完整账户资产绑定 Benchmark；Team Rating 保留并降低置信度。',
        }
    const indexed =
      input.mode === 'indexed'
        ? indexedRating(
            candidate.candidateId,
            memberIds,
            hardPrunes.map((prune) => prune.reason),
          )
        : null
    if (indexed) {
      const summary = indexed.summary
      return {
        candidate,
        memberIds,
        output: output ?? null,
        benchmark: accountBoundBenchmark,
        rating: indexed.rating,
        mainstreamRecognition: { status: summary?.mainstreamStatus ?? 'unknown' },
        inferredStrength: summary?.metaAuthority === 'model_inference',
        recommendationScore: summary?.recommendationScore ?? null,
        mechanicallyClosed: summary?.mechanicallyClosed ?? false,
        hasPreliminaryDirection: summary?.hasPreliminaryDirection ?? false,
        account: deriveAccountBands(candidate, accountContext),
      }
    }
    const mechanicState = inspectCurrent31FormationMechanicState(memberIds)
    const signals = projectAgentRulesToTeamFeatureSignals({
      candidateId: candidate.candidateId,
      memberIds,
      bangbooId: candidate.bestBangbooId,
      agentRules: current31TeamEngineD1Pack.agentRules,
      mechanicState,
      outputPotentialBand: 'unknown',
      benchmark: intrinsicRatingBenchmark,
      hardPrunes,
      additionalEvidence: [preferenceEvidence],
    })
    const equivalenceKey = JSON.stringify([
      signals.rulesComplete,
      signals.fieldTimeWithinBudget,
      signals.resourceLoopClosed,
      signals.activationAtBase,
      signals.observedPartnerRelationCount,
      signals.effectRecipientCounts,
      signals.distinctSpecialtyCount,
      signals.distinctAttributeCount,
      signals.outputPotentialBand,
      hardPrunes.map((prune) => prune.reason),
    ])
    const featureVector = extractTeamFeatureVector(signals)
    let mechanicRating = ratingByEquivalenceKey.get(equivalenceKey)
    if (!mechanicRating) {
      mechanicRating = evaluateTeamRating(featureVector)
      ratingByEquivalenceKey.set(equivalenceKey, mechanicRating)
    } else {
      mechanicRating = {
        ...mechanicRating,
        candidateId: candidate.candidateId,
        featureFingerprint: `equivalent:${equivalenceKey}`,
      }
    }
    const strengthProjection = projectCurrent31TeamStrength({
      memberIds,
      bangbooId: candidate.bestBangbooId,
      mechanicRating,
      featureVector,
      benchmark: intrinsicRatingBenchmark,
    })
    return {
      candidate,
      memberIds,
      output: output ?? null,
      benchmark: accountBoundBenchmark,
      rating: strengthProjection.teamStrength,
      mainstreamRecognition: strengthProjection.mainstreamRecognition,
      inferredStrength: strengthProjection.metaCalibration.authority === 'model_inference',
      recommendationScore: strengthProjection.metaCalibration.recommendationScore ?? null,
      mechanicallyClosed:
        mechanicState.ruleComplete &&
        mechanicState.activationAtBase &&
        mechanicState.resourceLoopClosed &&
        mechanicState.fieldTimeWithinBudget,
      hasPreliminaryDirection:
        strengthProjection.metaCalibration.authority === 'recovered_preliminary',
      account: deriveAccountBands(candidate, accountContext),
    }
  })
}
