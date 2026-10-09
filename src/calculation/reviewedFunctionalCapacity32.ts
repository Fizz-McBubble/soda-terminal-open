import { evaluateSourceDazeCapacity32 } from './sourceDazeCapacity32'
import { evaluateSourceEnergyRecoveryRate32 } from './sourceEnergyRecoveryRate32'
import { evaluateReviewedBenShieldCapacity32 } from './reviewedBenShieldCapacity32'
import { canonicalJson, sha256 } from '../application/contentHash'
import { stableContentHash } from '../gameDataPacks/types'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import { bindReviewedFunctionalSource32 } from './reviewedFunctionalSource32'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

export type ReviewedFunctionalCapacity32 = {
  key: string
  kind: 'shield_generation' | 'source_daze_basis' | 'natural_energy_recovery_rate'
  value: number | null
  contextKey: string
  sourceRefs: string[]
  included: string[]
  excluded: string[]
}
const ref = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })
const number = (value: number): UpstreamExpressionIR => ({ kind: 'literal', value })
const call = (operator: string, ...args: UpstreamExpressionIR[]): UpstreamExpressionIR => ({
  kind: 'call',
  operator,
  arguments: args,
})
const core = (path: string) => call('subscript', ref('char.core'), ref(path))
const sethM1 = call(
  'cmpGE',
  ref('char.mindscape'),
  number(1),
  call('sum', ref('dm.m1.shield_'), number(1)),
  number(1),
)
// Pinned customShield value AST. Seth's final.atk is deliberately reconciled
// against core.desc[0..6] initial ATK; raw formula identity is retained below.
const shieldIr = {
  'agent-seth': call(
    'min',
    call('prod', ref('dm.core.max_shield'), sethM1),
    call('prod', ref('own.initial.atk'), core('dm.core.shield'), sethM1),
  ),
  'agent-caesar': call(
    'sum',
    call('prod', ref('own.initial.impact'), core('dm.core.shield_')),
    core('dm.core.shield'),
  ),
} as const
export const reviewedFunctionalCapacityIdentity32 = Object.freeze({
  revision: 'declared-source-functional-equipment-dependencies-r3',
  sethReconciliation: {
    originalStat: 'own.final.atk',
    effectiveStat: 'own.initial.atk',
    path: 'libs/zzz/dm-localization/assets/locales/en/char_Seth_gen.json',
    sha256: 'BCEF2930F2D5F67DF69DDE88C559A11DE3C1B285F33E89F4B5C98070704E3802',
    locator: 'core.desc[0..6];mindscapes.1.desc',
  },
  daze: {
    path: 'libs/zzz/formula/src/data/common/daze.ts',
    sha256: 'F913FD26980DB39055F3E1FD0E42B0CC887C86068B3536415927046A65397752',
    locator: 'formula.dazeBuildup:source-base-times-final-impact',
  },
})

/** Internal function constraints use the same declared action on both sides.
 * No present shield, recipient, enemy factor, uptime or damage is inferred. */
type FunctionalCapacityInput32 = {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  eventUsages?: readonly PlanningEventUsage[]
  equipmentModifierBuckets?: readonly SourceBackedPlanningEffectBucket[]
  /** Explicit [] means checked; absence means unknown, never zero equipment effects. */
  equipmentExclusions?: readonly unknown[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

export function evaluateReviewedFunctionalCapacity32(input: FunctionalCapacityInput32) {
  const action = evaluateDeclaredActionFunctionalCapacity32(input)
  if (action.status !== 'supported') return action
  const energy = evaluateSourceEnergyRecoveryRate32(input)
  return {
    status: 'supported' as const,
    capacities: [...action.capacities, ...energy.capacities],
    blockers: [...action.blockers, ...energy.blockers],
  }
}

function evaluateDeclaredActionFunctionalCapacity32(input: FunctionalCapacityInput32) {
  const member = input.member
  const capacities: ReviewedFunctionalCapacity32[] = []
  if (member.agentId === 'agent-ben') {
    const shield = evaluateReviewedBenShieldCapacity32(input)
    if (shield.status !== 'supported') return shield
    const daze = evaluateSourceDazeCapacity32(input)
    return {
      status: daze.status,
      capacities: [...shield.capacities, ...daze.capacities],
      blockers: [...shield.blockers, ...daze.blockers],
    }
  }
  if (!['agent-seth', 'agent-caesar', 'agent-dialyn'].includes(member.agentId))
    return evaluateSourceDazeCapacity32(input)
  if (
    !Number.isInteger(member.coreLevel) ||
    member.coreLevel < 1 ||
    member.coreLevel > 7 ||
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    (member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6))
  )
    return {
      status: 'unsupported' as const,
      capacities,
      blockers: ['功能容量缺少合法核心技/影画/潜能身份。'],
    }
  const agentId = member.agentId as 'agent-seth' | 'agent-caesar' | 'agent-dialyn'
  const source = bindReviewedFunctionalSource32(agentId)
  if (source.status !== 'supported') return { ...source, capacities }
  const equipmentGaps = functionalEquipmentGaps32(
    input.equipmentExclusions,
    agentId,
    agentId === 'agent-seth'
      ? ['initial.atk', 'combat.shield_']
      : agentId === 'agent-caesar'
        ? ['initial.impact', 'combat.shield_']
        : ['initial.crit_', 'initial.impact', 'combat.impact', 'combat.impact_'],
    agentId === 'agent-dialyn'
      ? (input.eventUsages ?? [])
          .filter((row) => row.ownerAgentId === agentId)
          .map((row) => ({ actionId: row.eventId.split('.')[1], skill: row.eventId.split('.')[0] }))
      : [
          {
            actionId:
              agentId === 'agent-seth'
                ? 'EXSpecialAttackThunderShieldRushHighVoltage'
                : 'ChainAttack',
            skill: agentId === 'agent-seth' ? 'special' : 'chain',
          },
        ],
  )
  const actor = {
    agentId,
    level: member.level ?? null,
    coreLevel: member.coreLevel,
    mindscape: member.mindscape,
    potential: member.potential ?? null,
  }
  if (agentId !== 'agent-dialyn') {
    const declaration =
      agentId === 'agent-seth'
        ? 'declared_one_self_EXSpecialAttackThunderShieldRushHighVoltage_shield'
        : 'declared_one_ChainAttack_generated_shared_RadiantAegis_pool'
    const ir = shieldIr[agentId]
    const expressionSha256 = sha256(canonicalJson(ir))
    const sourceRefs = [...source.sourceRefs, `functional-expression:${expressionSha256}`]
    if (agentId === 'agent-seth')
      sourceRefs.push(
        `${reviewedFunctionalCapacityIdentity32.sethReconciliation.path}#${reviewedFunctionalCapacityIdentity32.sethReconciliation.sha256}#${reviewedFunctionalCapacityIdentity32.sethReconciliation.locator}`,
      )
    const result = evaluateUpstreamExpressionIr(
      ir,
      createPlanningExpressionDomainRuntime({
        references: {
          ...source.references,
          'char.core': member.coreLevel - 1,
          'char.mindscape': member.mindscape,
          'own.initial.atk': member.initialStats.atk,
          'own.initial.impact': member.initialStats.impact,
        },
      }),
    )
    const action = agentId === 'agent-seth' ? 'ex_special' : 'chain'
    const shieldBuckets = (input.equipmentModifierBuckets ?? []).filter(
      (row) =>
        row.application === 'shield_percent' &&
        row.recipientAgentIds.includes(agentId) &&
        (row.action === null || row.action === action),
    )
    const shieldBucketGaps = shieldBuckets.flatMap((row) =>
      !Number.isFinite(row.value) ||
      row.attribute !== null ||
      row.damageType !== null ||
      row.applicationScope === 'event_only' ||
      !(input.members ?? [member]).some((actor) => actor.agentId === row.providerAgentId) ||
      row.recipientAgentIds.some(
        (id) => !(input.members ?? [member]).some((actor) => actor.agentId === id),
      ) ||
      (row.sourceFormula?.finalStatReferences.length ?? 0) > 0
        ? ['functional_shield_modifier_observation_unresolved']
        : [],
    )
    const shieldMultiplier = 1 + shieldBuckets.reduce((sum, row) => sum + row.value, 0)
    const blockers =
      result.status !== 'supported'
        ? result.blockers
        : typeof result.value !== 'number' || !Number.isFinite(result.value) || result.value < 0
          ? ['护盾生成值必须是有限非负数。']
          : []
    blockers.push(...shieldBucketGaps)
    if (!Number.isFinite(shieldMultiplier) || shieldMultiplier < 0)
      blockers.push('functional_shield_multiplier_invalid')
    sourceRefs.push(...shieldBuckets.flatMap((row) => row.sourceRefs))
    capacities.push({
      key: `${agentId}:shield_generation`,
      kind: 'shield_generation',
      value:
        blockers.length || equipmentGaps.length || result.status !== 'supported'
          ? null
          : Number(result.value) * shieldMultiplier,
      contextKey: stableContentHash({
        actor,
        declaration,
        expressionSha256,
        source: source.source,
        identity: reviewedFunctionalCapacityIdentity32.revision,
      }),
      sourceRefs,
      included: [
        'one_declared_source_generation_capacity',
        'completed_initial_panel',
        ...(agentId === 'agent-seth' ? ['source_m1_shield_amount_and_cap_multiplier'] : []),
        ...shieldBuckets.map((row) => row.effectKey),
      ],
      excluded: [
        ...equipmentGaps,
        ...blockers,
        'current_shield_and_holder',
        'resource_cost_and_action_acquisition',
        'shield_refresh_damage_depletion_and_uptime',
        'shield_to_damage_conversion',
      ],
    })
    const daze = evaluateSourceDazeCapacity32(input)
    return {
      status: 'supported' as const,
      capacities: [...capacities, ...daze.capacities],
      blockers: [...blockers, ...daze.blockers],
    }
  }
  return evaluateSourceDazeCapacity32(input)
}

/** A functional constraint cannot cancel nulls or trade away one independent capacity. */
export function preservesReviewedFunctionalCapacities32(
  baseline: readonly ReviewedFunctionalCapacity32[],
  candidate: readonly ReviewedFunctionalCapacity32[],
) {
  if (
    baseline.length !== candidate.length ||
    new Set(candidate.map((row) => row.key)).size !== candidate.length
  )
    return false
  return baseline.every((before) => {
    const after = candidate.find((row) => row.key === before.key)
    return (
      after &&
      before.contextKey === after.contextKey &&
      before.kind === after.kind &&
      before.value !== null &&
      after.value !== null &&
      Number.isFinite(before.value) &&
      Number.isFinite(after.value) &&
      after.value >= before.value
    )
  })
}
