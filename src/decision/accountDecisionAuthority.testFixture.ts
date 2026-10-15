import { describe, expect, it, vi } from 'vitest'

import { createEmptyRoster } from '../assault/catalog'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import {
  projectAccountDecisionAuthority,
  refineCultivationPriorityWithTargetFit,
} from './accountDecisionAuthority'
import { resolveCurrent31VariantBangbooRecommendation } from './current31VariantBangbooRecommendation'
import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import {
  resolveCurrent31LegacyCalibrationDiagnostic,
  resolveCurrent31MainstreamRecognition,
} from './current31TeamStrengthCalibration'

const memberIds = ['agent-yixuan', 'agent-lucia', 'agent-dialyn'] as const

type RankedFormation = Parameters<
  typeof projectAccountDecisionAuthority
>[0]['rankedFormations'][number]

function formation(
  candidateId = `formation:${memberIds.join('+')}`,
  planningDps: number | null = 100,
  members: readonly [string, string, string] = memberIds,
  bangbooId: ReturnType<typeof resolveCurrent31VariantBangbooRecommendation> = null,
): RankedFormation {
  if (planningDps === null)
    return {
      rank: null,
      candidateId,
      memberIds: members,
      mechanicState: 'closed_at_base',
      limitations: [],
      wEngineBindings: [],
      bestBangbooId: bangbooId,
      bangbooRecommendationStatus: bangbooId ? 'selected' : 'no_authoritative_recommendation',
      rawDamageLeaderBangbooId: null,
      planningDps: null,
    }
  return {
    rank: 1,
    candidateId,
    memberIds: members,
    mechanicState: 'closed_at_base',
    limitations: [],
    wEngineBindings: members.map((agentId, index) => ({
      agentId,
      wEngineCopyId: `copy-${index}`,
      wEngineId: `engine-${index}`,
      finalStatsHash: `stats-${index}`,
    })),
    bestBangbooId: bangbooId,
    bangbooRecommendationStatus: bangbooId ? 'selected' : 'no_authoritative_recommendation',
    rawDamageLeaderBangbooId: null,
    totalDamage: 3_000,
    planningDps,
    contribution: {
      ownDamage: 3_000,
      bangbooDamage: 0,
      sharedDamage: 0,
      teamTotalDamage: 3_000,
    },
    bangbooBucket: null,
    noBangbooEvaluationFingerprint: 'fnv1a-no-bangboo',
    bangbooEvaluationFingerprint: 'fnv1a-bangboo',
    sourceBackedEffectBuckets: [],
    directEffectBucketCount: 0,
    outsideDirectEventFormulaBucketCount: 0,
  }
}

function fixture(ownedMemberIds: readonly string[] = memberIds) {
  const roster = createEmptyRoster('2026-08-31T00:00:00.000Z')
  roster.agents = roster.agents.map((agent) =>
    ownedMemberIds.includes(agent.agentId)
      ? {
          ...agent,
          owned: true,
          level: 60,
          skillLevels: {
            basic: 12,
            dodge: 12,
            assist: 12,
            special: 12,
            chain: 12,
            core: 7,
          },
        }
      : agent,
  )
  const loadouts = ownedMemberIds.map((agentId) => ({
    agentId,
    discs: Array.from({ length: 6 }, (_, index) => ({ disc: { id: `${agentId}:${index}` } })),
  }))
  const allocation = {
    global: loadouts,
    independent: loadouts,
    inputHash: 'allocation-fixture',
  } as unknown as AccountBuildResult
  return { roster, allocation }
}

export {
  describe,
  expect,
  it,
  vi,
  createEmptyRoster,
  defaultTeamPortfolioPreference,
  projectAccountDecisionAuthority,
  refineCultivationPriorityWithTargetFit,
  resolveCurrent31VariantBangbooRecommendation,
  current31IndependentConsensusGoldSet,
  resolveCurrent31LegacyCalibrationDiagnostic,
  resolveCurrent31MainstreamRecognition,
  memberIds,
  formation,
  fixture,
}
export type { AccountBuildResult, RankedFormation }
