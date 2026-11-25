import { resolveReviewedPhoenixTeam33 } from './reviewedPhoenixTeams33'
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
import {
  lookupCurrent31TeamIntrinsicSummary,
  lookupCurrent31TeamIntrinsicDetails,
} from './current31TeamIntrinsicIndex'
import { selectSavedDefaultTeamAdmissionPlay } from './defaultTeamAdmissionPlay'
import { readSharedPreparedBoxFormationRanking } from './preparedBoxFormationRanking'
import {
  lookupCurrentGenericTeamRanking as lookupCurrentTeamSystemRanking,
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRankingForPlay,
} from './teamGenericRanking'
import { projectGenericTeamRating } from './teamGenericRankingMethod'

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
  if (!summary) return null
  if (summary.ratingStatus !== 'rated')
    return {
      summary,
      rating: {
        contract: teamDecisionAuthorityContractId,
        status: summary.ratingStatus,
        candidateId,
        featureFingerprint: `intrinsic-index:${summary.indexContentHash}`,
        blockerIds: ['offline-formation-ineligible'],
        explanation: '该组合尚未满足榜单的有效队伍条件。',
      } satisfies TeamRatingResult,
    }
  if (!summary.ratingBand || !summary.confidence) return null
  return {
    summary,
    rating: {
      contract: teamDecisionAuthorityContractId,
      status: 'rated' as const,
      candidateId,
      featureFingerprint: `intrinsic-index:${summary.indexContentHash}:${memberIds.join('|')}`,
      ratingBand: summary.ratingBand,
      confidence: summary.confidence,
      explanation: '由当前版本构建期精确三人内在评级索引投影；完整依据从同版本离线榜单读取。',
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
  if (currentGenericTeamRankingStatus.status !== 'ready')
    throw new Current31TeamIntrinsicIndexMismatchError('通用队伍榜单尚未就绪，请更新资料后重试。')
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
  const ownedAgentIds = new Set(
    input.roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId),
  )
  const ownershipEvidence = {
    evidenceId: `account-ownership:${stableContentHash([...ownedAgentIds].sort())}`,
    provenance: 'source_fact' as const,
    reference: 'account-roster-owned-agents',
    explanation: '玩家当前档案中明确已拥有的代理人。',
    contentHash: stableContentHash([...ownedAgentIds].sort()),
  }
  const ratingByEquivalenceKey = new Map<string, TeamRatingResult>()
  return input.rankedFormations.map((candidate) => {
    const memberIds = exactMemberIds(candidate)
    // The intrinsic cohort is ranked by the artifact's bound default play.
    // The selected play is checked again when the recommendation is projected.
    let systemRanking =
      input.mode === 'indexed'
        ? readSharedPreparedBoxFormationRanking(memberIds, currentGenericTeamRankingStatus.contentHash)
        : undefined
    if (systemRanking === undefined) {
      const direction = lookupCurrent31TeamIntrinsicDetails(
        memberIds,
        candidate.candidateId,
      )?.mechanismDirection
      const defaultPlay =
        direction &&
        selectSavedDefaultTeamAdmissionPlay(
          memberIds,
          direction,
          currentGenericTeamRankingStatus.contentHash,
        )
      systemRanking =
        (defaultPlay && lookupCurrentGenericTeamRankingForPlay(memberIds, defaultPlay)) ||
        lookupCurrentTeamSystemRanking(memberIds)
    }
    const output = outputById.get(candidate.candidateId)
    const hardPrunes = [
      ...memberIds
        .filter((agentId) => !ownedAgentIds.has(agentId))
        .map((agentId) => ({
          reason: 'not_available_in_selected_scope' as const,
          subjectId: agentId,
          explanation: '候选包含当前档案未拥有的代理人。',
          evidenceRefs: [ownershipEvidence.evidenceId],
        })),
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
        rating: projectGenericTeamRating(indexed.rating, systemRanking),
        mainstreamRecognition: { status: summary?.mainstreamStatus ?? 'unknown' },
        inferredStrength: summary?.metaAuthority === 'model_inference',
        recommendationScore: summary?.recommendationScore ?? null,
        mechanicallyClosed: summary?.mechanicallyClosed ?? false,
        hasPreliminaryDirection: summary?.hasPreliminaryDirection ?? false,
        systemRanking,
        account: deriveAccountBands(candidate, accountContext),
      }
    }
    if (input.mode === 'indexed')
      throw new Current31TeamIntrinsicIndexMismatchError('通用队伍榜单尚未就绪，请更新资料后重试。')
    const mechanicState = inspectCurrent31FormationMechanicState(memberIds)
    const mechanicallyClosed =
      mechanicState.ruleComplete &&
      mechanicState.activationAtBase &&
      mechanicState.resourceLoopClosed &&
      mechanicState.fieldTimeWithinBudget
    if (hardPrunes.length === 0 && resolveReviewedPhoenixTeam33(memberIds)) {
      // The direct oracle must use the same bounded local reference as the serialized index.
      // Keep player hard prunes and absent executable mechanics independent of that reference.
      const direct = evaluateCurrent31TeamRating({
        candidateId: candidate.candidateId,
        memberIds,
        bangbooId: candidate.bestBangbooId,
        outputPotentialBand: 'unknown',
        benchmark: intrinsicRatingBenchmark,
        hardPrunes,
        reviewedOnly: true,
      })
      return {
        candidate,
        memberIds,
        output: output ?? null,
        benchmark: accountBoundBenchmark,
        rating: projectGenericTeamRating(direct.rating, systemRanking),
        mainstreamRecognition: direct.mainstreamRecognition,
        inferredStrength: direct.metaCalibration.authority === 'model_inference',
        recommendationScore: direct.metaCalibration.recommendationScore ?? null,
        mechanicallyClosed,
        hasPreliminaryDirection: direct.metaCalibration.authority === 'recovered_preliminary',
        systemRanking,
        account: deriveAccountBands(candidate, accountContext),
      }
    }
    const signals = projectAgentRulesToTeamFeatureSignals({
      candidateId: candidate.candidateId,
      memberIds,
      bangbooId: candidate.bestBangbooId,
      agentRules: current31TeamEngineD1Pack.agentRules,
      mechanicState,
      outputPotentialBand: 'unknown',
      benchmark: intrinsicRatingBenchmark,
      hardPrunes,
      additionalEvidence: [preferenceEvidence, ownershipEvidence],
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
      // Match the index producer. Optional diagnostics are exposed later by
      // the recommendation projection, not consumed by these intrinsic fields.
      reviewedOnly: true,
    })
    return {
      candidate,
      memberIds,
      output: output ?? null,
      benchmark: accountBoundBenchmark,
      rating: projectGenericTeamRating(strengthProjection.teamStrength, systemRanking),
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
      systemRanking,
      account: deriveAccountBands(candidate, accountContext),
    }
  })
}
