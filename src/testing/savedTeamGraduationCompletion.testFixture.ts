import type { AccountPlanningDraft } from '../accounts/types'
import { createEmptyRoster } from '../assault/catalog'
import type { AccountRoster } from '../assault/types'
import type { TeamExecution } from '../decision/teamExecutionProjection'
import { teamExecutionContract } from '../decision/teamExecutionProjection'
import type { DriveDisc } from '../domain/schemas'

const fixtureTimestamp = '2026-09-13T00:00:00.000Z'

export function savedGraduationMemberDiscs(
  agentId: string,
  dataVersion = 'graduation-test',
): DriveDisc[] {
  const mainStats: DriveDisc['mainStat'][] = [
    'hp_flat',
    'atk_flat',
    'def_flat',
    'atk_percent',
    'pen_ratio',
    'energy_regen',
  ]
  return mainStats.map((mainStat, index) => ({
    id: `${agentId}-disc-${index + 1}`,
    setId: 'set-swing-jazz',
    slot: (index + 1) as DriveDisc['slot'],
    level: 15,
    rarity: 'S',
    mainStat,
    subStats: [],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
    dataVersion,
  }))
}

export function savedGraduationDiscs(
  memberIds: readonly string[],
  dataVersion = 'graduation-test',
) {
  return memberIds.flatMap((agentId) => savedGraduationMemberDiscs(agentId, dataVersion))
}

export function savedGraduationRoster(
  memberIds: readonly string[],
  options: {
    mindscapeByAgentId?: Readonly<Record<string, number>>
    includeLegacyWEngineFields?: boolean
  } = {},
): AccountRoster {
  const value = createEmptyRoster(fixtureTimestamp)
  value.agents = value.agents.map((agent) =>
    memberIds.includes(agent.agentId)
      ? {
          ...agent,
          owned: true,
          level: 60,
          mindscape: options.mindscapeByAgentId?.[agent.agentId] ?? 0,
          ...(options.includeLegacyWEngineFields ? { wEngine: '街头巨星', refinement: 1 } : {}),
          wEngineDetails: {
            id: 'wengine-13001',
            name: '街头巨星',
            level: 60,
            refinement: 1,
          },
          skillLevels: {
            basic: 1,
            dodge: 1,
            assist: 1,
            special: 1,
            chain: 1,
            core: 7,
          },
        }
      : agent,
  )
  return value
}

export function savedGraduationExecution(
  memberIds: readonly [string, string, string],
  options: {
    candidateId?: string
    scenarioIdentity?: string
    bangbooId?: string
    dataVersion?: string
    includeCurrentOptionalFields?: boolean
  } = {},
): TeamExecution {
  const discs = savedGraduationDiscs(memberIds, options.dataVersion)
  return {
    contract: teamExecutionContract,
    candidateId: options.candidateId ?? `formation:${memberIds.join('+')}`,
    reusePolicy: 'cross_scenario_reuse',
    scenario: { identity: options.scenarioIdentity ?? 'scenario:test', tags: ['test'] },
    memberIds: [...memberIds],
    ...(options.includeCurrentOptionalFields
      ? {
          deploymentOrder: [...memberIds],
          bangbooStar: 1,
          wEngineBindingMode: 'scheme_parameters' as const,
        }
      : {}),
    bangbooId: options.bangbooId ?? 'bangboo-robin',
    members: memberIds.map((agentId) => ({
      agentId,
      current: { wEngineCopyId: null, discIds: [] },
      suggested: {
        wEngine: {
          engineId: 'wengine-13001',
          copyId: null,
          refinement: 1,
          fact: 'scheme_default_recommendation' as const,
        },
        discIds: savedGraduationMemberDiscs(agentId, options.dataVersion).map((disc) => disc.id),
      },
      actions: [{ kind: 'keep_current_build' as const, agentId }],
      impacts: [],
      status: 'ready' as const,
    })),
    physicalDiscIds: discs.map((disc) => disc.id),
    confirmedWEngineCopyIds: [],
    status: 'ready',
    blockers: [],
    sideEffect: 'read_only',
  }
}

export function savedGraduationPlan(
  snapshot: TeamExecution,
  memberIds: readonly string[],
  discs: readonly DriveDisc[],
): AccountPlanningDraft {
  return {
    scopedId: 'account-saved-graduation:saved-graduation',
    accountId: 'account-saved-graduation',
    id: 'saved-graduation',
    kind: 'team',
    name: '叶瞬光·Dialyn·Sunna',
    state: 'saved',
    selection: {
      agentIds: [...memberIds],
      bangbooId: snapshot.bangbooId,
      scenario: snapshot.scenario.identity,
    },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: discs.map((disc) => disc.id),
    teamExecutionSnapshot: snapshot,
    comparisonCapability: 'direction',
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
    revision: 1,
  }
}
