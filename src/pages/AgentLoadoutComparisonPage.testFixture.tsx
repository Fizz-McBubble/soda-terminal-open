/* eslint-disable react-refresh/only-export-components */
import { useLocation } from 'react-router-dom'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
const discs = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `disc-${slot}`,
  label: `实体盘 ${slot}号位`,
  slot: slot as 1 | 2 | 3 | 4 | 5 | 6,
  set: '啄木鸟电音',
  image: null,
  level: 15,
  main: '攻击力',
  mainValue: '当前记录',
  subs: Array.from({ length: 4 }, (_, index) => ({
    name: `副词条${index + 1}`,
    value: '—',
    hits: 0,
  })),
  effective: '未核验',
  grade: 'B+' as const,
}))

function benchmark(delta: number) {
  const dimensions: ValueBenchmarkSide['dimensions'] = {
    game_version: '3.1',
    subject: 'agent-billy',
    scenario: 'normalized',
    event_set: 'events',
    duration: '30',
    formula: 'formula',
    runtime: 'runtime',
    disc_loadout: 'current',
    w_engine: 'engine',
    bangboo: 'none',
  }
  return compareValueBenchmarkSides({
    baseline: {
      state: 'supported',
      dimensions,
      totalDamage: 300,
      planningDps: 10,
      calculationFingerprint: 'current',
      reasons: [],
    },
    candidate: {
      state: 'supported',
      dimensions: { ...dimensions, disc_loadout: `candidate-${delta}` },
      totalDamage: 300 + delta * 30,
      planningDps: 10 + delta,
      calculationFingerprint: `candidate-${delta}`,
      reasons: [],
    },
    changedDimensions: ['disc_loadout'],
    independentCounterfactual: true,
    labels: { baseline: '当前实装', candidate: '候选方案' },
  })
}

function ReturnLocation() {
  const location = useLocation()
  return <output data-testid="returned-location">{`${location.pathname}${location.search}`}</output>
}

export { discs, benchmark, ReturnLocation }
