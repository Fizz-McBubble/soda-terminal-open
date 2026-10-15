import { describe, expect, it } from 'vitest'
import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import { buildTeamLoadoutOverviewModel, unselectedBangbooReason } from './teamLoadoutOverviewModel'
import { teamRecommendationFamilyKey } from './teamLoadoutDecisionViewModel'

it('groups documented core replacements independently of member order and scenario while separating other cores', () => {
  const candidate = (memberIds: [string, string, string], scenario: string) =>
    ({
      memberIds,
      candidateId: memberIds.join('+'),
      scenarioTags: [scenario],
    }) as Parameters<typeof teamRecommendationFamilyKey>[0]
  const first = candidate(['agent-aria', 'agent-remielle', 'agent-velina'], 'first')
  const replacement = candidate(['agent-remielle', 'agent-piper', 'agent-velina'], 'second')
  const reordered = candidate(['agent-velina', 'agent-aria', 'agent-remielle'], 'third')
  expect(teamRecommendationFamilyKey(first)).toBe(teamRecommendationFamilyKey(replacement))
  expect(teamRecommendationFamilyKey(first)).toBe(teamRecommendationFamilyKey(reordered))
  expect(teamRecommendationFamilyKey(first)).not.toBe(
    teamRecommendationFamilyKey(
      candidate(['agent-promeia', 'agent-velina', 'agent-yuzuha'], 'first'),
    ),
  )
})

it('distinguishes missing activation evidence, no match and an unbound player choice', () => {
  expect(unselectedBangbooReason({ status: 'activation_unknown', bangbooIds: [] })).toContain(
    '邦布加成条件的资料不全',
  )
  expect(unselectedBangbooReason({ status: 'no_activation_match', bangbooIds: [] })).toContain(
    '没找到满足本队加成条件',
  )
  const playerChoice = unselectedBangbooReason({
    status: 'no_authoritative_recommendation',
    bangbooIds: ['one', 'two'],
  })
  expect(playerChoice).toContain('进入配装后选择')
  expect(playerChoice).not.toMatch(/不足|未补齐/)
  expect(unselectedBangbooReason({ status: 'not_evaluated', reason: '核心成员尚未齐全。' })).toBe(
    '核心成员尚未齐全。',
  )
})

function decisionWithResultLayers(): AccountDecisionSnapshot {
  const executable = [
    { candidateId: 'team-first', score: 70 },
    { candidateId: 'team-second', score: 90 },
    { candidateId: 'team-third', score: 80 },
    { candidateId: 'team-fourth', score: 100 },
    { candidateId: 'team-fifth', score: 60 },
  ]
  const readyRecommendations = executable.map(({ candidateId, score }, teamIndex) => ({
    candidateId,
    kernelId: `kernel-${candidateId}`,
    label: `可执行队伍 ${candidateId}`,
    memberIds: [0, 1, 2].map((memberIndex) => `agent-${teamIndex}-${memberIndex}`) as [
      string,
      string,
      string,
    ],
    bangbooId: `bangboo-${teamIndex}`,
    scenarioTags: [`scenario-${teamIndex}`],
    classification: 'stable_usable' as const,
    strengthTier: 'current_strong_candidate' as const,
    metaBand: 'meta' as const,
    score,
    preferredAgentCount: 0,
    claim: `现有 Team Engine authority order；raw score ${score}`,
    failures: [],
    trace: [
      {
        stage: 'pair_synergy' as const,
        status: 'pass' as const,
        detail: `可执行机制 ${teamIndex}`,
      },
    ],
    sourceIds: [`source-${teamIndex}`],
  }))
  const recommendations = [
    readyRecommendations[0]!,
    {
      candidateId: 'team-progress',
      kernelId: 'kernel-team-progress',
      label: '待推进队伍',
      memberIds: ['agent-progress-0', 'agent-progress-1', 'agent-progress-2'] as [
        string,
        string,
        string,
      ],
      bangbooId: 'bangboo-progress',
      scenarioTags: ['scenario-progress'],
      classification: 'stable_usable' as const,
      strengthTier: 'current_strong_candidate' as const,
      metaBand: 'apex' as const,
      score: 100,
      preferredAgentCount: 0,
      claim: '当前高顺位但仍需建设',
      failures: [],
      trace: [
        {
          stage: 'pair_synergy' as const,
          status: 'pass' as const,
          detail: '待推进机制',
        },
      ],
      sourceIds: ['source-progress'],
    },
    ...readyRecommendations.slice(1),
    {
      candidateId: 'team-direction',
      kernelId: 'kernel-team-direction',
      label: '方向队伍',
      memberIds: ['agent-direction-0', 'agent-direction-1', 'agent-direction-2'] as [
        string,
        string,
        string,
      ],
      bangbooId: null,
      scenarioTags: [],
      classification: 'transitional' as const,
      strengthTier: 'current_viable_candidate' as const,
      metaBand: 'viable' as const,
      score: 50,
      preferredAgentCount: 0,
      claim: '当前只形成方向',
      failures: [],
      trace: [],
      sourceIds: ['source-direction'],
    },
  ]
  const agentIds = executable.flatMap((_, teamIndex) =>
    [0, 1, 2].map((memberIndex) => `agent-${teamIndex}-${memberIndex}`),
  )
  const allocation = agentIds.map((agentId, agentIndex) => ({
    agentId,
    discs: Array.from({ length: 6 }, (_, discIndex) => ({
      disc: { id: `disc-${agentIndex}-${discIndex}` },
    })),
  }))
  const coordinationTeams = recommendations.map((recommendation) => ({
    template: { templateId: recommendation.candidateId },
    gaps: [],
  }))
  const teamExecutions = recommendations.map((recommendation) => ({
    candidateId: recommendation.candidateId,
    status:
      recommendation.bangbooId && recommendation.candidateId !== 'team-progress'
        ? ('ready' as const)
        : ('missing_equipment' as const),
    members: recommendation.memberIds.map((agentId) => ({
      agentId,
      suggested: {
        discIds:
          allocation
            .find((loadout) => loadout.agentId === agentId)
            ?.discs.map((choice) => choice.disc.id) ?? [],
      },
      actions:
        recommendation.candidateId === 'team-progress'
          ? [
              {
                kind: 'missing_equipment' as const,
                agentId,
                equipment: 'drive_disc' as const,
                reason: `${agentId} 仍缺六张实体盘`,
              },
            ]
          : recommendation.bangbooId
            ? [{ kind: 'keep_current_build' as const, agentId }]
            : [],
      impacts: [],
    })),
    blockers:
      recommendation.candidateId === 'team-progress'
        ? ['待推进队伍仍缺实体盘']
        : recommendation.bangbooId
          ? []
          : ['邦布未闭合'],
  }))

  return {
    teamEngine: { recommendations },
    decisionAuthority: {
      status: 'ready',
      blockers: [],
      recommendations: recommendations.map((recommendation, index) => ({
        candidateId: recommendation.candidateId,
        memberIds: recommendation.memberIds,
        bangbooId: recommendation.bangbooId,
        benchmarkOutput: 10_000 - index * 1_000,
        outputPotential: { band: index < 2 ? 'excellent' : 'good' },
        teamRating: {
          status: 'rated',
          ratingBand: index < 2 ? 'S' : 'A+',
          confidence: 'high',
        },
        cultivationPriority: {
          tier: recommendation.candidateId === 'team-progress' ? 'short_upgrade' : 'ready_now',
          reasons: [`权威顺位 ${index + 1}`],
          tradeoffs: [],
          nextAction: '进入单队配装。',
        },
      })),
      coverage: {
        inputFormationCount: recommendations.length,
        ratedFormationCount: recommendations.length,
        hardInvalidFormationCount: 0,
        requiredPortfolioTeamCount: 1,
        requiredPortfolioCandidateCount: 1,
      },
    },
    teamExecutions,
    allocation: { global: allocation, diagnostics: [] },
    coordination: { teams: coordinationTeams },
    hardConstraints: { active: [], canRestoreDefault: false },
    portfolioInput: {
      preferredAgentIds: [],
      activePlansByAgent: Object.fromEntries(
        allocation.map((loadout) => [
          loadout.agentId,
          { planId: null, discIds: loadout.discs.map((choice) => choice.disc.id) },
        ]),
      ),
      preference: {
        teamCount: 1,
        templateIds: [],
        favoriteAgentIds: [],
        fixedAgentIds: [],
        fixedBangbooIds: [],
        planIdsByAgent: {},
      },
    },
    claims: {
      overall: {
        status: 'candidate',
        summary: '当前 BOX 已形成可执行队伍。',
        blockers: [],
        forbids: ['不代表 Formal'],
      },
      teamEngine: { blockers: [], forbids: ['不代表 Formal'] },
      coordination: { blockers: [] },
    },
    fingerprint: { inputHash: 'same-analysis-run-fingerprint' },
  } as unknown as AccountDecisionSnapshot
}

export {
  describe,
  expect,
  it,
  buildTeamLoadoutOverviewModel,
  unselectedBangbooReason,
  teamRecommendationFamilyKey,
  decisionWithResultLayers,
}
export type { AccountPlanningDraft, AccountDecisionSnapshot, TeamEngineCandidate }
