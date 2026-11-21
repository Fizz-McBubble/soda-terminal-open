import { expect } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { evaluateReviewedPreparedAnomalyObjective32 } from './reviewedPreparedAnomalyObjective32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PreparedYanagiPolarity32 } from './reviewedPreparedPolarityObjective32'

export const baseline = {
  ...currentNormalizedPlanningBaseline,
  enemy: {
    id: 'independent-neutral-fixture',
    defense: 0,
    resistance: 0,
    stunMultiplier: 1,
    vulnerability: 0,
  },
}
export function member(id = 'agent-piper') {
  const row = createLevel60NeutralEffectRuntimeMember(id)
  row.coreLevel = 7
  row.finalStats = {
    ...row.finalStats,
    atk: 3000,
    anomProf: 300,
    anomMas: 200,
    damageBonus: 0,
    pen_: 0,
  }
  row.initialStats = { ...row.finalStats, atk: 2000 }
  return row
}
export function bucket(stat: string, value: number): SourceBackedPlanningEffectBucket {
  return {
    bucketId: stat,
    effectKey: `fixture:${stat}`,
    providerAgentId: 'agent-piper',
    recipientAgentIds: ['agent-piper'],
    receiverPath: `ownBuff.${stat}`,
    damageType: null,
    action: null,
    attribute: null,
    value,
    application: 'outside_direct_event_formula',
    sourceRefs: ['independent-declared-fixture'],
  }
}
export function value(id = 'agent-piper') {
  const result = evaluateReviewedPreparedAnomalyObjective32({ member: member(id), baseline })
  expect(result.status).toBe('supported')
  if (result.status !== 'supported') throw new Error(result.blockers.join(','))
  return result
}

export function polarityFixture(ownerId = 'agent-alice') {
  const actor = member('agent-yanagi')
  actor.skillLevels = { ...actor.skillLevels, special: 12 }
  const original = ownerId === actor.agentId ? actor : member(ownerId)
  original.finalStats.atk = 2000
  original.initialStats.atk = 2000
  if (original !== actor) original.finalStats.anomProf = 400
  const preparation: PreparedYanagiPolarity32 = {
    kind: 'yanagi_ex_single_polarity',
    acceptedSingleOwnerOriginalAnomaly: true,
    snapshotBasis: 'current_declared_panels',
    originalOwnerAgentId: ownerId,
    applicationAtSeconds: 0,
    triggerAtSeconds: 2.5,
    activeUntilSeconds: 20,
    endedAtSeconds: null,
    sourceRefs: ['independent-prepared-single-owner-state'],
  }
  return {
    member: actor,
    members:
      original === actor
        ? [actor, member('agent-astra'), member('agent-nicole')]
        : [actor, original, member('agent-astra')],
    baseline,
    preparation,
    ...(original === actor ? {} : { originalEquipment: {} }),
  }
}
