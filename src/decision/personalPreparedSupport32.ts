import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { ReviewedFunctionalCapacity32 } from '../calculation/reviewedFunctionalCapacity32'
import type { SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import { functionalEquipmentGaps32 } from '../calculation/reviewedFunctionalEquipmentDependencies32'
import { reviewedContextualMechanicTargets } from '../gameDataPacks/reviewedContextualTargetPanel'
import { stableContentHash } from '../gameDataPacks/types'
import mechanics from '../gameDataPacks/generated/current-agent-decision-mechanic-catalog.v1.json'
import targetFields from '../gameDataPacks/data/reviewed-external-support-target31.3.1.json'
import { getCurrentAgentPlanningEffectBlueprint } from '../calculation/currentAgentPlanningEffectBlueprint'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'

/** Source-bound preparation capacities, not observed triggers or team DPS. */
export function personalPreparedSupport32(input: {
  member: PlanningEffectRuntimeMember
  equipmentExclusions: readonly unknown[]
  equipmentModifierBuckets?: readonly SourceBackedPlanningEffectBucket[]
  declaration?: {
    zhaoAdditionalAbilityActive?: boolean | null
    zhaoInsideEtherVeil?: boolean | null
    sunnaAngelicChordActive?: boolean | null
    luciaDarkbreaker?: boolean | null
  }
}): ReviewedFunctionalCapacity32[] {
  const { member } = input
  const proportional = ['agent-soukaku', 'agent-yuzuha', 'agent-astra', 'agent-pan-yinhu']
  if (member.agentId === 'agent-nicole') {
    if (!Number.isInteger(member.coreLevel) || member.coreLevel < 1 || member.coreLevel > 7)
      return []
    const contract = getCurrentAgentDecisionMechanicContract(member.agentId)?.effectContract
    const blueprint = getCurrentAgentPlanningEffectBlueprint('agent-nicole:core_defRed_')
    const sourceEffect = contract?.effects.find((row) => row.effectId === 'core_defRed_')
    if (
      !blueprint ||
      !contract ||
      contract.source.formulaSha256 !==
        '0BEDD990502F54EAA094997FE1998A0B50C7B9C5924D0F4A18C433FCC93A880C' ||
      blueprint.numericExpression.expressionSha256 !==
        sourceEffect?.numericExpression.expressionSha256
    )
      return []
    const expression = extractUpstreamEffectValueIr(
      blueprint.numericExpression.expressionIr as UpstreamExpressionIR,
    )
    if (expression.status !== 'supported') return []
    const result = evaluateUpstreamExpressionIr(
      expression.value as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: {
          ...contract.runtimeDefaults.references,
          'char.core': member.coreLevel - 1,
          bulletsOrFieldHit: true,
        },
      }),
    )
    if (
      result.status !== 'supported' ||
      typeof result.value !== 'number' ||
      !Number.isFinite(result.value)
    )
      return []
    return [
      {
        key: 'agent-nicole:prepared_core_defense_reduction',
        kind: 'source_support_target',
        value: result.value * 100,
        contextKey: stableContentHash({
          agentId: member.agentId,
          core: member.coreLevel,
          declaration: 'prepared_bullets_or_field_hit',
          source: contract.source,
        }),
        sourceRefs: [...blueprint.sourceRefs],
        included: ['declared_bullets_or_field_hit', 'core_defense_reduction'],
        excluded: ['prepared_nicole_hit_not_observed', 'recipient_uptime_and_team_damage'],
      },
    ]
  }
  if (member.agentId === 'agent-zhao' || member.agentId === 'agent-sunna') {
    if (
      !Number.isInteger(member.coreLevel) ||
      member.coreLevel < 1 ||
      member.coreLevel > 7 ||
      !Number.isInteger(member.mindscape) ||
      member.mindscape < 0 ||
      member.mindscape > 6
    )
      return []
    const isZhao = member.agentId === 'agent-zhao'
    const active = isZhao
      ? input.declaration?.zhaoAdditionalAbilityActive === true &&
        input.declaration?.zhaoInsideEtherVeil === true
      : input.declaration?.sunnaAngelicChordActive === true
    const initial = isZhao ? member.initialStats.hp : member.initialStats.atk
    const gaps = functionalEquipmentGaps32(input.equipmentExclusions, member.agentId, [
      isZhao ? 'initial.hp' : 'initial.atk',
    ])
    if (!active || !Number.isFinite(initial) || initial < 0 || gaps.length) return []
    let value: number
    let sourceRefs: string[]
    if (isZhao) {
      const row = targetFields.rows.find((item) => item.agentId === member.agentId)
      const check = row?.checks.find((item) => item.locator === 'passive.level.1341507.desc[1]')
      if (
        row?.sha256 !== '628b4949def6a5f64b44b3f8a8f46b43b9d89946ef4761bcf9bc38721e841361' ||
        !check?.contains.includes('初始最大生命值达到27000点') ||
        getCurrentAgentDecisionMechanicContract(member.agentId)?.effectContract.source
          .formulaSha256 !== 'D371D769E3EFA7F079DE26EE86762F7001B1025655CAF767D596F79FEF434B15'
      )
        return []
      value = 10 + Math.floor(Math.max(0, Math.min(initial, 27000) - 15000) / 400)
      sourceRefs = [`reviewed-external-support-target31:${row.sha256}#${check.locator}`]
    } else {
      const blueprint = getCurrentAgentPlanningEffectBlueprint(
        'agent-sunna:reviewed_angelic_chord_attack32',
      )
      if (!blueprint) return []
      const expression = extractUpstreamEffectValueIr(
        blueprint.numericExpression.expressionIr as UpstreamExpressionIR,
      )
      if (expression.status !== 'supported') return []
      const result = evaluateUpstreamExpressionIr(
        expression.value as UpstreamExpressionIR,
        createPlanningExpressionDomainRuntime({
          references: {
            'char.core': member.coreLevel - 1,
            'own.initial.atk': initial,
            sunnaAngelicChordination32: true,
          },
        }),
      )
      if (
        result.status !== 'supported' ||
        typeof result.value !== 'number' ||
        !Number.isFinite(result.value)
      )
        return []
      value = result.value
      sourceRefs = [...blueprint.sourceRefs]
    }
    return [
      {
        key: `${member.agentId}:${isZhao ? 'prepared_veil_additional_damage' : 'prepared_angelic_chord_attack'}`,
        kind: 'source_support_target',
        value,
        contextKey: stableContentHash({
          agentId: member.agentId,
          core: member.coreLevel,
          mindscape: member.mindscape,
          declaration: input.declaration,
          sourceRefs,
        }),
        sourceRefs,
        included: [
          isZhao ? 'declared_additional_ability_and_veil' : 'declared_angelic_chord',
          'source_bound_initial_stat',
        ],
        excluded: ['prepared_support_not_observed', 'recipient_uptime_and_team_damage'],
      },
    ]
  }
  if (
    member.agentId !== 'agent-lucy' &&
    member.agentId !== 'agent-rina' &&
    !proportional.includes(member.agentId)
  )
    return []
  if (
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    !Number.isInteger(member.coreLevel) ||
    member.coreLevel < 1 ||
    member.coreLevel > 7
  )
    return []
  const skill = member.skillLevels.special
  const source = reviewedContextualMechanicTargets({
    agentId: member.agentId,
    specialLevel: skill,
    coreLevel: member.coreLevel,
    mindscape: member.mindscape,
  })
  if (member.agentId === 'agent-rina') {
    const gaps = functionalEquipmentGaps32(input.equipmentExclusions, member.agentId, [
      'initial.pen_',
      'final.pen_',
      'combat.pen_',
    ])
    const formula = mechanics.formulaEffects.find((row) => row.externalId === '1211')
    if (
      !source ||
      !formula ||
      formula.source.formulaSha256 !== source.sourceRef.contentHash ||
      gaps.length ||
      (member.potential !== 0 && member.potential !== 1) ||
      input.equipmentModifierBuckets === undefined ||
      input.equipmentModifierBuckets.some(
        (row) =>
          row.recipientAgentIds.includes(member.agentId) && row.application === 'penetration_ratio',
      ) ||
      !Number.isFinite(member.initialStats.pen_) ||
      member.initialStats.pen_ < 0
    )
      return []
    const refs = formula.runtimeDefaults.references as Record<string, unknown>
    const base = Number((refs['dm.core.pen_'] as number[] | undefined)?.[member.coreLevel - 1])
    const cap = Number(refs['dm.core.max_pen_'])
    const scaling = Number(refs['dm.core.pen_scaling'])
    const threshold = source.values.penRatio
    if (
      ![base, cap, scaling, threshold].every(Number.isFinite) ||
      base < 0 ||
      cap < base ||
      scaling <= 0 ||
      Math.abs(((cap - base) / scaling) * 100 - threshold) > 1e-8
    )
      return []
    return [
      {
        key: 'agent-rina:prepared_doll_penetration',
        kind: 'source_support_target',
        value: Math.min(cap, base + member.initialStats.pen_ * scaling) * 100,
        contextKey: stableContentHash({
          agentId: member.agentId,
          core: member.coreLevel,
          mindscape: member.mindscape,
          potential: member.potential ?? null,
          declaration: 'prepared_doll_on_field_far_distance_not_observed',
          source: source.sourceRef.contentHash,
        }),
        sourceRefs: [`${source.sourceRef.url}#${source.sourceRef.contentHash}`],
        included: ['declared_prepared_doll_penetration', 'initial_penetration', 'actual_core'],
        excluded: ['prepared_doll_not_observed', 'recipient_uptime_and_team_damage'],
      },
    ]
  }
  const gaps = functionalEquipmentGaps32(input.equipmentExclusions, member.agentId, ['initial.atk'])
  if (
    !source ||
    (member.agentId === 'agent-lucy' && (!Number.isInteger(skill) || skill < 1 || skill > 16)) ||
    !Number.isFinite(member.initialStats.atk) ||
    member.initialStats.atk < 0 ||
    gaps.length
  )
    return []
  const threshold = source.values.atk
  if (!Number.isFinite(threshold) || threshold <= 0) return []
  if (member.agentId !== 'agent-lucy') {
    const externalIds: Record<string, string> = {
      'agent-soukaku': '1131',
      'agent-yuzuha': '1411',
      'agent-astra': '1311',
      'agent-pan-yinhu': '1421',
    }
    const formula = mechanics.formulaEffects.find(
      (row) => row.externalId === externalIds[member.agentId],
    )
    if (!formula || formula.source.formulaSha256 !== source.sourceRef.contentHash) return []
    const refs = formula.runtimeDefaults.references as Record<string, unknown>
    const cap =
      member.agentId === 'agent-soukaku'
        ? Number(refs['dm.core.max_atk'])
        : member.agentId === 'agent-yuzuha'
          ? Number((refs['dm.core.max_atk'] as number[] | undefined)?.[member.coreLevel - 1])
          : member.agentId === 'agent-astra'
            ? Number(refs['dm.core.max_atk']) +
              (member.mindscape >= 2 ? Number(refs['dm.m2.max_increase']) : 0)
            : Number(
                refs[member.mindscape === 6 ? 'dm.m6.max_sheerForce' : 'dm.core.max_sheerForce'],
              )
    const rate =
      member.agentId === 'agent-soukaku'
        ? Number((refs['dm.core.atk_'] as number[] | undefined)?.[member.coreLevel - 1])
        : member.agentId === 'agent-yuzuha'
          ? Number(refs['dm.core.atk'])
          : member.agentId === 'agent-astra'
            ? Number((refs['dm.core.atk_'] as number[] | undefined)?.[member.coreLevel - 1]) +
              (member.mindscape >= 2 ? Number(refs['dm.m2.atk_']) : 0)
            : Number((refs['dm.core.sheerForce'] as number[] | undefined)?.[member.coreLevel - 1]) +
              (member.mindscape === 6 ? Number(refs['dm.m6.sheerForce']) : 0)
    if (
      !Number.isFinite(cap) ||
      cap <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      Math.abs(threshold * rate - cap) > 1e-8 * Math.max(1, cap)
    )
      return []
    return [
      {
        key: `${member.agentId}:prepared_attack_conversion`,
        kind: 'source_support_target',
        value: Math.min(cap, member.initialStats.atk * rate),
        contextKey: stableContentHash({
          agentId: member.agentId,
          core: member.coreLevel,
          mindscape: member.mindscape,
          level: member.level,
          potential: member.potential ?? null,
          declaration: 'prepared_attack_conversion_not_observed',
          source: source.sourceRef.contentHash,
        }),
        sourceRefs: [`${source.sourceRef.url}#${source.sourceRef.contentHash}`],
        included: [
          'declared_prepared_attack_conversion',
          'initial_attack',
          'actual_core_and_mindscape',
          'source_cap_and_rate',
        ],
        excluded: ['prepared_conversion_not_observed', 'recipient_uptime_and_team_damage'],
      },
    ]
  }
  // The source-bound preparation line solves 600 = initial ATK * rate + flat.
  const value = Math.min(600, member.initialStats.atk * (0.13 + 0.008 * skill) + 40 + 4 * skill)
  return [
    {
      key: 'agent-lucy:prepared_ex_attack_buff',
      kind: 'source_support_target',
      value,
      contextKey: stableContentHash({
        agentId: member.agentId,
        skill,
        level: member.level,
        mindscape: member.mindscape,
        potential: member.potential ?? null,
        declaration: 'one_prepared_ex_cheer_on_not_observed',
        source: source.sourceRef.contentHash,
      }),
      sourceRefs: [`${source.sourceRef.url}#${source.sourceRef.contentHash}`],
      included: ['declared_prepared_ex_attack_buff', 'initial_attack', 'actual_special_level'],
      excluded: ['prepared_ex_not_observed', 'recipient_uptime_and_team_damage'],
    },
  ]
}
