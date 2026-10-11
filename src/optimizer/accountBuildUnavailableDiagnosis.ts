import type { DriveDisc } from '../domain/schemas'
import type { AgentDiscProfile } from '../assault/engine'
import type { UnavailableDiagnosis } from './accountBuildAllocationTypes'

export function diagnoseIndependent(
  discs: DriveDisc[],
  profile: AgentDiscProfile,
  strictCounts: Record<number, number>,
  relaxedCounts: Record<number, number>,
): UnavailableDiagnosis {
  const missingSlots = Array.from({ length: 6 }, (_, index) => index + 1).filter(
    (slot) => (relaxedCounts[slot] ?? 0) === 0,
  )
  const setNames = new Set(
    profile.setPlans?.flatMap((plan) => [...plan.primarySets, ...plan.secondarySets]) ??
      Object.keys(profile.setFit),
  )
  const reasons = missingSlots.map((slot) => {
    const slotDiscs = discs.filter((disc) => disc.slot === slot)
    const setCount = slotDiscs.filter((disc) => setNames.has(disc.setId)).length
    if (!setCount) return `${slot}号位没有该场景允许的套装盘。`
    if (!(strictCounts[slot] ?? 0)) return `${slot}号位推荐主词条与允许套装没有可用组合。`
    return `${slot}号位候选不足以组成完整4+2或2+2+2。`
  })
  if (!missingSlots.length) reasons.push('现有候选无法组成Profile允许的完整4+2或2+2+2。')
  return {
    agentId: profile.agentId,
    scope: 'independent',
    missingSlots,
    reasons,
    actions: ['切换该角色的玩法场景', '补充对应套装/号位库存', '取消冲突的固定或排除条件'],
  }
}
