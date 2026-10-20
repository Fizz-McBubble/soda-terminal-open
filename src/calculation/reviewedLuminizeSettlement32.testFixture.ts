import type { DeclaredLuminizeSettlement32 } from './luminizeSettlementContract32'
import { reviewedLumifluxMechanicsHash32 } from './reviewedLumifluxMechanics32'

export function luminizeFixture32(): DeclaredLuminizeSettlement32 {
  return {
    contract: 'soda-declared-luminize-settlement32/v1',
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
    authority: 'declared_unrefringed_snapshots',
    eventId: 'synthetic-volley-1',
    targetId: 'synthetic-enemy',
    atSeconds: 10,
    memberAgentIds: ['agent-remielle', 'agent-billy'],
    skill: 'rainbows_end',
    effectiveSkillLevel: 12,
    remielle: {
      agentId: 'agent-remielle',
      coreLevel: 1,
      mindscape: 0,
      anomalyProficiency: 0,
      generalAnomalyDamageBonus: 0,
      prismaticDefenseIgnoreWindow: false,
      sourceRefs: ['synthetic-provider'],
    },
    voidflares: [
      {
        id: 'synthetic-flare-1',
        ownerAgentId: 'agent-billy',
        attribute: 'physical',
        snapshotAtSeconds: 8,
        stats: {
          attackerLevel: 60,
          attack: 1000,
          anomalyProficiency: 100,
          damageBonus: 0,
          penetrationRatio: 0,
          penetrationFlat: 0,
        },
        storedRefringeCoefficient: 0,
        sourceRefs: ['synthetic-owner-snapshot'],
      },
    ],
    target: {
      enemyDefense: 794,
      resistanceByAttribute: { physical: 0 },
      resistanceReductionByAttribute: { physical: 0 },
      defenseReduction: 0,
      vulnerability: 0,
      stunMultiplier: 1,
      sourceRefs: ['synthetic-target'],
    },
    sourceRefs: ['synthetic-declaration'],
  }
}
