/** Portable selection contract; numeric baselines remain in the producer. */
export type CurrentPlanningScenarioSelection32 = {
  schemaVersion: 1
  id: 'normalized-comparison' | 'declared-stun-comparison'
}

export const currentPlanningScenarioOptions32 = [
  { id: 'normalized-comparison', label: '常规比较' },
  { id: 'declared-stun-comparison', label: '失衡期比较' },
] as const

export function planningScenarioSelection32(id: string): CurrentPlanningScenarioSelection32 {
  const option = currentPlanningScenarioOptions32.find((item) => item.id === id)
  if (!option) throw new Error('比较场景已变更，请重新选择。')
  return { schemaVersion: 1, id: option.id }
}

export const defaultPlanningScenarioSelection32 =
  planningScenarioSelection32('normalized-comparison')
