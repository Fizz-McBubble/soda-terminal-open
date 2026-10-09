import { describe, expect, it } from 'vitest'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedAccountFinalStats'
import { teamDynamicFixture } from './teamDynamicIntegration.testFixture'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import {
  evaluateReviewedFunctionalCapacity32,
  preservesReviewedFunctionalCapacities32,
} from '../calculation/reviewedFunctionalCapacity32'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { evaluateReviewedDialynInitialImpact32 } from '../calculation/reviewedFunctionalInitialImpact32'
import { preservesTeamFunctionalConstraints32 } from './teamFunctionalConstraints32'

describe('functional source capacities reach actual loadout consumers', () => {
  it('carries sourced point grants through the actual personal and eighteen-disc context without pricing them as damage', () => {
    const personal = statWeightCalibrationFixture('agent-billy')
    const single = evaluateDevelopmentValueBenchmarkSide({ ...personal, stale: false })
    expect(single.sourceResourceProduction32?.mechanismGrants32?.status).toBe('unknown')
    expect(
      single.sourceResourceProduction32?.mechanismGrants32?.totals[0].nominalEnergyPoints,
    ).toBeNull()
    const input = teamDynamicFixture()
    const before = JSON.stringify(input.warehouse)
    const baseline = compileTargetTeamPlanningContext(input)
    const observed = compileTargetTeamPlanningContext({
      ...input,
      calibrationObservations: {
        ...input.calibrationObservations,
        resourceGrantDeclaration32: {
          authority: 'declared_resource_triggers',
          durationSeconds: 30,
          lastTriggerAtSeconds: { 'agent-anby:anby_additional_dodge_counter_energy': null },
          sourceRefs: ['synthetic:independent-resource-observation'],
          triggers: [
            ...[0, 4, 5].map((atSeconds, i) => ({
              id: `anby-hit:${i}`,
              providerAgentId: 'agent-anby',
              mechanism: 'anby_additional_dodge_counter_energy' as const,
              atSeconds,
              sourceRefs: ['synthetic:confirmed-dodge-counter-hit'],
            })),
            {
              id: 'nicole-ultimate',
              providerAgentId: 'agent-nicole',
              mechanism: 'reviewed_support_ultimate_energy',
              atSeconds: 12,
              nextSwitchIn: { agentId: 'agent-anby', atSeconds: 15 },
              sourceRefs: ['synthetic:ultimate-then-next-switch'],
            },
          ],
        },
      },
    })
    if (baseline.status !== 'supported' || observed.status !== 'supported')
      throw new Error('actual team context unavailable')
    const production = observed.memberSourceResourceProduction32.find(
      (row) => row.agentId === 'agent-anby',
    )!
    const totals = production.mechanismGrants32!.totals.find((row) => row.agentId === 'agent-anby')!
    expect(totals.nominalEnergyPoints).toBeCloseTo(44.4, 9)
    expect(production.gamePoints.energy).toBeNull()
    expect(observed.totalDamage).toBe(baseline.totalDamage)
    expect(observed.fingerprint).not.toBe(baseline.fingerprint)
    expect(JSON.stringify(input.warehouse)).toBe(before)
  })
  it('carries Yidhari declared HP-loss decibels in the real personal comparison without changing damage', () => {
    const input = statWeightCalibrationFixture('agent-billy')
    const actor = input.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
    actor.agentId = 'agent-yidhari'
    actor.mindscape = 0
    input.warehouse.roster.agents = input.warehouse.roster.agents.filter(
      (row) => row.agentId !== actor.agentId || row === actor,
    )
    const before = JSON.stringify(input.warehouse)
    const baseInput = { ...input, agentId: actor.agentId, stale: false }
    const baseline = evaluateDevelopmentValueBenchmarkSide(baseInput)
    const observed = evaluateDevelopmentValueBenchmarkSide({
      ...baseInput,
      resourceGrantDeclaration32: {
        authority: 'declared_resource_triggers',
        durationSeconds: 30,
        lastTriggerAtSeconds: {},
        sourceRefs: ['synthetic:observed-hp-loss'],
        triggers: [
          {
            id: 'hp-loss',
            providerAgentId: actor.agentId,
            mechanism: 'yidhari_hp_loss_decibels',
            atSeconds: 2,
            hpLossPercent: 30,
            sourceRefs: ['synthetic:loss-relative-to-current-max-hp'],
          },
        ],
      },
    })
    expect(observed.state, observed.reasons.join(';')).toBe('supported')
    expect(
      observed.sourceResourceProduction32?.mechanismGrants32?.totals[0].nominalDecibelPoints,
    ).toBe(300)
    expect(observed.sourceResourceProduction32?.gamePoints.decibels).toBeNull()
    expect(observed.totalDamage).toBe(baseline.totalDamage)
    expect(observed.totalDamage).toBeGreaterThan(0)
    expect(JSON.stringify(input.warehouse)).toBe(before)
  })
  it('uses Yuzuha actual account chain level in the eighteen-disc resource context', () => {
    const input = teamDynamicFixture()
    const original = input.candidate.memberIds[0]
    const replacement = 'agent-yuzuha'
    input.candidate.memberIds[0] = replacement
    input.fit.memberIds = input.candidate.memberIds
    input.fit.loadouts[0]!.agentId = replacement
    input.parameters.wEngines.find((row) => row.agentId === original)!.agentId = replacement
    const actor = input.warehouse.roster.agents.find((row) => row.agentId === original)!
    actor.agentId = replacement
    actor.mindscape = 0
    actor.skillLevels = { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 }
    input.warehouse.roster.agents = input.warehouse.roster.agents.filter(
      (row) => row.agentId !== replacement || row === actor,
    )
    const before = JSON.stringify(input.warehouse)
    const baseline = compileTargetTeamPlanningContext(input)
    const observed = compileTargetTeamPlanningContext({
      ...input,
      calibrationObservations: {
        ...input.calibrationObservations,
        resourceGrantDeclaration32: {
          authority: 'declared_resource_triggers',
          durationSeconds: 30,
          lastTriggerAtSeconds: {},
          sourceRefs: ['synthetic:yuzuha-ultimate'],
          triggers: [
            {
              id: 'yuzuha-ultimate',
              providerAgentId: replacement,
              mechanism: 'yuzuha_ultimate_energy',
              atSeconds: 2,
              sourceRefs: ['synthetic:source-ultimate'],
            },
          ],
        },
      },
    })
    if (baseline.status !== 'supported' || observed.status !== 'supported')
      throw new Error(
        [
          ...(baseline.status !== 'supported' ? baseline.blockers : []),
          ...(observed.status !== 'supported' ? observed.blockers : []),
        ].join(';'),
      )
    const points = observed.memberSourceResourceProduction32[0].mechanismGrants32!.totals
    expect(points.map((row) => row.nominalEnergyPoints)).toEqual([0, 23.5, 23.5])
    expect(observed.totalDamage).toBe(baseline.totalDamage)
    expect(observed.fingerprint).not.toBe(baseline.fingerprint)
    expect(JSON.stringify(input.warehouse)).toBe(before)
  })
  it('uses complete event impact instead of rejecting a compensated raw-impact loss', () => {
    const capacity = (initialImpact: number, combatImpact: number) => {
      const member = createLevel60NeutralEffectRuntimeMember('agent-dialyn')
      member.coreLevel = 7
      member.potential = 0
      member.initialStats = { ...member.initialStats, impact: initialImpact, crit_: 0.6 }
      const trace = evaluateReviewedDialynInitialImpact32({
        initialCritRate: 0.6,
        coreLevel: 7,
        potential: 0,
      })
      if (trace.status !== 'supported') throw new Error(trace.blockers.join(';'))
      member.finalStats = {
        ...member.initialStats,
        impact: initialImpact + trace.impactIncrease,
        initialImpactConversion32: trace,
      }
      const result = evaluateReviewedFunctionalCapacity32({
        member,
        eventUsages: [
          {
            ownerAgentId: member.agentId,
            eventId: 'basic.BasicAttackHappyToBeOfService.hit-0',
            skillLevel: 12,
            occurrenceCount: 2,
            evidenceRefs: ['same-source-event:compensated-impact'],
          },
        ],
        equipmentExclusions: [],
        equipmentModifierBuckets: [
          {
            bucketId: `explicit-functional-impact:${combatImpact}`,
            effectKey: `explicit-functional-impact:${combatImpact}`,
            providerAgentId: member.agentId,
            recipientAgentIds: [member.agentId],
            application: 'impact_percent',
            receiverPath: null,
            damageType: null,
            action: null,
            attribute: null,
            value: combatImpact,
            sourceRefs: ['synthetic:explicit-known-impact-effect'],
          },
        ],
      })
      expect(result.status).toBe('supported')
      return { capacities: result.capacities, raw: member.finalStats.impact! }
    }
    const before = capacity(100, 0),
      after = capacity(95, 0.2)
    expect(before.capacities[0]!.value).toBeCloseTo(120 * (0.194 + 0.009 * 11) * 2)
    expect(after.capacities[0]!.value).toBeCloseTo(134 * (0.194 + 0.009 * 11) * 2)
    expect(after.raw).toBeLessThan(before.raw)
    const input = {
      baselineCapacities: before.capacities,
      candidateCapacities: after.capacities,
      baselineUtility: new Map([['agent-dialyn', [before.raw, 1, 100, 100]]]),
      candidateUtility: new Map([['agent-dialyn', [after.raw, 1, 100, 100]]]),
    }
    expect(preservesTeamFunctionalConstraints32(input)).toBe(true)
    expect(
      preservesTeamFunctionalConstraints32({
        ...input,
        candidateUtility: new Map([['agent-dialyn', [after.raw, 1, 100, 99]]]),
      }),
    ).toBe(false)
    expect(
      preservesTeamFunctionalConstraints32({
        ...input,
        baselineCapacities: [],
        candidateCapacities: [],
      }),
    ).toBe(false)
  })

  it.each(['agent-seth', 'agent-caesar', 'agent-dialyn', 'agent-ben'])(
    '%s carries the declared same-action capacity through the personal comparison',
    (agentId) => {
      const input = statWeightCalibrationFixture('agent-billy')
      const actor = input.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
      actor.agentId = agentId
      const before = JSON.stringify(input.warehouse)
      const result = evaluateDevelopmentValueBenchmarkSide({
        ...input,
        agentId,
        stale: false,
      })
      expect(result.state, result.reasons.join(';')).toBe('supported')
      expect(result.functionalCapacities32?.status).toBe('supported')
      const energy = result.functionalCapacities32!.capacities.find(
        (row) => row.kind === 'natural_energy_recovery_rate',
      )!
      expect(energy.value).toBeGreaterThan(0)
      expect(result.sourceResourceProduction32).toMatchObject({
        sourceStatus: 'supported',
        agentId,
        energy: { unit: 'upstream_SpRecovery' },
        decibels: { unit: 'upstream_FeverRecovery' },
        gamePoints: { energy: null, decibels: null },
      })
      const capacity = result.functionalCapacities32!.capacities[0]!
      expect(capacity.key).toContain(agentId)
      expect(capacity.value).toBeGreaterThan(0)
      expect(capacity.excluded).not.toHaveLength(0)
      const projected = projectNormalizedAccountFinalStatsDetailed({
        agent: actor,
        engineId: actor.wEngineDetails.id!,
        discs: input.discs,
      })
      if (projected.status !== 'supported') throw new Error(projected.reasons.join(';'))
      if (agentId === 'agent-seth')
        expect(capacity.value).toBeCloseTo(
          Math.min(3000, projected.stats.initialStats.atk * 0.8),
          9,
        )
      if (agentId === 'agent-caesar')
        expect(capacity.value).toBeCloseTo(projected.stats.initialStats.impact * 14 + 1400, 9)
      if (agentId === 'agent-ben') {
        expect(capacity.value).toBeCloseTo(projected.stats.finalStats.hp * 0.16, 9)
        expect(
          result.functionalCapacities32!.capacities.find(
            (row) => row.key === 'agent-ben:core_shield',
          )?.value,
        ).toBeCloseTo(projected.stats.finalStats.def * 0.3 + 550, 9)
      }
      expect(
        preservesReviewedFunctionalCapacities32([capacity], [{ ...capacity, value: null }]),
      ).toBe(false)
      expect(
        preservesReviewedFunctionalCapacities32(
          [capacity],
          [{ ...capacity, value: capacity.value! - 1 }],
        ),
      ).toBe(false)
      expect(JSON.stringify(input.warehouse)).toBe(before)
    },
  )

  it('carries Seth generation capacity with the real eighteen-disc team context', () => {
    const input = teamDynamicFixture()
    const original = input.candidate.memberIds[0]
    const replacement = 'agent-seth'
    input.candidate.memberIds[0] = replacement
    input.fit.memberIds = input.candidate.memberIds
    input.fit.loadouts[0]!.agentId = replacement
    input.parameters.wEngines.find((row) => row.agentId === original)!.agentId = replacement
    const actor = input.warehouse.roster.agents.find((row) => row.agentId === original)!
    actor.agentId = replacement
    actor.mindscape = 0
    actor.potentialImage = 0
    actor.skillLevels = { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 }
    // The full original owned roster may already contain Seth; use exactly one
    // identity, retaining the same synthetic physical eighteen-disc assignment.
    input.warehouse.roster.agents = input.warehouse.roster.agents.filter(
      (row) => row.agentId !== replacement || row === actor,
    )
    const before = JSON.stringify(input)
    const result = compileTargetTeamPlanningContext(input)
    expect(result.status).toBe('supported')
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(result.memberSourceResourceProduction32.map((row) => row.agentId)).toEqual(
      input.candidate.memberIds,
    )
    expect(
      result.memberSourceResourceProduction32.every(
        (row) => row.sourceStatus === 'supported' && row.gamePoints.energy === null,
      ),
    ).toBe(true)
    const capacity = result.memberFunctionalCapacities32
      .flatMap((row) => row.capacities)
      .find((row) => row.key === 'agent-seth:shield_generation')!
    expect(capacity.kind).toBe('shield_generation')
    expect(capacity.value).toBeGreaterThan(0)
    expect(capacity.excluded).toContain('current_shield_and_holder')
    expect(JSON.stringify(input)).toBe(before)
  })
})
