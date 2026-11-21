import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { resolveCurrentFormulaWEngineContract } from './currentFormulaMechanicContracts'
import { resolveSteelCushionPassive } from './currentWEnginePassiveAdapters'
import type { CurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'

export const steelCushionReconciliation = Object.freeze({
  id: 'steel-cushion-physical-param0-source-reconciliation-r1',
  repository: 'https://github.com/frzyc/genshin-optimizer',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/SteelCushion.ts',
  formulaSha256: '39360E37B6A70E8422CC1EBF6AFB907F139ADC18DD79944EC757ED0F17E94E0D',
  dataPath: 'libs/zzz/stats/Data/Wengine/SteelCushion.json',
  dataSha256: 'BF56ED4B057ED8938A3949F2B2BD70C3D7D76D22F24F01946331F16C1AEFCA97',
  mappedPath: 'libs/zzz/stats/src/mappedStats/wengine/maps/SteelCushion.ts',
  mappedSha256: '187156314135C7F34F392354BA47ECF199270DB660B3C85D4A5387DF0E1EBD6C',
  localizationPath: 'libs/zzz/dm-localization/assets/locales/en/wengine_SteelCushion_gen.json',
  localizationSha256: 'A2650CD0067A612B7320B398DFCF73F77170CBECA51D2A7EB53E484F644590CF',
  reason:
    '锁定原公式被动物伤误读dm.dmg_（param1）；采用同pin映射与本地化的physical_dmg_（param0），背击仍用param1；原IR保留。',
})

export function resolveReconciledSteelCushion(input: {
  refinement: number
  runtime: CurrentWEngineFormulaRuntime
}) {
  const unsupported = (reason: string) => ({
    status: 'unsupported' as const,
    blockers: [reason],
  })
  const source = getCurrentWEngineStaticData('wengine-14102')
  const pin = steelCushionReconciliation
  if (
    !source ||
    source.upstreamKey !== 'SteelCushion' ||
    source.source.formulaPath !== pin.formulaPath ||
    source.source.formulaSha256 !== pin.formulaSha256 ||
    source.source.dataPath !== pin.dataPath ||
    source.source.dataSha256 !== pin.dataSha256
  )
    return unsupported('钢铁肉垫来源裁决的exact-pin已变化，不能继续覆盖当前公式。')
  // Reuse the existing semantic adapter, and prove both channels at every
  // refinement against the pinned native parameter table. No second value table.
  if (
    source.passiveParameterTable.length !== 5 ||
    new Set(source.passiveParameterTable.map((row) => row.refinement)).size !== 5 ||
    source.passiveParameterTable.some((row) => {
      const adapted = resolveSteelCushionPassive({
        refinement: row.refinement,
        specialtyMatches: true,
        hitFromBehind: true,
      })
      return (
        adapted.status !== 'supported' ||
        row.params.length !== 2 ||
        adapted.effects.find((effect) => effect.attribute === 'physical')?.value !==
          row.params[0] ||
        adapted.effects.find((effect) => effect.attribute === undefined)?.value !== row.params[1]
      )
    })
  )
    return unsupported('钢铁肉垫既有适配器与锁定物伤/背击参数逐改装等级核对不一致。')
  const hitFromBehind = input.runtime.flags?.['SteelCushion:hit_behind']
  if (typeof hitFromBehind !== 'boolean')
    return unsupported('钢铁肉垫来源裁决仍要求显式背后命中状态；未知不能按false处理。')
  const adapted = resolveSteelCushionPassive({
    refinement: input.refinement,
    specialtyMatches: true,
    hitFromBehind,
  })
  if (adapted.status !== 'supported') return adapted
  const raw = resolveCurrentFormulaWEngineContract({
    stableId: 'wengine-14102',
    refinement: input.refinement,
    specialtyMatches: true,
    runtimePolicy: 'strict',
    runtime: input.runtime,
  })
  if (raw.status !== 'supported') return raw
  const physical = adapted.effects.find((effect) => effect.attribute === 'physical')
  if (
    !physical ||
    raw.effects.length !== adapted.effects.length ||
    raw.exclusions.length ||
    raw.effects.some(
      (effect) =>
        effect.kind !== 'modifier' ||
        effect.target !== 'own' ||
        !['combat.dmg_.physical', 'combat.common_dmg_'].includes(String(effect.stat)),
    ) ||
    raw.effects.filter((effect) => effect.stat === 'combat.dmg_.physical').length !== 1
  )
    return unsupported('钢铁肉垫原IR形状已变化，来源裁决不可继续应用。')
  return {
    ...raw,
    effects: raw.effects.map((effect) =>
      effect.stat === 'combat.dmg_.physical' ? { ...effect, value: physical.value } : effect,
    ),
  }
}
