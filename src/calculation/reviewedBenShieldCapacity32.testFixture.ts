import {
  createLevel60NeutralEffectRuntimeMember,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'

export function createBenMember(options?: {
  coreLevel?: number
  mindscape?: number
  potential?: number | null
  initialHp?: number
  initialDef?: number
  finalHp?: number
  finalDef?: number
}): PlanningEffectRuntimeMember {
  const base = createLevel60NeutralEffectRuntimeMember('agent-ben')
  const coreLevel = options?.coreLevel ?? 7
  const initialHp = options?.initialHp ?? 10000
  const initialDef = options?.initialDef ?? 1500
  const finalHp = options?.finalHp ?? 12000
  const finalDef = options?.finalDef ?? 2000

  return {
    ...base,
    coreLevel,
    mindscape: options?.mindscape ?? 0,
    potential: options?.potential ?? 0,
    initialStats: {
      ...base.initialStats,
      hp: initialHp,
      def: initialDef,
    },
    finalStats: {
      ...base.finalStats,
      hp: finalHp,
      def: finalDef,
    },
  }
}
