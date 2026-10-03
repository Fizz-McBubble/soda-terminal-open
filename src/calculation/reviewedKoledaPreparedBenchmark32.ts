import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import { reviewedPlanningConditionSemanticsIdentity32 } from './reviewedPlanningConditionSemanticsIdentity32'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'

const pinned = reviewedPlanningConditionSemanticsIdentity32
export const reviewedKoledaPreparedBenchmarkIdentity32 = Object.freeze({
  revision: 'koleda-prepared-full-enhanced-basic-static-window-r1',
  kitCommit: pinned.commit,
  ...pinned.koleda,
  sourcePath: 'libs/zzz/stats/Data/Characters/Koleda.json',
  sourceSha256: '08D32A1E6A628AD342DC4F4EA6391AF15B6F8890CE47FD3884CC6BB60A49958D',
})

export type ReviewedKoledaPreparedBenchmarkInput32 = {
  mindscape: number
  potential?: number | null
  coreLevel: number
  skillLevels: Readonly<Record<string, number | null>>
  preparedState: {
    furnaceFire: number
    /** A previous, separate consumption, not the consumption in this packet. */
    priorConsumptionBuffRemainingSeconds: number
    energy: number
    energyCapacity: number
    charge: number
  }
  conditions: {
    benAbsent: boolean
    completeContact: boolean
    uninterruptedBasicChain: boolean
    constantDamageState: boolean
  }
}

/** Four complete source coefficient rows. Starting with Furnace Fire, execute
 * Basic 1 -> Basic 2 -> enhanced Basic 1 -> enhanced Basic 2 without switching.
 * An already active consumption window covers all four rows in a static
 * benchmark; this packet's own consumption refreshes it, but does not provide
 * retroactive coverage of Basic 1/2. No frame durations are inferred. */
export function compileReviewedKoledaPreparedBenchmark32(
  input: ReviewedKoledaPreparedBenchmarkInput32,
) {
  const blockers: string[] = []
  const potential = input.potential ?? 0
  const awakened = potential >= 2
  const level = Number(input.skillLevels.basic)
  if (!Number.isInteger(input.mindscape) || input.mindscape < 0 || input.mindscape > 6)
    blockers.push('unsupported_mindscape')
  if (!Number.isInteger(potential) || potential < 0 || potential > 6)
    blockers.push('unsupported_potential')
  if (!Number.isInteger(input.coreLevel) || input.coreLevel < 1 || input.coreLevel > 7)
    blockers.push('explicit_core_level_required')
  if (!Number.isInteger(level) || level < 1 || level > 16)
    blockers.push('explicit_skill_level_required:basic')
  const state = input.preparedState
  if (
    !Number.isInteger(state.furnaceFire) ||
    state.furnaceFire < 1 ||
    state.furnaceFire > (awakened ? 2 : 1)
  )
    blockers.push('legal_prepared_furnace_fire_required')
  if (
    !Number.isFinite(state.priorConsumptionBuffRemainingSeconds) ||
    state.priorConsumptionBuffRemainingSeconds < 0 ||
    state.priorConsumptionBuffRemainingSeconds > 40 ||
    (awakened && state.priorConsumptionBuffRemainingSeconds < 30)
  )
    blockers.push('prior_consumption_window_must_cover_declared_30_seconds')
  if (
    !Number.isFinite(state.energy) ||
    !Number.isFinite(state.energyCapacity) ||
    state.energyCapacity <= 0 ||
    state.energy < 0 ||
    state.energy > state.energyCapacity
  )
    blockers.push('legal_prepared_energy_required')
  if (
    !Number.isInteger(state.charge) ||
    state.charge < 0 ||
    state.charge > 2 ||
    (input.mindscape < 4 && state.charge !== 0)
  )
    blockers.push('legal_prepared_charge_required')
  for (const key of [
    'benAbsent',
    'completeContact',
    'uninterruptedBasicChain',
    'constantDamageState',
  ] as const)
    if (input.conditions[key] !== true) blockers.push(`prepared_condition_required:${key}`)
  const identity = reviewedKoledaPreparedBenchmarkIdentity32
  const sourceRef = `${identity.kitCommit}:${identity.localizationPath}#/basic/BasicAttackSmashNBash/desc`
  const eventUsages: PlanningEventUsage[] = [0, 1, 4, 5].map((index) => ({
    ownerAgentId: 'agent-koleda',
    eventId: `basic.BasicAttackSmashNBash.hit-${index}`,
    skillLevel: level,
    occurrenceCount: 1,
    evidenceRefs: [
      sourceRef,
      `${identity.kitCommit}:${identity.formulaPath}#${identity.formulaSha256}`,
      'reviewed-scenario:prepared-furnace-full-basic-chain-no-ben-constant-covered-window',
    ],
  }))
  for (const usage of eventUsages) {
    const resolved = resolveCurrentAgentEvent({ stableId: 'agent-koleda', ...usage })
    if (
      resolved.status !== 'supported' ||
      resolved.source.commit !== identity.kitCommit ||
      resolved.formulaFamily !== 'standard_direct_damage' ||
      resolved.scalingAttribute !== 'atk' ||
      resolved.damageType !== 'basic' ||
      resolved.formulaProjection !== 'source_registered' ||
      resolveSourceEventQuantity32(usage).status !== 'supported'
    )
      blockers.push(`shared_source_event_contract_mismatch:${usage.eventId}`)
  }
  if (blockers.length)
    return {
      status: 'unsupported' as const,
      blockers,
      eventUsages: [] as PlanningEventUsage[],
      sourceIdentity: identity,
    }
  return {
    status: 'supported' as const,
    eventUsages,
    sourceIdentity: identity,
    baselineReferencesByAgentId: {
      'agent-koleda': {
        // Only the enhanced SECOND hit carries consumed-stack modifier refs.
        // Inventory is deliberately omitted: it cannot stand in for consumption.
        furnaceConsumedStacks32: state.furnaceFire,
        furnaceConsumptionBuffActive32: awakened,
      },
    },
    resourceLegality: {
      legal: true as const,
      actionOrder: ['basic_1', 'basic_2', 'enhanced_basic_1', 'enhanced_basic_2'] as const,
      furnaceFire: {
        initial: state.furnaceFire,
        generated: 0,
        consumed: state.furnaceFire,
        final: 0,
      },
      consumedSnapshotEventId: 'basic.BasicAttackSmashNBash.hit-5',
      energy: {
        initial: state.energy,
        spent: 0,
        terminalRange: [state.energy, state.energyCapacity],
        exactTerminal: null,
      },
      charge: {
        initial: state.charge,
        generated: input.mindscape >= 4 ? 1 : 0,
        capacity: 2,
        final: input.mindscape >= 4 ? Math.min(2, state.charge + 1) : 0,
        consumed: 0,
      },
      consumptionWindow: {
        preparedRemainingSeconds: state.priorConsumptionBuffRemainingSeconds,
        active: awakened,
        durationSeconds: awakened ? 40 : 0,
        refreshedByThisPacket: awakened,
      },
      gash: { consumed: 0, authority: 'no-gash-consumption-in-pinned-basic-text' },
      maimEvents: 0,
      noInterveningAction: true,
      benAbsent: true,
    },
    timingAuthority: 'declared_duration_static_effect_coverage' as const,
    boundaries: {
      declaredDurationSeconds: 30,
      measuredFieldTimeSeconds: null,
      preparationDamageIncluded: false,
      wholeTeamFormal: false,
    },
    formalCyclePromotion: false as const,
    boundary:
      '准备炉火后的完整普攻前两击和两段增强普攻；P2至6已有炉火消费增伤窗口覆盖声明30秒，包内消费刷新窗口。P0/P1关闭新潜能。炉火库存与该次消费快照分开；无本、无EX、无毁伤或斩痕消费，不外推重复轮转或实测耗时。',
  }
}
