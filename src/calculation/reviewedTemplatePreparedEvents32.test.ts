import { describe, expect, it } from 'vitest'
import { prepareReviewedTemplateEvents32 } from './reviewedTemplatePreparedEvents32'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import {
  evaluateSourceBackedPersonalPlanningDps,
  evaluateSourceBackedPlanningTeamDps,
} from './currentPlanningTeamDpsRuntime'
import { fixture as teamFixture } from '../decision/targetTeamPlanningContext.testFixture'
import { compileTargetTeamPlanningContext } from '../decision/targetTeamPlanningContext'

const actor = (agentId: string) => {
  const neutral = createLevel60NeutralEffectRuntimeMember(agentId)
  const stats = { ...neutral.initialStats, atk: 3000, crit_: 0.05 }
  return { ...neutral, coreLevel: 7, initialStats: stats, finalStats: stats }
}
const events = (agentId: string) => [
  {
    ownerAgentId: agentId,
    eventId: getCurrentAgentEventContract(agentId)!.eventContract.events[0]!.eventId,
    skillLevel: 1,
    occurrenceCount: 1,
    evidenceRefs: ['fixed-event-test'],
  },
]

describe('reviewed template per-event comparison preparation', () => {
  it('declares ordinary Lucia contacts without inventing Harmony and preserves explicit unknown', () => {
    const member = actor('agent-lucia')
    const eventUsages = events(member.agentId)
    const normal = prepareReviewedTemplateEvents32({ member, eventUsages })!
    expect(normal.baselineReferences.luciaHarmonyFinalHit32).toBe(false)
    expect(normal.sourceRefs.join(' ')).toContain('#sha256=83915663')
    for (const observed of [true, null, undefined]) {
      const explicit = prepareReviewedTemplateEvents32({
        member,
        eventUsages,
        references: { luciaHarmonyFinalHit32: observed },
      })!
      expect(explicit.baselineReferences.luciaHarmonyFinalHit32).toBe(observed)
      expect(explicit.identity).not.toBe(normal.identity)
    }
  })
  it('binds exact source refs, selected event identity and explicit overrides', () => {
    const member = actor('agent-ye-shunguang')
    const eventUsages = events(member.agentId)
    const prepared = prepareReviewedTemplateEvents32({ member, eventUsages })!
    expect(prepared.baselineReferences.yeShunguangUnity32).toBe(true)
    expect(prepared.sourceRefs.some((ref) => ref.includes('#sha256=5E7A4260'))).toBe(true)
    expect(prepared.declarations[0]).toMatchObject({
      eventId: eventUsages[0]!.eventId,
      policyId: prepared.policyId,
    })
    for (const override of [false, null, undefined]) {
      const explicit = prepareReviewedTemplateEvents32({
        member,
        eventUsages,
        references: { yeShunguangUnity32: override },
      })!
      expect(explicit.baselineReferences.yeShunguangUnity32).toBe(override)
      expect(explicit.identity).not.toBe(prepared.identity)
    }
    const doubled = prepareReviewedTemplateEvents32({
      member,
      eventUsages: eventUsages.map((event) => ({ ...event, occurrenceCount: 2 })),
    })!
    expect(doubled.identity).not.toBe(prepared.identity)
    expect(
      prepareReviewedTemplateEvents32({ member, eventUsages: events('agent-sunna') }),
    ).toBeNull()
  })
  it('adds Ye core7 CR .3 and DMG .25 once, while bare/closed/unknown runtimes stay distinct', () => {
    const member = actor('agent-ye-shunguang')
    const eventUsages = events(member.agentId)
    const prepare = (references?: Record<string, unknown>) =>
      prepareReviewedTemplateEvents32({ member, eventUsages, references })!
    const evaluate = (baselineReferences?: Record<string, unknown>) =>
      evaluateSourceBackedPersonalPlanningDps({
        member,
        eventUsages,
        baseline: currentNormalizedPlanningBaseline,
        baselineReferences,
      })
    const on = evaluate(prepare().baselineReferences)
    const off = evaluate(prepare({ yeShunguangUnity32: false }).baselineReferences)
    const bare = evaluate()
    const unknown = evaluate(prepare({ yeShunguangUnity32: null }).baselineReferences)
    expect(on.status, JSON.stringify(on.status === 'unsupported' ? on : {})).toBe('supported')
    expect(off.status).toBe('supported')
    if (on.status !== 'supported' || off.status !== 'supported')
      throw new Error(JSON.stringify({ on, off }))
    expect(on.effectBuckets.filter((row) => row.effectId === 'reviewed_unity_crit32')).toHaveLength(
      1,
    )
    expect(
      on.effectBuckets.find((row) => row.effectId === 'reviewed_unity_crit32')?.value,
    ).toBeCloseTo(0.3)
    expect(
      on.effectBuckets.find((row) => row.effectId === 'reviewed_unity_damage32')?.value,
    ).toBeCloseTo(0.25)
    expect(on.totalDamage).toBeGreaterThan(off.totalDamage)
    if (bare.status === 'supported')
      expect(
        bare.sourceEffectExclusions.some((row) => row.effectKey.endsWith('reviewed_unity_crit32')),
      ).toBe(true)
    if (unknown.status === 'supported')
      expect(
        unknown.sourceEffectExclusions.some((row) =>
          row.effectKey.endsWith('reviewed_unity_crit32'),
        ),
      ).toBe(true)
  })
  it('gives Sunna initialATK3000 core7 teamATK900 without double counting and preserves false', () => {
    const memberIds = ['agent-sunna', 'agent-ye-shunguang', 'agent-billy'] as const
    const members = memberIds.map(actor)
    const eventUsages = memberIds.flatMap(events)
    const prepared = prepareReviewedTemplateEvents32({ member: members[0]!, eventUsages })!
    const evaluate = (state?: unknown) =>
      evaluateSourceBackedPlanningTeamDps({
        memberIds,
        members,
        eventUsages,
        baseline: currentNormalizedPlanningBaseline,
        baselineReferencesByAgentId: {
          'agent-sunna': state === undefined ? {} : { sunnaAngelicChordination32: state },
        },
      })
    const on = evaluate(prepared.baselineReferences.sunnaAngelicChordination32)
    const off = evaluate(false)
    expect(on.status, JSON.stringify(on.status === 'unsupported' ? on : {})).toBe('supported')
    expect(off.status).toBe('supported')
    if (on.status !== 'supported' || off.status !== 'supported')
      throw new Error(JSON.stringify({ on, off }))
    expect(
      on.effectBuckets
        .filter((row) => row.effectId === 'reviewed_angelic_chord_attack32')
        .every((row) => row.value === 900),
    ).toBe(true)
    expect(on.effectBuckets.some((row) => row.effectId === 'reviewed_angelic_chord_attack32')).toBe(
      true,
    )
    expect(on.memberDamage.reduce((total, row) => total + row.totalDamage, 0)).toBeGreaterThan(
      off.memberDamage.reduce((total, row) => total + row.totalDamage, 0),
    )
  })
  it('consumes Sunna through ordinary three-member compilation; explicit false/null retain authority', () => {
    const input = teamFixture()
    const ids: [string, string, string] = ['agent-sunna', 'agent-ye-shunguang', 'agent-billy']
    input.fit.memberIds = ids
    input.candidate.memberIds = ids
    input.fit.loadouts.forEach((loadout, index) => {
      loadout.agentId = ids[index]!
    })
    input.parameters.wEngines.forEach((engine, index) => {
      engine.agentId = ids[index]!
    })
    input.warehouse.roster.agents.forEach((agent) => {
      if (!ids.includes(agent.agentId as (typeof ids)[number])) return
      Object.assign(agent, {
        owned: true,
        level: 60,
        ascension: 5,
        mindscape: 0,
        skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
      })
    })
    const before = JSON.stringify(input)
    const on = compileTargetTeamPlanningContext(input)
    const off = compileTargetTeamPlanningContext({
      ...input,
      calibrationObservations: {
        authority: 'independent_calibration',
        id: 'explicit-window-off',
        referencesByAgentId: { 'agent-sunna': { sunnaAngelicChordination32: false } },
      },
    })
    const unknown = compileTargetTeamPlanningContext({
      ...input,
      calibrationObservations: {
        authority: 'independent_calibration',
        id: 'explicit-window-unknown',
        referencesByAgentId: { 'agent-sunna': { sunnaAngelicChordination32: null } },
      },
    })
    expect(on.status, JSON.stringify(on.status === 'unsupported' ? on : {})).toBe('supported')
    expect(off.status).toBe('supported')
    expect(unknown.status).toBe('unsupported')
    if (on.status !== 'supported' || off.status !== 'supported' || unknown.status !== 'unsupported')
      throw new Error(JSON.stringify({ on, off, unknown }))
    expect(on.coverage.includedEffectKeys).toContain('agent-sunna:reviewed_angelic_chord_attack32')
    expect(on.totalDamage).toBeGreaterThan(off.totalDamage)
    expect(on.contextFingerprint).not.toBe(off.contextFingerprint)
    expect(on.fingerprint).not.toBe(unknown.fingerprint)
    expect(unknown.blockers.some((reason) => reason.includes('sunnaAngelicChordination32'))).toBe(
      true,
    )
    expect(on.coverage.boundary).toContain('逐事件窗口比较准备态')
    expect(JSON.stringify(input)).toBe(before)
  })
})
