const lighterQualifiedDamageIr = {
  kind: 'call',
  operator: 'prod',
  arguments: [
    {
      kind: 'call',
      operator: 'min',
      arguments: [
        { kind: 'reference', path: 'dm.ability.max_ice_fire_dmg_' },
        {
          kind: 'call',
          operator: 'prod',
          arguments: [
            { kind: 'reference', path: 'elation' },
            {
              kind: 'call',
              operator: 'sum',
              arguments: [
                { kind: 'reference', path: 'dm.ability.ice_fire_dmg_' },
                {
                  kind: 'call',
                  operator: 'prod',
                  arguments: [
                    {
                      kind: 'call',
                      operator: 'max',
                      arguments: [
                        { kind: 'literal', value: 0 },
                        {
                          kind: 'call',
                          operator: 'sum',
                          arguments: [
                            { kind: 'reference', path: 'own.final.impact' },
                            {
                              kind: 'call',
                              operator: 'negate',
                              arguments: [
                                { kind: 'reference', path: 'dm.ability.impact_threshold' },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      kind: 'call',
                      operator: 'binary:/',
                      arguments: [
                        { kind: 'literal', value: 1 },
                        { kind: 'reference', path: 'dm.ability.impact_step' },
                      ],
                    },
                    { kind: 'reference', path: 'dm.ability.extra_ice_fire_dmg_' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      kind: 'call',
      operator: 'cmpGE',
      arguments: [
        { kind: 'reference', path: 'char.mindscape' },
        { kind: 'literal', value: 2 },
        { kind: 'reference', path: 'dm.m2.ability_buff_inc_' },
        { kind: 'literal', value: 1 },
      ],
    },
  ],
}

// The source alias includes the actual team-count gate; expanding only its
// numeric branch would incorrectly activate an unqualified formation.
export const lighterResolvedAbilityDmgIr = Object.freeze({
  kind: 'call',
  operator: 'cmpGE',
  arguments: [
    {
      kind: 'call',
      operator: 'sum',
      arguments: [
        {
          kind: 'call',
          operator: 'withSpecialty',
          receiver: { kind: 'reference', path: 'team.common.count' },
          arguments: [{ kind: 'literal', value: 'attack' }],
        },
        {
          kind: 'call',
          operator: 'withFaction',
          receiver: { kind: 'reference', path: 'team.common.count' },
          arguments: [{ kind: 'literal', value: 'SonsOfCalydon' }],
        },
      ],
    },
    { kind: 'literal', value: 2 },
    lighterQualifiedDamageIr,
  ],
})
