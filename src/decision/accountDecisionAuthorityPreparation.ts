import { current31TeamIntrinsicIndexStatus } from './current31TeamIntrinsicIndex'
import type { AccountDecisionAuthorityInput } from './accountDecisionAuthorityInput'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { projectOutputPotentialBands } from './outputPotentialBand'

export const accountDecisionAuthorityContractId = 'soda-account-decision-authority/v1' as const

function hardConstraintBlockers(preference: TeamPortfolioPreference) {
  return preference.templateIds.length
    ? ['当前 exhaustive formation 尚无 templateId crosswalk；具名模板硬约束不能静默忽略。']
    : []
}
export function prepareAccountDecisionAuthority(input: AccountDecisionAuthorityInput) {
  const blockers = hardConstraintBlockers(input.preference)
  if (
    input.validationIntrinsicProjectionMode !== 'direct' &&
    current31TeamIntrinsicIndexStatus.status !== 'ready'
  )
    blockers.push('通用队伍榜单尚未就绪，请更新资料后重试。')
  if (input.rankedFormations.length === 0) {
    const empty = {
      contract: accountDecisionAuthorityContractId,
      status: 'empty' as const,
      blockers: ['当前账户没有可进入 Team Rating 的完整三人 formation。'],
      outputPotentialCohort: null,
      recommendations: [],
      consumerRecommendations: [],
      agentRecommendations: [],
      coverage: {
        inputFormationCount: 0,
        ratedFormationCount: 0,
        hardInvalidFormationCount: 0,
        requiredPortfolioTeamCount: input.preference.teamCount,
        requiredPortfolioCandidateCount: 0,
      },
    }
    return { earlyResult: { ...empty, fingerprint: stableContentHash(empty) }, cohort: null }
  }
  const benchmarkCandidates = input.rankedFormations.flatMap((candidate) =>
    candidate.planningDps === null
      ? []
      : [{ candidateId: candidate.candidateId, output: candidate.planningDps }],
  )
  const cohort = benchmarkCandidates.length
    ? projectOutputPotentialBands({
        gameVersion: currentVersionProjection.gameVersion,
        baselineId: currentNormalizedPlanningBaseline.baselineId,
        cohortId: `account:${input.allocation.inputHash}:owned-formations`,
        candidates: benchmarkCandidates,
      })
    : null
  if (blockers.length)
    return {
      earlyResult: {
        contract: accountDecisionAuthorityContractId,
        status: 'blocked' as const,
        blockers,
        outputPotentialCohort: cohort,
        recommendations: [],
        consumerRecommendations: [],
        agentRecommendations: [],
        coverage: {
          inputFormationCount: input.rankedFormations.length,
          ratedFormationCount: 0,
          hardInvalidFormationCount: 0,
          requiredPortfolioTeamCount: input.preference.teamCount,
          requiredPortfolioCandidateCount: 0,
        },
        fingerprint: stableContentHash({ blockers, cohort: cohort?.fingerprint ?? null }),
      },
      cohort: cohort,
    }
  return { earlyResult: null, cohort }
}
