import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import { stableContentHash } from '../gameDataPacks/types'
import type { DriveDisc } from '../domain/schemas'
import type { DevelopmentValueBenchmarkInput } from './developmentValueBenchmarkProjection'

export function equipmentConditionConflict(
  agentId: string,
  discs: readonly DriveDisc[],
  engineKey: string,
) {
  return { agentId, discs, engineKey, reasons: ['音擎声明状态与已核准备轴状态冲突。'] }
}

export function prepareDevelopmentDeclaredEquipmentRuntime(
  declaration: ReviewedTemplateEventConditionDeclaration32 | undefined,
  runtime: CurrentWEngineFormulaRuntime | undefined,
) {
  const flags: Record<string, boolean> = {}
  if (typeof declaration?.steelCushionHitBehind === 'boolean')
    flags['SteelCushion:hit_behind'] = declaration.steelCushionHitBehind
  if (typeof declaration?.firstPlumageAnomalyCritWindowActive === 'boolean')
    flags['FirstPlumage:teamAnomalyCritWindowActive'] =
      declaration.firstPlumageAnomalyCritWindowActive
  const conflict = Object.entries(flags).some(
    ([key, value]) => runtime?.flags?.[key] !== undefined && runtime.flags[key] !== value,
  )
  const hasFlags = Object.keys(flags).length > 0
  return {
    conflict,
    runtime: hasFlags ? { ...runtime, flags: { ...runtime?.flags, ...flags } } : runtime,
    identity: hasFlags ? `:equipment-conditions:${stableContentHash(flags)}` : '',
  }
}

/** Aria's reviewed preparation permits only its matching enemy stun declaration. */
export function ariaEventDeclarationFailure(
  input: Pick<DevelopmentValueBenchmarkInput, 'eventConditionDeclaration' | 'agentId' | 'discs'>,
  enemyStunned: boolean,
  engineKey: string,
) {
  const declaration = input.eventConditionDeclaration
  const unsupported =
    !!declaration &&
    (declaration.windswept != null ||
      declaration.sunnaDelusionApplied != null ||
      declaration.nangongMisstepApplied != null ||
      declaration.remiellePhaseFlow != null ||
      declaration.whiteWaterBalladCritWindow != null ||
      declaration.whiteWaterBalladAttackWindow != null ||
      declaration.steelCushionHitBehind != null ||
      declaration.firstPlumageAnomalyCritWindowActive != null ||
      (declaration.enemyStunned != null && declaration.enemyStunned !== enemyStunned))
  return unsupported
    ? {
        agentId: input.agentId,
        discs: input.discs,
        engineKey,
        reasons: ['爱芮异常准备轴不接受外来或冲突的额外事件声明。'],
      }
    : null
}
