import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { AccountRoster } from '../assault/types'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { MultiTeamCoordination } from '../optimizer/multiTeamCoordinator'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import {
  projectSimultaneousTeamExecutionPortfolio,
  projectTargetTeamExecution,
  projectTeamExecutions,
} from './teamExecutionProjection'

const memberIds = ['agent-yixuan', 'agent-pan-yinhu', 'agent-astra'] as const
const engineIds = ['wengine-14137', 'wengine-13142', 'wengine-14131'] as const

function candidate(candidateId = 'candidate-yixuan'): TeamEngineCandidate {
  return {
    candidateId,
    kernelId: 'kernel-3.1-yixuan-pan-astra',
    familyId: 'family-yixuan-rupture',
    label: '仪玄·潘引壶命破支援核心',
    memberIds: [...memberIds],
    bangbooId: 'bangboo-belion',
    bangbooSelection: { status: 'selected', bangbooId: 'bangboo-belion' },
    scenarioTags: ['sheer_damage', 'sustained_boss'],
    classification: 'strong_recommendation',
    strengthTier: 'current_strong_candidate',
    metaBand: 'meta',
    score: 90,
    preferredAgentCount: 0,
    claim: 'fixture',
    failures: [],
    trace: [],
    sourceIds: ['source-team-method'],
  }
}

function allocation(): AccountBuildResult {
  return {
    global: memberIds.map((agentId, agentIndex) => ({
      agentId,
      discs: Array.from({ length: 6 }, (_, slot) => ({
        disc: { id: `disc-${agentIndex}-${slot + 1}` },
      })),
    })),
  } as unknown as AccountBuildResult
}

function roster(source: 'manual_override' | 'manual_initial_default' = 'manual_override') {
  const value = createEmptyRoster()
  value.agents = value.agents.map((agent) => {
    const memberIndex = memberIds.indexOf(agent.agentId as (typeof memberIds)[number])
    return memberIndex < 0
      ? agent
      : {
          ...agent,
          owned: true,
          wEngineCopyId: `copy-${memberIndex}`,
          equippedDiscIds: Array.from(
            { length: 6 },
            (_, slot) => `disc-${memberIndex}-${slot + 1}`,
          ),
        }
  })
  value.bangboos = value.bangboos.map((bangboo) => ({
    ...bangboo,
    owned: bangboo.bangbooId === 'bangboo-belion',
  }))
  value.wEngines = engineIds.map((engineId, index) => ({
    copyId: `copy-${index}`,
    engineId,
    level: 60,
    refinement: index + 1,
    equippedAgentId: memberIds[index]!,
    manualSource: source,
  }))
  return value
}

function input(rosterValue: AccountRoster = roster()) {
  return {
    candidates: [candidate()],
    allocation: allocation(),
    roster: rosterValue,
    drafts: [],
    activePlanIds: {},
  }
}

export {
  describe,
  expect,
  it,
  createEmptyRoster,
  projectSimultaneousTeamExecutionPortfolio,
  projectTargetTeamExecution,
  projectTeamExecutions,
  memberIds,
  engineIds,
  candidate,
  allocation,
  roster,
  input,
}
export type {
  AccountRoster,
  AccountBuildResult,
  MultiTeamCoordination,
  TeamEngineCandidate,
  TeamBuildExecutionIdentity,
}
