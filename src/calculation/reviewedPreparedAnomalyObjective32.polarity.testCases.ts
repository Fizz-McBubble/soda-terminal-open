import { describe, expect, it } from 'vitest'
import { evaluateReviewedPreparedAnomalyObjective32 } from './reviewedPreparedAnomalyObjective32'
import { currentAgentEventContracts } from './currentAgentMechanicContracts'
import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from '../decision/developmentPreparedAnomalyBenchmark32'
import { bucket, polarityFixture } from './reviewedPreparedAnomalyObjective32.testFixture'

export function registerPreparedAnomalyPolarityTests32() {
  describe('declared original snapshot and Yanagi EX polarity settlement', () => {
    const wind = currentAgentEventContracts.find(
      (row) => row.identity.attribute === 'wind',
    )!.stableId
    it.each([
      ['agent-alice', 94950],
      ['agent-burnice', 111600],
      ['agent-grace', 116100],
      ['agent-nicole', 116100],
      ['agent-ellen', 94950],
      ['agent-miyabi', 128700],
      [wind, 85200],
    ])(
      'settles one %s original using independently expanded original and Yanagi AP terms',
      (id, expected) => {
        const input = polarityFixture(String(id))
        const before = structuredClone(input)
        const result = evaluateReviewedPreparedAnomalyObjective32(input)
        expect(result.status).toBe('supported')
        if (result.status !== 'supported') throw Error(result.blockers.join(','))
        // Physical: [(2000*(4.5+2.5+7.5*.075)*.15) + (300*32)] * (400/100) * 2.
        expect(result.settlementDamage).toBeCloseTo(Number(expected), 8)
        expect(result.planningDps).toBeNull()
        expect(result.modeledDirectDamage).toBeNull()
        expect(result.formalCycleReady).toBe(false)
        expect(input).toEqual(before)
      },
    )

    it('keeps source AP ownership distinct from the original ATK and snapshot AP factors', () => {
      const atk = polarityFixture(),
        trigger = polarityFixture(),
        originalAP = polarityFixture()
      atk.members[1]!.finalStats.atk *= 2
      trigger.member.finalStats.anomProf *= 2
      originalAP.members[1]!.finalStats.anomProf *= 2
      expect(evaluateReviewedPreparedAnomalyObjective32(atk).totalDamage).toBeCloseTo(113100, 8)
      expect(evaluateReviewedPreparedAnomalyObjective32(trigger).totalDamage).toBeCloseTo(171750, 8)
      expect(evaluateReviewedPreparedAnomalyObjective32(originalAP).totalDamage).toBeCloseTo(
        189900,
        8,
      )
    })

    it('does not borrow ordinary-anomaly buff, ordinary crit or anomaly-only AP into the EX trigger', () => {
      const input = polarityFixture()
      input.members[1]!.finalStats.crit_ = 1
      input.members[1]!.finalStats.crit_dmg_ = 100
      const buff = {
        ...bucket('combat.buff_', 2),
        recipientAgentIds: ['agent-alice'],
        damageType: 'anomaly',
      }
      const ap = {
        ...bucket('combat.anomProf', 100),
        recipientAgentIds: ['agent-yanagi'],
        damageType: 'anomaly',
      }
      const result = evaluateReviewedPreparedAnomalyObjective32({
        ...input,
        effectBuckets: [buff, ap],
      })
      expect(result.totalDamage).toBeCloseTo(94950, 8)
      if (result.status === 'supported')
        expect(
          result.excluded.some((row) => row.reason === 'outside_polarity_trigger_AP_scope'),
        ).toBe(true)
      expect(
        evaluateReviewedPreparedAnomalyObjective32({
          ...input,
          effectBuckets: [{ ...buff, damageType: 'disorder', value: 0.3 }],
        }).totalDamage,
      ).toBeCloseTo(123435, 8)
    })

    it('closes the expired or explicitly ended original state without a phantom proc', () => {
      for (const changed of [{ activeUntilSeconds: 2.5 }, { endedAtSeconds: 2 }]) {
        const input = polarityFixture()
        Object.assign(input.preparation, changed)
        const result = evaluateReviewedPreparedAnomalyObjective32(input)
        expect(result.status).toBe('supported')
        expect(result.totalDamage).toBe(0)
        if (result.status === 'supported') expect(result.triggered).toBe(false)
      }
    })

    it('rejects invalid ownership, time, source identity and reserved actor overrides', () => {
      const cases = [
        { preparation: { ...polarityFixture().preparation, originalOwnerAgentId: 'agent-billy' } },
        { preparation: { ...polarityFixture().preparation, applicationAtSeconds: 3 } },
        {
          preparation: {
            ...polarityFixture().preparation,
            activeUntilSeconds: 40,
            triggerAtSeconds: 31,
          },
        },
        { sourceIdentityHash: 'obsolete' },
        { baselineReferencesByAgentId: { 'agent-yanagi': { 'own.final.anomProf': 99999 } } },
        { baselineReferencesByAgentId: { 'agent-yanagi': { anomTimePassed: 30 } } },
        { baselineReferencesByAgentId: { 'agent-yanagi': { thrusts: -1 } } },
        { baselineReferencesByAgentId: { 'agent-yanagi': { thrusts: 0.5 } } },
        { baselineReferencesByAgentId: { 'agent-yanagi': { exSpecial_used: false } } },
      ]
      for (const changed of cases)
        expect(
          evaluateReviewedPreparedAnomalyObjective32({ ...polarityFixture(), ...changed }).status,
        ).toBe('unsupported')
    })

    it('never defaults the original owner/equipment or a two-owner state into a self snapshot', () => {
      const input = polarityFixture()
      Reflect.deleteProperty(input, 'originalEquipment')
      expect(evaluateReviewedPreparedAnomalyObjective32(input).status).toBe('unsupported')
      const same = polarityFixture('agent-yanagi')
      expect(evaluateReviewedPreparedAnomalyObjective32(same).totalDamage).toBeCloseTo(87075, 8)
      expect(
        evaluateReviewedPreparedAnomalyObjective32({ ...same, originalEquipment: {} }).status,
      ).toBe('unsupported')
    })

    it('reuses the actual prepared benchmark consumer with the same source and declaration context', () => {
      const input = polarityFixture()
      const result = evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
        ...input,
        discs: [],
        wEngine: {
          engineId: 'wengine-13008',
          refinement: 1,
          runtime: { accumulators: { 'WeepingGemini:anomaly_stack': 0 } },
        },
        engineKey: 'declared-gemini-zero-stacks',
        discLoadoutKey: 'declared-panel',
        subjectKey: 'yanagi-source-fixture',
      })
      expect(result.state).toBe('supported')
      expect(result.totalDamage).toBeCloseTo(94950, 8)
      expect(result.planningDps).toBeNull()
      expect(result.dimensions.event_set).toBe('yanagi_ex_single_polarity')
      expect(result.coverage?.domain).toBe('prepared_anomaly_settlement')
    })
  })
}
