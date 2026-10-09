import type {
  evaluateReviewedFunctionalCapacity32,
  ReviewedFunctionalCapacity32,
} from './reviewedFunctionalCapacity32'
import { canonicalJson, sha256 } from '../application/contentHash'
import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { matchesFunctionalEffectScope32 } from './functionalPlanningEffectScope32'
import { applicationForReceiver, recipientIds } from './currentPlanningDamageModifiers'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

export const reviewedBenShieldCapacityIdentity32 = Object.freeze({
  revision: 'declared-source-ben-shield-capacity-r1',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Ben.ts',
  formulaSha256: '395B208714B28F4B9FCDDCC6FD328424443E8AC42147D1E4DD68569E0E3A7FDF',
  specialShield: Object.freeze({
    inputId: 'special_shield',
    locator: 'Ben.ts:111',
    expressionSha256: '8B182E1985A7ED3B44009DFCDA4E8D254726B8B4E1269A578582D137EC0BBD72',
    irSha256: '284cccca0906b379148f4598a22977d93cb216bf410a26c4a8bf98885a973e03',
  }),
  coreShield: Object.freeze({
    inputId: 'core_shield',
    locator: 'Ben.ts:112',
    expressionSha256: '1AA2B4BA6093196F9C2623DF22E9204AC4C5E198F81F1BC85A766F6224AE6F6A',
    irSha256: '1ec9af12edc05cd792210d6db4f0d7d5484f348a1c64be83fe4d16ae2906b6f1',
  }),
})

const expectedCoreShieldRatios = [0.15, 0.175, 0.2, 0.225, 0.25, 0.275, 0.3] as const
const expectedCoreShieldFlats = [100, 220, 330, 460, 500, 525, 550] as const

const hpApplications = new Set(['hp_flat', 'hp_percent'])
const defApplications = new Set(['defense_flat', 'defense_percent'])
const relevantApplications = new Set(['hp_flat', 'hp_percent', 'defense_flat', 'defense_percent'])

/**
 * Declared generation capacity for Ben's EX Special Attack shield generation.
 * Evaluates both the HP-scaled self shield (`special_shield`) and DEF-scaled core shield (`core_shield`).
 * Includes applicable combat buckets and known own/team source modifiers for final HP and final DEF.
 * Unknown related conditions or source writes keep that specific capacity null.
 * Shield% equipment modifier is applied exactly once with source recipient and action checks.
 * No current shield/uptime, depletion, holder or actual DPS inference.
 */
export function evaluateReviewedBenShieldCapacity32(
  input: Parameters<typeof evaluateReviewedFunctionalCapacity32>[0],
): {
  status: 'supported' | 'unsupported'
  capacities: ReviewedFunctionalCapacity32[]
  blockers: string[]
} {
  const member = input.member
  const agentId = member.agentId

  if (agentId !== 'agent-ben') {
    return {
      status: 'supported' as const,
      capacities: [],
      blockers: [],
    }
  }

  if (
    !Number.isInteger(member.coreLevel) ||
    member.coreLevel < 1 ||
    member.coreLevel > 7 ||
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    (member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6))
  ) {
    return {
      status: 'unsupported' as const,
      capacities: [],
      blockers: ['功能容量缺少合法核心技/影画/潜能身份。'],
    }
  }

  const members = input.members ?? [member]
  const memberIds = members.map((m) => m.agentId)
  const commonBlockers: string[] = []
  const hpGaps: string[] = []
  const defGaps: string[] = []

  if (new Set(memberIds).size !== memberIds.length) {
    commonBlockers.push('事件效果缺少唯一真实成员或受益者。')
  }

  const snapshot = members.find((m) => m.agentId === agentId) ?? null
  if (stableContentHash(snapshot) !== stableContentHash(member)) {
    commonBlockers.push('functional_member_snapshot_mismatch')
  }

  const contract = getCurrentAgentDecisionMechanicContract('agent-ben')
  const source = contract?.effectContract.source
  const specialShieldInput = contract?.effectContract.functionalInputs?.find(
    (row) => row.inputId === 'special_shield',
  )
  const coreShieldInput = contract?.effectContract.functionalInputs?.find(
    (row) => row.inputId === 'core_shield',
  )
  const references: Readonly<Record<string, unknown>> =
    contract?.effectContract.runtimeDefaults.references ?? {}
  const shieldRatios = references['dm.core.shield_']
  const shieldFlats = references['dm.core.shield']

  if (
    !contract ||
    !source ||
    source.commit !== reviewedBenShieldCapacityIdentity32.commit ||
    source.formulaPath !== reviewedBenShieldCapacityIdentity32.formulaPath ||
    source.formulaSha256 !== reviewedBenShieldCapacityIdentity32.formulaSha256 ||
    specialShieldInput?.numericExpression.expressionSha256 !==
      reviewedBenShieldCapacityIdentity32.specialShield.expressionSha256 ||
    coreShieldInput?.numericExpression.expressionSha256 !==
      reviewedBenShieldCapacityIdentity32.coreShield.expressionSha256 ||
    sha256(canonicalJson(specialShieldInput.numericExpression.expressionIr)) !==
      reviewedBenShieldCapacityIdentity32.specialShield.irSha256 ||
    sha256(canonicalJson(coreShieldInput.numericExpression.expressionIr)) !==
      reviewedBenShieldCapacityIdentity32.coreShield.irSha256 ||
    !Array.isArray(shieldRatios) ||
    shieldRatios.length !== 7 ||
    !Array.isArray(shieldFlats) ||
    shieldFlats.length !== 7 ||
    !shieldRatios.every((val, idx) => val === expectedCoreShieldRatios[idx]) ||
    !shieldFlats.every((val, idx) => val === expectedCoreShieldFlats[idx])
  ) {
    return {
      status: 'unsupported' as const,
      capacities: [],
      blockers: ['功能来源或参数漂移：agent-ben'],
    }
  }

  const scope = {
    eventId: 'special.EXSpecialAttackCashflowCounter.hit-0',
    actionId: 'EXSpecialAttackCashflowCounter',
    skill: 'special',
    damageType: 'exSpecial',
  }

  const entries = currentAgentPlanningEffectBlueprints.filter((entry) => {
    if (!memberIds.includes(entry.providerAgentId)) return false
    const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const app = applicationForReceiver(meta.receiverPath)
    return (
      relevantApplications.has(app) &&
      recipientIds({
        providerAgentId: entry.providerAgentId,
        targetKinds: entry.targetKinds,
        memberIds,
        receiverPath: meta.receiverPath,
        effectKey: entry.effectKey,
      }).includes(agentId)
    )
  })

  const hpEquipmentGaps = functionalEquipmentGaps32(
    input.equipmentExclusions,
    agentId,
    ['initial.hp', 'combat.hp', 'combat.hp_'],
    [scope],
  )
  const defEquipmentGaps = functionalEquipmentGaps32(
    input.equipmentExclusions,
    agentId,
    ['initial.def', 'combat.def', 'combat.def_'],
    [scope],
  )
  const shieldEquipmentGaps = functionalEquipmentGaps32(
    input.equipmentExclusions,
    agentId,
    ['combat.shield_'],
    [scope],
  )

  const runtime = evaluateCurrentPlanningEffectEntries32(
    { memberIds, members, baselineReferencesByAgentId: input.baselineReferencesByAgentId },
    [...entries],
  )

  if (runtime.status !== 'supported') {
    commonBlockers.push(...runtime.blockers)
  } else {
    for (const row of runtime.results) {
      if (row.status !== 'excluded_unknown') continue
      const entry = entries.find((e) => e.effectKey === row.effectKey)
      if (!entry) continue
      const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
      if (matchesFunctionalEffectScope32(entry, scope, 'fire')) {
        const app = applicationForReceiver(meta.receiverPath)
        const gap = `functional_condition_unobserved:${row.effectKey}`
        if (hpApplications.has(app)) hpGaps.push(gap)
        if (defApplications.has(app)) defGaps.push(gap)
      }
    }
  }

  const baseBuckets =
    runtime.status === 'supported' ? planningRuntimeEffectBuckets32(runtime.results, memberIds) : []

  const resolved = resolveCurrentPlanningEventEffects32({
    memberIds,
    members,
    ownerAgentId: agentId,
    event: scope,
    attribute: 'fire',
    entries,
    buckets: [...baseBuckets, ...(input.equipmentModifierBuckets ?? [])],
    baselineReferencesByAgentId: input.baselineReferencesByAgentId,
  })

  let finalHp = member.finalStats.hp
  let finalDef = member.finalStats.def

  if (resolved.status !== 'supported') {
    commonBlockers.push(...resolved.blockers)
  } else {
    const statsHp = resolved.finalStats[agentId]?.hp
    const statsDef = resolved.finalStats[agentId]?.def

    if (typeof statsHp !== 'number' || !Number.isFinite(statsHp) || statsHp < 0) {
      hpGaps.push('functional_final_hp_invalid')
    } else {
      finalHp = statsHp
    }

    if (typeof statsDef !== 'number' || !Number.isFinite(statsDef) || statsDef < 0) {
      defGaps.push('functional_final_def_invalid')
    } else {
      finalDef = statsDef
    }
  }

  const action = 'ex_special'
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
    !members.some((actor) => actor.agentId === row.providerAgentId) ||
    row.recipientAgentIds.some((id) => !members.some((actor) => actor.agentId === id)) ||
    (row.sourceFormula?.finalStatReferences.length ?? 0) > 0
      ? ['functional_shield_modifier_observation_unresolved']
      : [],
  )

  const shieldMultiplier = 1 + shieldBuckets.reduce((sum, row) => sum + row.value, 0)
  if (!Number.isFinite(shieldMultiplier) || shieldMultiplier < 0) {
    commonBlockers.push('functional_shield_multiplier_invalid')
  }

  const actor = {
    agentId,
    level: member.level ?? null,
    coreLevel: member.coreLevel,
    mindscape: member.mindscape,
    potential: member.potential ?? null,
  }
  const allBlockers: string[] = []
  const capacities: ReviewedFunctionalCapacity32[] = [
    {
      sourceInput: specialShieldInput,
      stat: 'hp',
      value: finalHp,
      applications: hpApplications,
      gaps: [...hpEquipmentGaps, ...hpGaps],
    },
    {
      sourceInput: coreShieldInput,
      stat: 'def',
      value: finalDef,
      applications: defApplications,
      gaps: [...defEquipmentGaps, ...defGaps],
    },
  ].map(({ sourceInput, stat, value, applications, gaps }) => {
    const result = evaluateUpstreamExpressionIr(
      sourceInput.numericExpression.expressionIr as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: {
          ...references,
          'char.core': member.coreLevel - 1,
          'char.mindscape': member.mindscape,
          ['own.final.' + stat]: value,
        },
      }),
    )
    const errors = [...commonBlockers, ...shieldEquipmentGaps, ...shieldBucketGaps, ...gaps]
    if (result.status !== 'supported') errors.push(...result.blockers)
    else if (typeof result.value !== 'number' || !Number.isFinite(result.value) || result.value < 0)
      errors.push('护盾生成值必须是有限非负数。')
    allBlockers.push(...errors)
    const consumed =
      resolved.status === 'supported'
        ? resolved.buckets.filter(
            (row) => row.recipientAgentIds.includes(agentId) && applications.has(row.application),
          )
        : []
    return {
      key: agentId + ':' + sourceInput.inputId,
      kind: 'shield_generation',
      value:
        errors.length || result.status !== 'supported'
          ? null
          : Number(result.value) * shieldMultiplier,
      contextKey: stableContentHash({
        actor,
        declaration: 'declared_one_self_EXSpecialAttackCashflowCounter_' + sourceInput.inputId,
        expressionSha256: sourceInput.numericExpression.expressionSha256,
        source,
        identity: reviewedBenShieldCapacityIdentity32.revision,
      }),
      sourceRefs: [
        ...new Set([
          source.formulaPath + '#' + source.formulaSha256 + '#' + sourceInput.locator,
          'source-commit:' + source.commit,
          'functional-expression:' + sourceInput.numericExpression.expressionSha256,
          ...shieldBuckets.flatMap((row) => row.sourceRefs),
          ...consumed.flatMap((row) => row.sourceRefs),
        ]),
      ],
      included: [
        'one_declared_source_generation_capacity',
        'completed_initial_panel',
        'event_final_' + stat + '_with_combat_modifiers',
        ...shieldBuckets.map((row) => row.effectKey),
        ...consumed.map((row) => row.effectKey),
      ],
      excluded: [
        ...new Set(errors),
        'current_shield_and_holder',
        'resource_cost_and_action_acquisition',
        'shield_refresh_damage_depletion_and_uptime',
        'shield_to_damage_conversion',
      ],
    }
  })
  return { status: 'supported', capacities, blockers: [...new Set(allBlockers)] }
}
