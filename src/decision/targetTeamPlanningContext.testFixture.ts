import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { n4ValidationDisc } from '../testing/n4RecommendationValidationFixture'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import {
  projectTargetTeamAccountBoundBenchmark,
  type TargetTeamEquipmentParameterSelection,
} from './targetTeamAccountBoundBenchmark'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { createTargetTeamAssignmentObjective } from './targetTeamAssignmentObjective'
import { selectTeamObjectiveAssignment } from '../optimizer/selectTeamObjectiveAssignment'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import { searchTeamAssignments, type TeamSearchDomain } from '../optimizer/searchTeamAssignments'

const memberIds = ['agent-billy', 'agent-nicole', 'agent-anby'] as const
const parameters: TargetTeamEquipmentParameterSelection = {
  wEngines: memberIds.map((agentId) => ({
    agentId,
    engineId: 'wengine-12001',
    refinement: 5,
  })),
  bangbooId: 'bangboo-amillion',
  bangbooStars: 5,
}

function fixture() {
  const discs = Array.from({ length: 18 }, (_, index) => n4ValidationDisc(index))
  const roster = createEmptyRoster('2026-09-01T00:00:00.000Z')
  roster.agents = roster.agents.map((agent) =>
    memberIds.includes(agent.agentId as (typeof memberIds)[number])
      ? {
          ...agent,
          owned: true,
          level: 60,
          skillLevels: { ...agent.skillLevels, core: 7 },
          completeness: 'complete' as const,
        }
      : agent,
  )
  const fit = {
    candidateId: 'target-billy-nicole-anby',
    memberIds,
    status: 'ready',
    solverMethod: 'bounded_heuristic',
    exactWithinModel: false,
    gaps: [],
    uniqueDiscCount: 18,
    fingerprint: 'fit-fingerprint',
    loadouts: memberIds.map((agentId, memberIndex) => ({
      agentId,
      discIds: discs.slice(memberIndex * 6, memberIndex * 6 + 6).map((disc) => disc.id),
    })),
  } as unknown as TargetTeamWarehouseFit
  const candidate = {
    candidateId: fit.candidateId,
    memberIds,
    scenarioTags: [],
  } as unknown as TeamEngineCandidate
  const modifierProjection = projectTargetTeamEquipmentModifiers({ memberIds, parameters })
  return {
    warehouse: { accountId: 'target-context-account', account: null, roster, discs },
    candidate,
    fit,
    parameters,
    modifierProjection,
    rosterHash: 'roster-hash',
    warehouseHash: 'warehouse-hash',
    planningHash: 'planning-hash',
    capturedAt: '2026-09-01T00:00:00.000Z',
  }
}

export {
  describe,
  expect,
  it,
  createEmptyRoster,
  projectTargetTeamEquipmentModifiers,
  n4ValidationDisc,
  projectTargetTeamAccountBoundBenchmark,
  compileTargetTeamPlanningContext,
  createTargetTeamAssignmentObjective,
  selectTeamObjectiveAssignment,
  searchTeamAssignments,
  memberIds,
  parameters,
  fixture,
}
export type {
  TeamEngineCandidate,
  TeamBuildExecutionIdentity,
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFit,
  AccountLoadout,
  TeamSearchDomain,
}
