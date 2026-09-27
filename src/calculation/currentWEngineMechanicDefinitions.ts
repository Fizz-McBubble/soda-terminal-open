import type {
  MechanicContract,
  MechanicEffect,
  MechanicPredicate,
  MechanicValueExpression,
} from './mechanicIr'

export const currentWEngineMechanicContractIds = Object.freeze([
  'wengine-12001',
  'wengine-12003',
  'wengine-12007',
  'wengine-12008',
  'wengine-12012',
  'wengine-12014',
  'wengine-13002',
  'wengine-13003',
  'wengine-13006',
  'wengine-13007',
  'wengine-13009',
  'wengine-13010',
  'wengine-13013',
  'wengine-13016',
  'wengine-13101',
  'wengine-13111',
  'wengine-13113',
  'wengine-13142',
  'wengine-13144',
  'wengine-14102',
  'wengine-14119',
  'wengine-14159',
] as const)

export type ContractId = (typeof currentWEngineMechanicContractIds)[number]

export const flag = (key: string) => ({ kind: 'flag' as const, key, equals: true })
const param = (index: number) => ({ kind: 'param' as const, index })
const input = (key: string) => ({ kind: 'input' as const, key })
const compareInputToParam = (key: string, index: number) => ({
  kind: 'compare' as const,
  operator: 'gte' as const,
  left: input(key),
  right: param(index),
})
const product = (...values: MechanicValueExpression[]): MechanicValueExpression => ({
  kind: 'product',
  values,
})
const cooldownReady = (firstFlag: string, secondsKey: string, cooldownParamIndex: number) => ({
  kind: 'any' as const,
  predicates: [
    flag(firstFlag),
    {
      kind: 'compare' as const,
      operator: 'gte' as const,
      left: input(secondsKey),
      right: param(cooldownParamIndex),
    },
  ],
})
const activeWithinDuration = (presentFlag: string, ageKey: string, durationParamIndex: number) => ({
  kind: 'all' as const,
  predicates: [
    flag(presentFlag),
    {
      kind: 'compare' as const,
      operator: 'lte' as const,
      left: input(ageKey),
      right: param(durationParamIndex),
    },
  ],
})
const modifier = (
  stat: string,
  value: MechanicValueExpression,
  options: {
    target?: 'own' | 'team' | 'enemy'
    when?: MechanicPredicate
    action?: string
    attribute?: string
  } = {},
): Extract<MechanicEffect, { operator: 'scoped_modifier_apply' }> => ({
  operator: 'scoped_modifier_apply' as const,
  target: options.target ?? ('own' as const),
  stat,
  value,
  ...(options.when ? { when: options.when } : {}),
  ...(options.action ? { action: options.action } : {}),
  ...(options.attribute ? { attribute: options.attribute } : {}),
})

export const rawContracts: Record<ContractId, Omit<MechanicContract, 'sourceRefs'>> = {
  'wengine-12001': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12001',
    effects: [
      modifier('damage_bonus', param(0), { action: 'basic' }),
      modifier('damage_bonus', param(0), { action: 'dash' }),
      modifier('damage_bonus', param(0), { action: 'dodge_counter' }),
    ],
  },
  'wengine-12003': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12003',
    effects: [
      {
        operator: 'resource_and_sustain_apply',
        target: 'own',
        resource: 'energy',
        mode: 'flat',
        value: param(0),
        when: {
          kind: 'all',
          predicates: [
            flag('triggerOccurred'),
            cooldownReady('firstTrigger', 'secondsSincePreviousTrigger', 1),
          ],
        },
      },
    ],
  },
  'wengine-12007': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12007',
    effects: [modifier('daze_increase', param(0), { action: 'ex_special' })],
  },
  'wengine-12008': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12008',
    effects: [modifier('daze_increase', param(0))],
  },
  'wengine-12012': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12012',
    effects: [
      {
        operator: 'resource_and_sustain_apply',
        target: 'own',
        resource: 'energy',
        mode: 'flat',
        value: param(0),
        when: {
          kind: 'all',
          predicates: [
            flag('triggerOccurred'),
            cooldownReady('firstTrigger', 'secondsSincePreviousTrigger', 1),
          ],
        },
      },
    ],
  },
  'wengine-12014': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-12014',
    effects: [
      modifier('outgoing_damage_reduction', param(0), {
        target: 'enemy',
        when: activeWithinDuration('hasAttackerHitAge', 'secondsSinceAttacked', 1),
      }),
    ],
  },
  'wengine-13002': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13002',
    effects: [
      ...(['dodge_counter', 'ex_special', 'assist_attack', 'chain_attack'] as const).map(
        (eventKind, index) =>
          modifier('decibels', param(index), {
            action: eventKind,
            when: {
              kind: 'all',
              predicates: [
                flag(`eventKind:${eventKind}`),
                cooldownReady('firstSameKindTrigger', 'secondsSinceSameKindTrigger', 5),
              ],
            },
          }),
      ),
      {
        operator: 'resource_and_sustain_apply',
        target: 'own',
        resource: 'energy',
        mode: 'flat',
        value: param(4),
        when: cooldownReady('firstSameKindTrigger', 'secondsSinceSameKindTrigger', 5),
      },
    ],
  },
  'wengine-13003': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13003',
    effects: [
      modifier(
        'attack_percent',
        product(param(1), {
          kind: 'accumulator',
          key: 'energyConsumedStacks',
          minimum: 0,
          maximum: 10,
        }),
      ),
    ],
  },
  'wengine-13006': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13006',
    effects: [
      modifier('daze_increase', param(1), { when: compareInputToParam('enemyHpPercent', 0) }),
      modifier('daze_increase', param(3), { when: compareInputToParam('enemyHpPercent', 2) }),
    ],
  },
  'wengine-13007': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13007',
    effects: [
      modifier('hp_percent', param(0)),
      modifier('impact', param(1), { when: flag('equipperHitWindowActive') }),
    ],
  },
  'wengine-13009': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13009',
    effects: [
      modifier('attack_percent', param(0), { when: flag('anomalyPresentOnEnemy') }),
      modifier('damage_bonus', param(1), { when: flag('anomalyPresentOnEnemy') }),
    ],
  },
  'wengine-13010': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13010',
    effects: [
      modifier('hp_percent', param(0)),
      modifier('attack_percent', param(1), { when: flag('wearerShielded') }),
    ],
  },
  'wengine-13013': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13013',
    effects: [
      modifier('attack_percent', product(param(0), { kind: 'constant', value: 0.01 })),
      modifier('damage_bonus', param(1), { action: 'ex_special' }),
    ],
  },
  'wengine-13016': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13016',
    effects: [
      modifier('damage_reduction', param(1), {
        target: 'team',
        when: compareInputToParam('memberHpRatio', 0),
      }),
      modifier('miasma_contamination_reduction', param(2), {
        target: 'team',
        when: compareInputToParam('memberHpRatio', 0),
      }),
    ],
  },
  'wengine-13101': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13101',
    effects: [
      modifier('damage_bonus', param(0), { attribute: 'electric' }),
      modifier('energy_regen', param(1), { when: flag('dodgeCounterOrAssistWindowActive') }),
    ],
  },
  'wengine-13111': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13111',
    effects: [
      modifier('damage_bonus', param(0), {
        when: flag('exSpecialOrChainWindowActive'),
        action: 'basic',
        attribute: 'electric',
      }),
      modifier('damage_bonus', param(0), {
        when: flag('exSpecialOrChainWindowActive'),
        action: 'dash',
        attribute: 'electric',
      }),
    ],
  },
  'wengine-13113': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13113',
    effects: [
      modifier('damage_bonus', param(0), { attribute: 'ice' }),
      modifier(
        'attack_percent',
        {
          kind: 'product',
          values: [
            param(1),
            { kind: 'accumulator', key: 'exSpecialLaunchStacks', minimum: 0, maximum: 4 },
          ],
        },
        { target: 'team' },
      ),
    ],
  },
  'wengine-13142': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13142',
    effects: [
      modifier('damage_bonus', param(0), { action: 'ex_special' }),
      modifier('damage_bonus', param(0), { action: 'ultimate' }),
      {
        operator: 'resource_and_sustain_apply',
        target: 'own',
        resource: 'energy',
        mode: 'flat',
        value: param(1),
        when: {
          kind: 'all',
          predicates: [
            flag('exSpecialOrUltimateHitOccurred'),
            {
              kind: 'any',
              predicates: [
                flag('firstEnergyTrigger'),
                {
                  kind: 'compare',
                  operator: 'gte',
                  left: input('secondsSincePreviousEnergyTrigger'),
                  right: param(2),
                },
              ],
            },
          ],
        },
      },
    ],
  },
  'wengine-13144': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-13144',
    effects: [
      modifier('damage_bonus', param(0), { attribute: 'fire' }),
      modifier('crit_rate', param(1), { when: flag('hpDecreased') }),
    ],
  },
  'wengine-14102': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-14102',
    effects: [
      modifier('damage_bonus', param(0), { attribute: 'physical' }),
      modifier('damage_bonus', param(1), { when: flag('hitFromBehind') }),
    ],
  },
  'wengine-14119': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-14119',
    effects: [
      modifier('damage_bonus', param(0), { attribute: 'ice' }),
      modifier('crit_rate', param(1), { when: flag('basicHitWindowActive') }),
      modifier('crit_rate', param(3), { when: flag('iceDashHitWindowActive') }),
    ],
  },
  'wengine-14159': {
    schema: 'soda-mechanic-contract/v1',
    entityId: 'wengine-14159',
    effects: [
      modifier('crit_damage', param(1), {
        when: activeWithinDuration('hasBasicHeavyHitAge', 'basicHeavyHitAgeSeconds', 2),
      }),
      modifier('crit_damage', param(1), {
        when: activeWithinDuration('hasExSpecialHeavyHitAge', 'exSpecialHeavyHitAgeSeconds', 2),
      }),
      modifier('resistance_ignore', param(6), {
        target: 'enemy',
        attribute: 'ice',
        when: {
          kind: 'all',
          predicates: [
            flag('damageAttributeIce'),
            activeWithinDuration('hasBasicHeavyHitAge', 'basicHeavyHitAgeSeconds', 2),
            activeWithinDuration('hasExSpecialHeavyHitAge', 'exSpecialHeavyHitAgeSeconds', 2),
          ],
        },
      }),
    ],
  },
}
