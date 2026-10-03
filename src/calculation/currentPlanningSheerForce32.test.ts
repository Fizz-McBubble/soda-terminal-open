import { describe, expect, it } from 'vitest'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import {
  evaluateSourceBackedPersonalPlanningDps,
  type SourceBackedEquipmentModifierBucket,
} from './currentPlanningTeamDpsRuntime'

function bucket(
  application: SourceBackedEquipmentModifierBucket['application'],
  value: number,
): SourceBackedEquipmentModifierBucket {
  return {
    application,
    value,
    bucketId: application,
    effectKey: application,
    providerAgentId: 'agent-yixuan',
    recipientAgentIds: ['agent-yixuan'],
    receiverPath: null,
    damageType: null,
    action: null,
    attribute: null,
    sourceRefs: ['independent-hand-calculated-vector'],
  }
}
function run(applications: SourceBackedEquipmentModifierBucket[] = []) {
  const neutral = createLevel60NeutralEffectRuntimeMember('agent-yixuan')
  const stats = {
    ...neutral.initialStats,
    atk: 1000,
    hp: 10000,
    baseAttack: 600,
    crit_: 0,
    crit_dmg_: 0,
  }
  return evaluateSourceBackedPersonalPlanningDps({
    member: { ...neutral, level: 1, coreLevel: 6, initialStats: stats, finalStats: stats },
    baseline: {
      ...currentNormalizedPlanningBaseline,
      gameVersion: '3.2',
      enemy: {
        ...currentNormalizedPlanningBaseline.enemy,
        resistance: 0,
        defense: 99999,
        vulnerability: 0,
        stunMultiplier: 1,
      },
    },
    eventUsages: [
      {
        ownerAgentId: 'agent-yixuan',
        eventId: 'basic.BasicAttackCirrusStrike.hit-0',
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['sourced-single-event-not-a-rotation'],
      },
    ],
    equipmentModifierBuckets: applications,
  })
}
describe('shared sheer source projection in real event dispatch', () => {
  const vectors: Array<[SourceBackedEquipmentModifierBucket[], number]> = [
    [[], 595.4],
    [[bucket('attack_percent', 0.25)], 629.75],
    [[bucket('hp_percent', 0.25)], 709.9],
    [
      [bucket('attack_percent', 0.25), bucket('hp_percent', 0.25), bucket('sheer_force', 300)],
      881.65,
    ],
    [[bucket('attack_flat', 200), bucket('hp_flat', 500)], 645.78],
  ]
  it.each(vectors)(
    'calculates source .458 MV without defense or attack fallback',
    (buckets, expected) => {
      const result = run(buckets)
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      // source common .3*finalATK + Yixuan .1*finalHP, then single-hit MV.458.
      expect(result.totalDamage).toBeCloseTo(expected)
    },
  )
})
