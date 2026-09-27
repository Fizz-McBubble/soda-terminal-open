import { stableContentHash } from '../gameDataPacks/types'
import type { CurrentWEngineStaticCatalogItem } from '../gameDataPacks/currentWEngineStaticCatalog'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { PotentialApplicationBinding } from './potentialApplicationBinding'
import type { compileCurrentWEnginePersonalPlanningEffects } from './currentWEnginePersonalPlanningEffects'
import type {
  ValueBenchmarkCoverage,
  ValueBenchmarkEffectExclusion,
} from './valueBenchmarkComparison'

/** Mirror the personal runtime's actual coverage, without changing damage or adding effects. */
export function completePersonalValueBenchmarkCoverage(input: {
  discCoverage: ValueBenchmarkCoverage
  engine: { engineId: string; refinement: number; level: number }
  engineSource: CurrentWEngineStaticCatalogItem['source'] | null
  member: PlanningEffectRuntimeMember
  potentialApplications: readonly PotentialApplicationBinding[]
  engineEffects?: ReturnType<typeof compileCurrentWEnginePersonalPlanningEffects>
}): ValueBenchmarkCoverage {
  const source = input.engineSource
  const engineExclusion: ValueBenchmarkEffectExclusion = {
    effectKey: `wengine:${input.engine.engineId}:passive`,
    reason: '本个人固定事件切片仅采用音擎静态属性，未计算被动及触发条件。',
    fields: ['w_engine', 'refinement', 'initialStats', 'finalStats', 'combat_conditions'],
    sourceRefs: source
      ? [
          `${source.formulaPath}#sha256=${source.formulaSha256}`,
          `${source.dataPath}#sha256=${source.dataSha256}`,
        ]
      : [],
  }
  const potentialExclusions = input.potentialApplications
    .filter((effect) => effect.status === 'excluded')
    .map(
      (effect): ValueBenchmarkEffectExclusion => ({
        effectKey: effect.effectKey,
        reason: effect.reason,
        fields: ['potential', 'initialStats', 'event_context', effect.bucket],
        sourceRefs: [...effect.sourceRefs],
      }),
    )
  const excludedEffects = [
    ...new Map(
      [
        ...input.discCoverage.excludedEffects,
        ...(input.engineEffects ? input.engineEffects.exclusions : [engineExclusion]),
        ...potentialExclusions,
      ].map((effect) => [stableContentHash(effect), effect] as const),
    ).values(),
  ]
  const includedEffectKeys = [
    ...new Set([
      ...input.discCoverage.includedEffectKeys,
      ...(input.engineEffects?.buckets.map((bucket) => bucket.effectKey) ?? []),
      ...input.potentialApplications
        .filter((effect) => effect.status === 'applied')
        .map((effect) => effect.effectKey),
    ]),
  ]
  return {
    ...input.discCoverage,
    includedEffectKeys,
    excludedEffects,
    exclusionContextFingerprint: stableContentHash({
      discContext: input.discCoverage.exclusionContextFingerprint,
      engine: input.engine,
      engineEffects: input.engineEffects?.fingerprint ?? null,
      member: input.member,
      potentialApplications: input.potentialApplications,
      exclusions: excludedEffects,
    }),
    boundary:
      `${input.discCoverage.boundary} ${input.engineEffects?.boundary ?? '个人切片未计算音擎被动。'} 个人切片不含队伍效果；` +
      '潜能按运行时实际应用/排除记录。未建模效果相关盘面或条件变化时，' +
      '数值差不推广为配装整体优劣。',
  }
}
