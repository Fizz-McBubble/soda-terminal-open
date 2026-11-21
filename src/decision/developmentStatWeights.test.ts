import { describe, expect, it } from 'vitest'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'

describe('read-only standard-roll sensitivity boundaries', () => {
  it('invalidates results for changed discs and explicit engine parameters', () => {
    const input = { ...statWeightCalibrationFixture(), stale: false }
    const ordinary = evaluateDevelopmentStatWeights(input)
    const repeated = evaluateDevelopmentStatWeights(input)
    const critRich = evaluateDevelopmentStatWeights({
      ...statWeightCalibrationFixture('agent-claret', 'crit_rate'),
      stale: false,
    })
    const changedEngine = evaluateDevelopmentStatWeights({
      ...input,
      parameters: {
        wEngine: { engineId: 'wengine-14161', level: 60, ascension: 5, refinement: 5 },
      },
    })
    expect(ordinary.fingerprint).toBe(repeated.fingerprint)
    expect(ordinary.fingerprint).not.toBe(critRich.fingerprint)
    expect(ordinary.fingerprint).not.toBe(changedEngine.fingerprint)
    expect(changedEngine.baseline.dimensions.w_engine).toContain('p5:lv60:asc5')
  })

  it.each(['stale', 'engine', 'invalid-disc', 'incomplete'] as const)(
    'does not publish usable gains for %s inputs',
    (cause) => {
      const input = { ...statWeightCalibrationFixture(), stale: cause === 'stale' }
      if (cause === 'engine')
        input.warehouse.roster.agents.find(
          (agent) => agent.agentId === input.agentId,
        )!.wEngineDetails = { id: null, name: null, level: null, refinement: null }
      if (cause === 'invalid-disc') input.discs[0]!.subStats[0]!.value = 9999
      if (cause === 'incomplete') input.discs.pop()
      const result = evaluateDevelopmentStatWeights(input)
      expect(result.status).toBe(cause === 'stale' ? 'stale' : 'unsupported')
      expect(
        result.rows.every((row) => row.relativeGain === null && row.normalizedWeight === null),
      ).toBe(true)
    },
  )

  it('keeps the unmodeled anomaly affix unavailable for a supported personal event', () => {
    const f = statWeightCalibrationFixture()
    const agent = f.warehouse.roster.agents.find((row) => row.agentId === 'agent-astra')!
    Object.assign(agent, {
      ...f.warehouse.roster.agents.find((row) => row.agentId === f.agentId),
      agentId: 'agent-astra',
    })
    const result = evaluateDevelopmentStatWeights({ ...f, agentId: 'agent-astra', stale: false })
    expect(result.rows.find((row) => row.stat === 'anomaly_proficiency')).toMatchObject({
      status: 'unsupported',
      damageDelta: null,
    })
  })

  it('calculates Roxy personal fixed-event attack marginal without inventing anomaly gains', () => {
    const f = statWeightCalibrationFixture('agent-billy')
    const actor = f.warehouse.roster.agents.find((row) => row.agentId === 'agent-roxy')!
    Object.assign(actor, {
      ...structuredClone(f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!),
      agentId: 'agent-roxy',
      wEngineDetails: { id: 'wengine-14162', name: null, level: 60, ascension: 5, refinement: 1 },
    })
    const result = evaluateDevelopmentStatWeights({ ...f, agentId: 'agent-roxy', stale: false })
    expect(result.baseline.state).toBe('supported')
    expect(result.rows.find((row) => row.stat === 'atk_flat')?.damageDelta).toBeGreaterThan(0)
    expect(result.rows.find((row) => row.stat === 'anomaly_proficiency')).toMatchObject({
      status: 'unsupported',
      damageDelta: null,
    })
  })

  it('locks every dimension except the virtual affix and never qualifies it as a real formal asset', () => {
    const input = { ...statWeightCalibrationFixture(), stale: false }
    const baseline = evaluateDevelopmentValueBenchmarkSide(input)
    const probe = evaluateDevelopmentValueBenchmarkSide({
      ...input,
      statProbe: { stat: 'crit_rate', value: 2.4 },
    })
    expect(probe.state).toBe('supported')
    expect(probe.modelQualification32).toBeUndefined()
    expect(probe.dimensions.disc_loadout).not.toBe(baseline.dimensions.disc_loadout)
    expect({ ...probe.dimensions, disc_loadout: baseline.dimensions.disc_loadout }).toEqual(
      baseline.dimensions,
    )
    expect(
      evaluateDevelopmentValueBenchmarkSide({
        ...input,
        statProbe: { stat: 'crit_rate', value: 999 },
      }).state,
    ).toBe('unsupported')
  })
})
