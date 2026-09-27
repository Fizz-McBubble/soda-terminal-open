import { stableContentHash } from '../gameDataPacks/types'
import {
  compilePlanningInteractionContracts,
  planningInteractionOperators,
  type PlanningInteractionContract,
  type PlanningInteractionOperator,
} from './planningInteractionOperators'

type FixtureDefinition = {
  fixtureId: string
  kernelId: string
  memberIds: [string, string, string]
  requiredOperators: PlanningInteractionOperator[]
}

const definitions: FixtureDefinition[] = [
  {
    fixtureId: 'remielle-velina',
    kernelId: 'kernel-3.1-remielle-velina-aria',
    memberIds: ['agent-remielle', 'agent-velina', 'agent-aria'],
    requiredOperators: [
      'timed_event_schedule',
      'team_effect_resolution',
      'off_field_shared_damage',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'yixuan-lucia',
    kernelId: 'kernel-3.1-yixuan-lucia-dialyn',
    memberIds: ['agent-yixuan', 'agent-lucia', 'agent-dialyn'],
    requiredOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'promeia-nangong',
    kernelId: 'kernel-3.1-promeia-nangong-yuzuha',
    memberIds: ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
    requiredOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'off_field_shared_damage',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'pyrois-norma',
    kernelId: 'kernel-3.1-pyrois-norma-sunna',
    memberIds: ['agent-pyrois', 'agent-norma', 'agent-sunna'],
    requiredOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'chain_ultimate_conversion',
      'field_time_opportunity_cost',
    ],
  },
]

function semanticContract(
  fixture: FixtureDefinition,
  operator: PlanningInteractionOperator,
): PlanningInteractionContract {
  const common = {
    contractId: `${fixture.fixtureId}:${operator}`,
    sourceRefs: [
      `current31D1Pack:${fixture.kernelId}`,
      `semantic-fixture:${fixture.fixtureId}:${operator}`,
    ],
    authority: 'semantic_fixture_only' as const,
  }
  if (operator === 'timed_event_schedule')
    return {
      ...common,
      operator,
      durationSeconds: 30,
      events: fixture.memberIds.map((ownerAgentId, index) => ({
        eventKey: `${ownerAgentId}:representative-${index + 1}`,
        ownerAgentId,
        occurrenceCount: 4 - index,
        activeSeconds: 10 - index * 2,
      })),
    }
  if (operator === 'resource_state_transition')
    return {
      ...common,
      operator,
      resourceKey: `${fixture.fixtureId}:fixture-resource`,
      initialValue: 60,
      minimum: 0,
      maximum: 120,
      transitions: [
        {
          atSeconds: 6,
          ownerAgentId: fixture.memberIds[0],
          delta: 20,
          reason: 'semantic fixture generation',
        },
        {
          atSeconds: 12,
          ownerAgentId: fixture.memberIds[0],
          delta: -25,
          reason: 'semantic fixture consumption',
        },
      ],
    }
  if (operator === 'team_effect_resolution')
    return {
      ...common,
      operator,
      effectKey: `${fixture.fixtureId}:fixture-team-effect`,
      ownerAgentId: fixture.memberIds[1],
      recipientAgentIds: fixture.memberIds,
      snapshotPolicy: 'recompute_per_event',
      value: 0.1,
      durationSeconds: 30,
      windows: [{ startSeconds: 5, endSeconds: 17 }],
    }
  if (operator === 'field_time_opportunity_cost')
    return {
      ...common,
      operator,
      durationSeconds: 30,
      transitionSeconds: 3,
      allocations: [
        { agentId: fixture.memberIds[0], activeSeconds: 18 },
        { agentId: fixture.memberIds[1], activeSeconds: 6 },
        { agentId: fixture.memberIds[2], activeSeconds: 3 },
      ],
    }
  if (operator === 'off_field_shared_damage')
    return {
      ...common,
      operator,
      events: [
        {
          eventKey: `${fixture.fixtureId}:off-field-proc`,
          ownerAgentId: fixture.memberIds[0],
          attribution: 'own',
          damagePerOccurrence: 100,
          occurrenceCount: 3,
        },
        {
          eventKey: `${fixture.fixtureId}:shared-proc`,
          ownerAgentId: fixture.memberIds[1],
          attribution: 'shared',
          damagePerOccurrence: 50,
          occurrenceCount: 2,
        },
      ],
    }
  return {
    ...common,
    operator: 'chain_ultimate_conversion',
    initialChainCount: 3,
    initialUltimateCount: 1,
    chainToUltimateCount: 1,
    ultimateToChainCount: 0,
    extraChainCount: 1,
  }
}

export const currentPlanningInteractionFixtures = Object.freeze(
  definitions.map((definition) => {
    const contracts = definition.requiredOperators.map((operator) =>
      semanticContract(definition, operator),
    )
    const compilation = compilePlanningInteractionContracts({
      contracts,
      requiredOperators: definition.requiredOperators,
    })
    if (compilation.status === 'unsupported')
      throw new Error(`Interaction fixture 无法编译：${compilation.blockers.join(' ')}`)
    return {
      ...definition,
      authority: 'semantic_fixture_only' as const,
      contracts,
      fixtureHash: stableContentHash({ definition, contracts }),
    }
  }),
)

const coveredOperators = new Set(
  currentPlanningInteractionFixtures.flatMap((fixture) => fixture.requiredOperators),
)

export const currentPlanningInteractionFixtureAudit = Object.freeze({
  contract: 'soda-current-planning-interaction-fixture-audit/v1',
  implementedOperatorCount: planningInteractionOperators.length,
  coveredOperatorCount: coveredOperators.size,
  representativeFixtureCount: currentPlanningInteractionFixtures.length,
  productionNumericFixtureCount: 0,
  dedicatedAdapterCount: 0,
  completeStructuralCoverage:
    coveredOperators.size === planningInteractionOperators.length &&
    currentPlanningInteractionFixtures.length === 4,
  boundary:
    '四组 fixture 只证明六个共享 operator 能表达时间轴、资源、效果、场上时间、后台/共享伤害与连携转换；其中的 probe 数值不是角色事实，不进入 Production Team DPS。',
})
