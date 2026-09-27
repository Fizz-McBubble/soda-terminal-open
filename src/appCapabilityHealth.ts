import { currentBuildAuthority } from './gameDataPacks/currentBuildAuthority'
import { currentCapabilityGapMatrix } from './gameDataPacks/currentCapabilityGapMatrix'
import { currentFieldAuthority } from './gameDataPacks/currentFieldAuthority'
import { currentScopeManifest } from './gameDataPacks/currentScopeManifest'
import { stableContentHash } from './gameDataPacks/types'
import { planningFormulaFamilyRegistry } from './calculation/planningFormulaFamilies'
import { currentN4DataManagementGate } from './validation/currentN4DataManagementGate'

export type AppCapabilityHealthState =
  | 'loading'
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'stale'
  | 'error'

export type RuntimeHealthInput = {
  dataStatus: 'ready' | 'error'
  databaseStatus: 'loading' | 'ready' | 'error'
}

function layer(state: AppCapabilityHealthState, summary: string, blockers: readonly string[] = []) {
  return { state, summary, blockers }
}

export function createAppCapabilityHealth(input: RuntimeHealthInput) {
  const runtime =
    input.dataStatus === 'error' || input.databaseStatus === 'error'
      ? layer('error', '本地运行环境或基础数据初始化失败。', ['runtime_initialization_failed'])
      : input.databaseStatus === 'loading'
        ? layer('loading', '本地运行环境正在初始化。')
        : layer('ready', '本地运行环境与基础数据文件可用。')

  const currentScopeReady =
    currentScopeManifest.coverage.releasedScope === currentScopeManifest.coverage.directoryTotal &&
    currentScopeManifest.coverage.byDomain.agent === currentBuildAuthority.coverage.total
  const currentScope = currentScopeReady
    ? layer('ready', '3.1 Phase II 当前目录与稳定身份可用。')
    : layer('partial', '当前目录仍有未发布或未映射对象。', ['current_scope_incomplete'])

  const buildGuidance =
    currentBuildAuthority.coverage.guidanceReady === currentBuildAuthority.coverage.total
      ? layer('ready', '全部当前代理人的构筑指导字段完整。')
      : layer(
          'partial',
          `${currentBuildAuthority.coverage.guidancePartial} 个当前代理人仍有字段级构筑缺口。`,
          ['build_guidance_partial'],
        )

  const calculationReadyRows = currentCapabilityGapMatrix.rows.filter(
    (row) => row.calculation.status === 'ready',
  ).length
  const staticCalculation =
    calculationReadyRows > 0
      ? layer(
          calculationReadyRows === currentCapabilityGapMatrix.rows.length ? 'ready' : 'partial',
          `${calculationReadyRows}/${currentCapabilityGapMatrix.rows.length} 个代理人具备静态计算能力。`,
        )
      : (planningFormulaFamilyRegistry.families as readonly { status: string }[]).some(
            (family) => family.status === 'engine_ready_no_current_subjects',
          )
        ? layer(
            'partial',
            'Planning DPS 标准直接伤害引擎可执行，但尚无 current 代理人完成 Formal support row。',
            ['planning_formula_engine_ready_without_current_subject'],
          )
        : layer('unavailable', 'Planning DPS 公式族尚未进入生产计算。', [
            'planning_formula_family_unavailable',
          ])

  const recommendationTrust = currentN4DataManagementGate.blocksProductAcceptance
    ? layer('partial', '部分建议已有依据，但仍需独立验证和真实账户复验。', [
        'independent_validation_incomplete',
        'real_account_revalidation_required',
      ])
    : layer('ready', '推荐依据、独立验证与真实账户复验均已通过。')

  const freshness =
    currentFieldAuthority.coverage.stale === 0
      ? layer('ready', '当前字段均已完成版本适用性判定。')
      : layer('stale', `${currentFieldAuthority.coverage.stale} 个字段受版本变化影响且尚未复核。`, [
          'current_fields_stale',
        ])

  const layers = {
    runtime,
    currentScope,
    buildGuidance,
    staticCalculation,
    recommendationTrust,
    freshness,
  }
  return { ...layers, fingerprint: stableContentHash(layers) }
}
