import type { ValueBenchmarkCoverage, ValueBenchmarkSide } from './valueBenchmarkComparison'

export const labels = { baseline: '当前方案', candidate: '候选方案' }

export function coverage(overrides: Partial<ValueBenchmarkCoverage> = {}): ValueBenchmarkCoverage {
  return {
    domain: 'fixed_event_direct_damage',
    includedEffectKeys: [],
    excludedEffects: [],
    exclusionContextFingerprint: 'coverage-context-a',
    boundary: '固定事件直接伤害测试边界',
    ...overrides,
  }
}

export function side(overrides: Partial<ValueBenchmarkSide> = {}): ValueBenchmarkSide {
  return {
    state: 'supported',
    dimensions: {
      game_version: '3.1',
      subject: 'agent-a',
      scenario: 'normalized',
      event_set: 'events-r1',
      duration: '30',
      formula: 'formula-r1',
      runtime: 'runtime-r1',
      disc_loadout: 'disc-a',
      w_engine: 'engine-a:p1',
      bangboo: 'none',
    },
    totalDamage: 300,
    planningDps: 10,
    calculationFingerprint: 'calc-a',
    coverage: coverage(),
    reasons: [],
    ...overrides,
  }
}
