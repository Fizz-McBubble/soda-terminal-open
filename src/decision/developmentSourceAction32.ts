import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { compileReviewedRoxyHeldAction32 } from '../calculation/reviewedRoxyHeldAction32'
import { compileReviewedClaretPreparedBenchmark32 } from '../calculation/reviewedClaretFixedBenchmark32'
import { compileReviewedKoledaPreparedBenchmark32 } from '../calculation/reviewedKoledaPreparedBenchmark32'
import { stableContentHash } from '../gameDataPacks/types'

/** Reuse the existing declared comparison. Source inventories and prepared
 * actions remain distinct from a certified resource/time combat rotation. */
export function developmentSourceAction32(member: PlanningEffectRuntimeMember) {
  if (member.agentId === 'agent-koleda') {
    const preparation = {
      furnaceFire: 1,
      priorConsumptionBuffRemainingSeconds: 30,
      energy: 0,
      energyCapacity: 120,
      charge: 0,
    }
    const compiled = compileReviewedKoledaPreparedBenchmark32({
      ...member,
      preparedState: preparation,
      conditions: {
        benAbsent: true,
        completeContact: true,
        uninterruptedBasicChain: true,
        constantDamageState: true,
      },
    })
    if (compiled.status !== 'supported') return compiled
    const policyId = 'personal-koleda-prepared-enhanced-basic-30s-r1'
    return {
      status: 'supported' as const,
      policyId,
      // Potential and its derived buffs belong to actual runtime/stat identity,
      // not the common action policy which both sides of that comparison share.
      identity: stableContentHash({ policyId, preparation, source: compiled.sourceIdentity }),
      eventUsages: compiled.eventUsages,
      resourceLegality: compiled.resourceLegality,
      runtimeInput: {
        eventUsages: compiled.eventUsages,
        baselineReferences: compiled.baselineReferencesByAgentId['agent-koleda'],
      },
      equipmentRuntime: undefined,
      boundary: compiled.boundary,
    }
  }
  if (
    !['agent-roxy', 'agent-claret'].includes(member.agentId) ||
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    (member.potential != null && member.potential !== 0)
  )
    return null
  if (member.agentId === 'agent-claret') {
    const compiled = compileReviewedClaretPreparedBenchmark32({
      mindscape: member.mindscape,
      potential: member.potential,
      coreLevel: member.coreLevel,
      skillLevels: member.skillLevels ?? {},
    })
    if (compiled.status === 'unsupported') return compiled
    // This comparison starts immediately after EX has entered Crimson. Its
    // damage is outside this slice, but the sourced 10s/40s engine windows
    // already exist; a normal Special must not erase that prepared trigger.
    const preparation = { exSpecialUsed: true, exSpecialAgeSeconds: 0 }
    const eventUsages = compiled.eventUsages
    const policyId = 'personal-claret-prepared-held-subduing-axe-30s-r1'
    const equipmentRuntime: CurrentWEngineFormulaRuntime = {
      flags: {
        'LunarSemiluna:exSpecialUsed': true,
        'CattyLuck:exSpecialUsed': true,
        'CrimsonThirst:exSpecialMaim': true,
      },
    }
    return {
      status: 'supported' as const,
      policyId,
      identity: stableContentHash({
        policyId,
        preparation,
        source: compiled.sourceIdentity,
        resource: compiled.resourceLegality,
        boundary: compiled.boundary,
      }),
      eventUsages,
      resourceLegality: compiled.resourceLegality,
      runtimeInput: {
        eventUsages,
        baselineReferences: { crimsonInscription: true, perfectDodge: false },
      },
      equipmentRuntime,
      boundary: compiled.boundary,
    }
  }
  if (!Number.isFinite(member.initialStats.enerRegen) || member.initialStats.enerRegen < 0)
    return { status: 'unsupported' as const, blockers: ['invalid_roxy_actual_energy_regen'] }
  const action = {
    kind: 'roxy_prepared_held' as const,
    holdDurationSeconds: 1,
    preparedState: {
      energy: 120,
      energyCapacity: 120,
      windEnergy: 3,
      groundEyes: 0,
      energyConsumptionAccumulator: 0,
    },
    conditions: {
      directDamageContacts: true,
      createdEyes: 3,
      simultaneousHammerEyeContacts: 3,
      hammerBeforeEyeExpiry: true,
      eyeBlastContacts: 3,
      giantWindstormContactSeconds: 1,
      constantDamageState: true,
      uninterruptedWhirlwind: true,
      fullWhirlwindContact: true,
      releaseWithoutJoystickMovement: true,
    },
  }
  const compiled = compileReviewedRoxyHeldAction32({
    ...action,
    mindscape: member.mindscape,
    conditions: {
      ...action.conditions,
      afterechoContactSeconds: 2,
      afterechoCompletesWithinWindow: true,
    },
    skillLevel: member.skillLevels?.special ?? Number.NaN,
  })
  if (compiled.status === 'unsupported')
    return { status: 'unsupported' as const, blockers: compiled.reasons }
  const resourceLegality = {
    ...compiled.resourceLegality,
    actualEnergyRegenPerSecond: member.initialStats.enerRegen,
    preparationAuthority: 'declared-comparison-prepared-state-not-current-battle-resources',
  }
  const policyId = 'personal-roxy-prepared-held-one-second-30s-r1'
  const equipmentRuntime: CurrentWEngineFormulaRuntime = {
    flags: { 'CrimsonMoonCasket:windExSpecialUsed': true },
  }
  return {
    status: 'supported' as const,
    policyId,
    identity: stableContentHash({
      policyId,
      action,
      source: compiled.sourceIdentity,
      resource: compiled.resourceLegality,
      boundary: compiled.boundaries,
    }),
    eventUsages: compiled.eventUsages,
    resourceLegality,
    runtimeInput: {
      eventUsages: compiled.eventUsages,
      baselineReferences: {
        roxyPreparedHeld32: 'personal',
        kindlyHits: false,
        chillHits: false,
      },
    },
    equipmentRuntime,
    boundary:
      '30秒声明比较窗口内计一次准备态长按1秒及释放；M6另计3秒、6秒后的两次风暴，均完整接触并处于窗口内。触发前后分别结算，不换人续转；120初始能量足够，不代表完整整队轮转或实测占场时间。',
  }
}
