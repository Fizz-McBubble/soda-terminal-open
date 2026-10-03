/** Source-wide character defaults; these do not live in individual character stats.
 * Adapted from frzyc/genshin-optimizer (MIT), libs/zzz/formula/src/util.ts.
 * See upstream/genshinOptimizer/NOTICE.md. Values are fractions, not display percentages.
 */
export const currentFormulaBaseStats = Object.freeze({
  critRate: 0.05,
  critDamage: 0.5,
  lacerationDamage: 1.5,
  sharpDamageBonus: 0,
})

export const currentFormulaBaseStatsSource = Object.freeze({
  sourceVersion: '3.2',
  upstreamCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  sourcePath: 'libs/zzz/formula/src/util.ts',
  sha256: 'A6BA0FE646A28389F63E7EACD48FDBD408B543C13CFE4C62964952196B523426',
  evidenceRef: 'GO:util.ts:sha256:A6BA0FE646A28389F63E7EACD48FDBD408B543C13CFE4C62964952196B523426',
})
