import { createCalculationContext, type CalculationContext } from './calculationContext'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { ValueBenchmarkCoverage } from './valueBenchmarkComparison'
import {
  reviewedPreparedBenchmarkCapabilities32,
  reviewedPreparedEventRows32,
} from './reviewedPreparedBenchmark32'
import { incremental32RecoveryPolicy } from '../gameDataPacks/incremental32RecoveryPolicy'
import { stableContentHash } from '../gameDataPacks/types'
import { isDamageFormula32Version } from './sharpDamageCore'

const memberIds = ['agent-claret', 'agent-roxy', 'agent-koleda'] as const
const records = memberIds.map((id) =>
  reviewedPreparedBenchmarkCapabilities32.find((row) => row.agentId === id),
)

/** Soda's declared finite comparison, not an author's measured combat rotation.
 * Source move coefficients and legal transitions are unchanged. Coverage is a
 * condition of this model; 30s is its denominator, not invented move timing. */
export const reviewedPreparedTeamConditions32 = Object.freeze({
  policyId: 'team-claret-roxy-koleda-prepared-fixed-30s-r2',
  declaredDurationSeconds: 30,
  provenance: 'derived_under_versioned_baseline',
  actionOrder: [
    'claret:complete_held_three_maim_then_subduing_axe',
    'roxy:complete_one_second_held_release_eyes_and_storm',
    'koleda:complete_basic_1_2_enhanced_1_2_without_ben',
  ],
  sameTarget: true,
  allDeclaredContacts: true,
  enemyStunned: false,
  noInterruptWithinMemberPacket: true,
  preparationDamageIncluded: false,
  repeatedRotation: false,
  sharedGash: {
    initial: 3,
    consumedByClaretHeld: 3,
    afterHeld: 0,
    laterConsumers: 0,
    unusedEndingRange: [0, 3],
  },
  claret: { crimsonDuringOwnPacket: true, remnantEdgeRemainingSeconds: 30, perfectDodge: false },
  roxy: {
    initialEnergy: 120,
    spendUpperBound: 46,
    initialWind: 3,
    initialEyes: 0,
    initialCarry: 0,
    contamination: false,
    windswept: false,
    priorWindEx: true,
    mindscapeTriggers: 'source_order_no_prior_kindly_or_chill',
    afterecho: {
      m6AdditionalStorms: 2,
      offsetsSeconds: [3, 6],
      secondsEach: 1,
      completeWithinDeclaredWindow: true,
    },
    windflow: { initial: 0, noSwitchDuringHold: true, freeHoldSeconds: 0 },
  },
  koleda: {
    initialFurnace: 1,
    consumed: 1,
    finalFurnace: 0,
    priorBuffRemainingSeconds: 30,
    buffActiveWhenPotentialAtLeast: 2,
  },
  discPreparation: { quickAssist: 'none_in_preceding_15s_or_counted_events' as const },
  equipmentCoverage: {
    policy: 'explicit_static_coverage_at_counted_events',
    // These predicates do not assert that a 10s buff lasts all 30s. The own
    // packet must finish under the prepared buff; no timestamps are fabricated.
    claretOwnPacketBeforeLunarExpirySeconds: 10,
    claretOwnPacketBeforeThirstCattyExpirySeconds: 40,
    allAlliedPacketsBeforeMoonExpirySeconds: 50,
  },
  excludedDomains: [
    'anomaly_settlement',
    'disorder',
    'daze_and_stun_timing',
    'preparation_damage',
    'bangboo',
  ],
})

export const reviewedPreparedTeamCapabilities32 = Object.freeze(
  records.every(Boolean)
    ? [
        {
          agentId: 'team:claret+roxy+koleda',
          memberIds,
          eventId: reviewedPreparedTeamConditions32.policyId,
          policyId: reviewedPreparedTeamConditions32.policyId,
          gameVersion: '3.2' as const,
          family: 'direct_and_sharp' as const,
          contextScope: 'team_prepared_fixed_event_model' as const,
          capability: 'formal_dps' as const,
          importReady: false as const,
          source: records[0]!.source,
          evidenceRefs: records.flatMap((row) => row!.evidenceRefs),
          validationRef: 'decision/preparedTrioBenchmark32.test.ts',
          contentHash: stableContentHash({ conditions: reviewedPreparedTeamConditions32, records }),
        },
      ]
    : [],
)

type SourcePacket = {
  agentId: string
  policyId: string
  identity: string
  resourceLegality: { legal: boolean }
}

// Only these named non-damage fields can be outside this finite damage model.
// Unknown direct buffs, additions, equipment conditions, etc. fail qualification.
export function isReviewedPreparedMemberDamageExclusion32(
  row: ValueBenchmarkCoverage['excludedEffects'][number],
) {
  return (
    (row.effectKey === 'agent-claret:core_initial_crit_' &&
      row.fields.includes('ownBuff.initial.crit_')) ||
    (row.effectKey === 'agent-roxy:ability_anomBuildup_' &&
      row.fields.includes('ownBuff.combat.anomBuildup_')) ||
    (row.effectKey === 'agent-roxy:core_impact' && row.fields.includes('ownBuff.combat.impact')) ||
    ([
      'agent-roxy:m2_exSpecial_dazeInc_',
      'agent-roxy:m4_ult_dazeInc_',
      'agent-roxy:m6_special_dazeInc_',
    ].includes(row.effectKey) &&
      row.fields.every((field) => /dazeInc_|outside_direct_event_formula/.test(field))) ||
    (row.effectKey === 'agent-koleda:core_dazeInc_' &&
      row.fields.includes('ownBuff.combat.dazeInc_')) ||
    (row.effectKey === 'agent-koleda:basic_dazeInc_' &&
      row.fields.includes('outside_direct_event_formula')) ||
    // Locked Hellfire Gears has only conditional Energy Regen and Impact.
    // This Koleda packet spends no energy, begins with prepared Furnace Fire,
    // and cannot price an earlier stun window; neither field changes its damage.
    (row.effectKey.startsWith('wengine:agent-koleda:wengine-14110:') &&
      row.reason === 'unobserved_conditional_effect' &&
      row.fields.length === 1 &&
      row.fields[0] === 'combat_conditions' &&
      row.sourceRefs.includes(
        'libs/zzz/formula/src/data/wengine/sheets/HellfireGears.ts#66590F7D44A057647179FEA99AB7C0ABAC8810492971E9006A0341427BE45763',
      )) ||
    (row.effectKey === 'disc:agent-koleda:set-shockstar-disco:four-piece' &&
      row.reason === 'outside_direct_damage_domain' &&
      row.fields.length === 1 &&
      row.fields[0] === 'combat.dazeInc_' &&
      row.sourceRefs.includes(
        '5E1B127B895B464FA45F4136530E5551132C70064011FEBD82A03E1F4DCFC117',
      )) ||
    (row.effectKey.startsWith('wengine:agent-roxy:wengine-14162:') &&
      row.fields.length === 1 &&
      row.fields[0] === 'combat.dazeInc_')
  )
}

/** Called only after the account-bound team compiler and shared source runtime
 * succeed. The certified number is the three-member sum, never the Bangboo-
 * inclusive legacy aggregate beside it. Existing comparison coverage remains. */
export function qualifyReviewedPreparedTeamBenchmark32(input: {
  context: CalculationContext
  members: readonly PlanningEffectRuntimeMember[]
  eventUsages: readonly PlanningEventUsage[]
  sourcePackets: readonly SourcePacket[]
  conditions: typeof reviewedPreparedTeamConditions32 | null
  references: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  coverage: ValueBenchmarkCoverage
  memberDamage: readonly { agentId: string; totalDamage: number }[]
}) {
  const capability = reviewedPreparedTeamCapabilities32[0]
  if (
    !capability ||
    incremental32RecoveryPolicy.enabled ||
    !input.conditions ||
    stableContentHash(input.conditions) !== stableContentHash(reviewedPreparedTeamConditions32) ||
    !isDamageFormula32Version(input.context.gameVersion) ||
    input.context.accountSnapshot.stale ||
    input.context.cycle?.durationSeconds !== 30 ||
    input.context.scenario.enemy?.stunMultiplier !== 1 ||
    input.context.scope.kind !== 'team' ||
    input.context.scope.agentIds.length !== 3 ||
    input.members.length !== 3 ||
    input.sourcePackets.length !== 3 ||
    input.eventUsages.length !== records.reduce((sum, row) => sum + row!.rows.length, 0) ||
    memberIds.some((id) => !input.context.scope.agentIds.includes(id)) ||
    input.coverage.excludedEffects.some((row) => !isReviewedPreparedMemberDamageExclusion32(row))
  )
    return null
  for (const id of memberIds) {
    const member = input.members.find((row) => row.agentId === id)
    const source = input.sourcePackets.find((row) => row.agentId === id)
    const record = records.find((row) => row?.agentId === id)!
    const rows = input.eventUsages.filter((row) => row.ownerAgentId === id)
    if (
      !member ||
      !source ||
      source.policyId !== record.policyId ||
      !source.resourceLegality.legal ||
      member.mindscape > record.maximumMindscape ||
      (member.potential ?? 0) > record.maximumPotential ||
      rows.length !== record.rows.length ||
      reviewedPreparedEventRows32(record, member.mindscape).some(
        ([eventId, count, duration], index) => {
          const usage = rows[index]!
          return (
            usage.eventId !== eventId ||
            usage.occurrenceCount !== count ||
            (usage.durationSeconds ?? null) !== duration ||
            usage.skillLevel !== member.skillLevels[eventId.split('.')[0]!]
          )
        },
      )
    )
      return null
  }
  const claret = input.references['agent-claret']
  const roxy = input.references['agent-roxy']
  const koleda = input.references['agent-koleda']
  if (
    claret?.crimsonInscription !== true ||
    claret.remnantEdge !== true ||
    claret.perfectDodge !== false ||
    roxy?.contamination !== false ||
    roxy.roxyPreparedHeld32 !== 'claret_roxy_koleda' ||
    roxy.windswept !== false ||
    roxy.exSpecialUsed !== true ||
    koleda?.furnaceConsumedStacks32 !== 1 ||
    koleda.furnaceConsumptionBuffActive32 !==
      (input.members.find((row) => row.agentId === 'agent-koleda')!.potential ?? 0) >= 2
  )
    return null
  if (
    input.memberDamage.length !== 3 ||
    new Set(input.memberDamage.map((row) => row.agentId)).size !== 3 ||
    input.memberDamage.some(
      (row) =>
        !memberIds.includes(row.agentId as (typeof memberIds)[number]) ||
        !Number.isFinite(row.totalDamage) ||
        row.totalDamage <= 0,
    )
  )
    return null
  const totalDamage = input.memberDamage.reduce((sum, row) => sum + row.totalDamage, 0)
  const context = createCalculationContext({
    ...input.context,
    contextId: capability.policyId,
    canonical: {
      packageId: capability.policyId,
      packageVersion: capability.contentHash,
      contentHash: capability.contentHash,
      gameVersion: input.context.gameVersion,
      status: 'formal',
      rollbackPackageId: null,
    },
    bangboo: null,
    cycle: {
      id: capability.policyId,
      durationSeconds: 30,
      complete: true,
      actionSequenceHash: stableContentHash({
        order: input.conditions.actionOrder,
        events: input.eventUsages,
        packets: input.sourcePackets,
      }),
      hitCount: null,
      buffWindowHash: stableContentHash({
        conditions: input.conditions,
        references: input.references,
        coverage: input.coverage,
      }),
    },
    evidence: [
      {
        fieldId: capability.policyId,
        status: 'formal',
        applicability: 'verified_current',
        sourceRefs: capability.evidenceRefs,
        sourceVersion: '3.2',
        requiredFor: ['formal_dps'],
        reason:
          'Named finite member event set, common legal preparation, static coverage, actual assets and independent sum.',
      },
    ],
    objective: 'formal_dps',
  })
  return {
    status: 'formal' as const,
    capability: capability.capability,
    scope: capability.contextScope,
    policyId: capability.policyId,
    sourceHash: capability.contentHash,
    contextComparisonKey: context.comparabilityKey,
    totalDamage,
    planningDps: totalDamage / 30,
    includedScope: 'three_members_declared_fixed_events_and_resolved_effects' as const,
    bangbooIncluded: false as const,
    importReady: false as const,
  }
}
