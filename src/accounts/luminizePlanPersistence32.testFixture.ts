import { reviewedLumifluxMechanicsHash32 } from '../calculation/reviewedLumifluxMechanics32'

export function luminizeSettlementPlanPersistenceFixture() {
  return {
    contract: 'soda-declared-luminize-settlement32/v1' as const,
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
    authority: 'declared_unrefringed_snapshots' as const,
    eventId: 'lumiflux-r1',
    targetId: 'target-r1',
    atSeconds: 12,
    memberAgentIds: ['agent-remielle', 'agent-aria', 'agent-velina'],
    skill: 'rainbows_end' as const,
    effectiveSkillLevel: 7,
    remielle: {
      agentId: 'agent-remielle' as const,
      coreLevel: 7 as const,
      mindscape: 0,
      anomalyProficiency: 170,
      generalAnomalyDamageBonus: 0,
      prismaticDefenseIgnoreWindow: false,
      sourceRefs: ['fixture:remielle'],
    },
    voidflares: [
      {
        id: 'voidflare-r1',
        ownerAgentId: 'agent-aria',
        attribute: 'ether' as const,
        snapshotAtSeconds: 10,
        stats: {
          attackerLevel: 60,
          attack: 1000,
          anomalyProficiency: 170,
          damageBonus: 0,
          penetrationRatio: 0,
          penetrationFlat: 0,
        },
        storedRefringeCoefficient: 0.1,
        sourceRefs: ['fixture:voidflare'],
      },
    ],
    target: {
      enemyDefense: 953,
      resistanceByAttribute: { ether: 0.2 },
      resistanceReductionByAttribute: { ether: 0 },
      defenseReduction: 0,
      vulnerability: 0,
      stunMultiplier: 1,
      sourceRefs: ['fixture:target'],
    },
    sourceRefs: ['fixture:luminize'],
  }
}
