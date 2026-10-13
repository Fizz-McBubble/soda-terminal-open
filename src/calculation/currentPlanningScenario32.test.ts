import { describe, expect, it } from 'vitest'
import {
  currentPlanningScenarioOptions32,
  resolveCurrentPlanningScenario32,
} from './currentPlanningScenario32'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { planningBaselineSchema } from './planningDpsContract'

describe('currentPlanningScenario32', () => {
  it('exports expected scenario options with standard labels', () => {
    expect(currentPlanningScenarioOptions32).toEqual([
      { id: 'normalized-comparison', label: '常规比较' },
      { id: 'declared-stun-comparison', label: '失衡期比较' },
    ])
  })

  it('defaults strictly to normalized-comparison when input is undefined', () => {
    const resolution = resolveCurrentPlanningScenario32(undefined)
    expect(resolution.selection).toEqual({
      schemaVersion: 1,
      id: 'normalized-comparison',
    })
    expect(resolution.baseline).toBe(currentNormalizedPlanningBaseline)
    expect(resolution.enemyStunned).toBe(false)
    expect(resolution.baseline.enemy.stunMultiplier).toBe(1)
    expect(resolution.baseline.enemy.defense).toBe(700)
    expect(resolution.baseline.enemy.resistance).toBe(0.2)
    expect(resolution.boundary).toContain('常规比较基线')
    expect(resolution.identity).toMatch(/^(fnv1a|sha256)/)
  })

  it('resolves explicit normalized-comparison input correctly', () => {
    const resolution = resolveCurrentPlanningScenario32({
      schemaVersion: 1,
      id: 'normalized-comparison',
    })
    expect(resolution.selection.id).toBe('normalized-comparison')
    expect(resolution.enemyStunned).toBe(false)
    expect(resolution.baseline).toBe(currentNormalizedPlanningBaseline)
  })

  it('resolves explicit declared-stun-comparison with stunMultiplier 1.5 and validated PlanningBaseline', () => {
    const resolution = resolveCurrentPlanningScenario32({
      schemaVersion: 1,
      id: 'declared-stun-comparison',
    })
    expect(resolution.selection).toEqual({
      schemaVersion: 1,
      id: 'declared-stun-comparison',
    })
    expect(resolution.enemyStunned).toBe(true)
    expect(resolution.baseline.enemy.stunMultiplier).toBe(1.5)
    expect(resolution.baseline.enemy.defense).toBe(700)
    expect(resolution.baseline.enemy.resistance).toBe(0.2)
    expect(resolution.baseline.phaseId).toBe('declared-stun-fixed-event-comparison')
    expect(resolution.baseline.baselineId).toContain('declared-stun')
    expect(resolution.boundary).toContain('失衡倍率1.5')
    expect(resolution.boundary).toContain('声明比较假设')

    // Validates against official PlanningBaseline schema
    expect(() => planningBaselineSchema.parse(resolution.baseline)).not.toThrow()

    // Identity is distinct from normalized comparison
    const normalized = resolveCurrentPlanningScenario32()
    expect(resolution.identity).not.toBe(normalized.identity)
    expect(resolution.baseline.formulaHash).not.toBe(normalized.baseline.formulaHash)
  })

  it('strictly rejects non-object inputs', () => {
    expect(() => resolveCurrentPlanningScenario32(null)).toThrow(
      '规划场景选择必须为有效对象或 undefined。',
    )
    expect(() => resolveCurrentPlanningScenario32('normalized-comparison')).toThrow(
      '规划场景选择必须为有效对象或 undefined。',
    )
    expect(() => resolveCurrentPlanningScenario32(1)).toThrow(
      '规划场景选择必须为有效对象或 undefined。',
    )
    expect(() => resolveCurrentPlanningScenario32([])).toThrow(
      '规划场景选择必须为有效对象或 undefined。',
    )
  })

  it('strictly rejects unknown keys', () => {
    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: 1,
        id: 'normalized-comparison',
        unknownKey: 'forbidden',
      }),
    ).toThrow('规划场景选择包含未知字段：unknownKey。')

    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: 1,
        id: 'declared-stun-comparison',
        extra: 42,
        another: true,
      }),
    ).toThrow('规划场景选择包含未知字段：extra, another。')
  })

  it('strictly rejects unsupported schemaVersion', () => {
    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: 2,
        id: 'normalized-comparison',
      }),
    ).toThrow('不支持的规划场景版本：2。')

    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: '1',
        id: 'normalized-comparison',
      }),
    ).toThrow('不支持的规划场景版本：1。')
  })

  it('strictly rejects unsupported scenario id', () => {
    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: 1,
        id: 'future-scenario',
      }),
    ).toThrow('不支持的规划场景标识：future-scenario。')

    expect(() =>
      resolveCurrentPlanningScenario32({
        schemaVersion: 1,
        id: '',
      }),
    ).toThrow('不支持的规划场景标识：。')
  })
})
