import type { ValueBenchmarkSide } from '../calculation/valueBenchmarkComparison'
import type { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from './developmentPreparedAnomalyBenchmark32'
import {
  personalPhoenixAbloomDeclarationSchema33,
  type PersonalPhoenixAbloomDeclaration33,
} from '../calculation/personalPhoenixAbloomDeclaration33'
import { calculatePhoenixHomogeneousOriginal33 } from '../calculation/phoenixHomogeneousAnomalyAdapter33'
import { phoenixAnomalyCritHash33 } from '../calculation/reviewedPhoenixAnomalyCrit33'
import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentPlanningEffectBlueprint } from '../calculation/currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from '../calculation/currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from '../calculation/currentPlanningSelfEffects32'
import {
  compileReviewedPreparedAnomalyEquipment32,
  type PreparedAnomalyExclusion32,
} from '../calculation/reviewedPreparedAnomalyEquipment32'
import { collectReviewedPreparedAnomalyModifiers32 } from '../calculation/reviewedPreparedAnomalyModifiers32'
import { stableContentHash } from '../gameDataPacks/types'
import { isPersonalPhoenixPlanningBaseline33 } from '../calculation/personalPhoenixPlanningScenario33'
import {
  FIRST_PLUMAGE_STABLE_ID,
  resolveFirstPlumagePassive,
} from '../calculation/reviewedWEngine33'
import { FIRST_PLUMAGE_WINDOW_FLAG } from '../calculation/currentWEnginePersonalPlanningEffects'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { resolveCurrentAgentInitialNumericPassive } from '../calculation/currentAgentNumericContracts'

type BenchmarkInput = Parameters<typeof evaluateDevelopmentPreparedAnomalyBenchmarkSide32>[0]
const formula = 'personal-phoenix-self-fire-basic-abloom33/v3-sinburn-attack-coefficient'
const sourceSha = 'D938FDB17DAEB39F37F2939142061F3462D824DC2FEFD4A2A8A2F63127AB6120'
const boundary =
  '本人已声明的单一火异常快照，按净炎普攻触发一次绽放；不计算原异常形成成本、普通直伤、额外绽放、频率或全周期。未绑定效果保留为排除项。'

export function evaluatePersonalPreparedPhoenixAbloomBenchmarkSide33(
  input: Omit<BenchmarkInput, 'members' | 'preparation' | 'originalEquipment'> & {
    declaration: PersonalPhoenixAbloomDeclaration33
  },
): ValueBenchmarkSide {
  const parsed = personalPhoenixAbloomDeclarationSchema33.safeParse(input.declaration)
  const actor = input.member
  const firstPlumageAnomalyCritWindowActive =
    input.wEngine.runtime?.flags?.[FIRST_PLUMAGE_WINDOW_FLAG] ?? null
  const dimensions = {
    game_version: input.baseline.gameVersion,
    subject: input.subjectKey,
    scenario: `personal-phoenix-abloom:${stableContentHash({
      declaration: input.declaration,
      enemy: input.baseline.enemy,
      firstPlumageAnomalyCritWindowActive,
    })}`,
    event_set: 'phoenix-self-fire-basic-abloom',
    duration: 'not_applicable',
    formula: input.baseline.formulaHash,
    runtime: formula,
    disc_loadout: input.discLoadoutKey,
    w_engine: input.engineKey,
    bangboo: 'none',
    ...(input.potential == null ? {} : { potential: String(input.potential) }),
  }
  const fail = (...reasons: string[]): ValueBenchmarkSide => ({
    state: 'unsupported',
    dimensions,
    totalDamage: null,
    planningDps: null,
    calculationFingerprint: null,
    reasons,
  })
  const contract = getCurrentAgentEventContract(actor.agentId)
  if (!parsed.success) return fail('phoenix_personal_declaration_invalid')
  const declaration = parsed.data
  if (
    actor.agentId !== 'agent-phoenix' ||
    input.baseline.gameVersion !== '3.3' ||
    contract?.identity.attribute !== 'fire' ||
    contract.source.formulaSha256 !== sourceSha
  )
    return fail('phoenix_personal_source_or_actor_mismatch')
  if (!isPersonalPhoenixPlanningBaseline33(input.baseline))
    return fail('phoenix_personal_scenario_identity_mismatch')
  if (
    input.sourceIdentityHash !== undefined &&
    input.sourceIdentityHash !== phoenixAnomalyCritHash33
  )
    return fail('phoenix_personal_source_identity_mismatch')
  if (
    declaration.originalAppliedAtSeconds > declaration.triggerAtSeconds ||
    declaration.scorchAppliedAtSeconds > declaration.triggerAtSeconds
  )
    return fail('phoenix_personal_timeline_invalid')
  if (declaration.triggerAtSeconds - declaration.scorchAppliedAtSeconds >= 20)
    return fail('phoenix_personal_scorch_expired')
  const event = contract.eventContract.events.find(
    (row) => row.actionId === 'BasicAttackPurifyingFlame',
  )
  if (!event) return fail('phoenix_personal_named_event_missing')
  const activation = evaluateCurrentAgentTeamActivation({
    stableId: actor.agentId,
    memberIds: [actor.agentId],
    agentState: { mindscape: actor.mindscape, potentialImage: actor.potential },
  })
  if (activation.status !== 'supported') {
    const blockers: string[] = []
    for (const blocker of activation.blockers)
      if (typeof blocker === 'string' && blocker.length > 0) blockers.push(blocker)
    return fail(...(blockers.length ? blockers : ['phoenix_personal_activation_unresolved']))
  }
  const firstPlumage = input.wEngine.engineId === FIRST_PLUMAGE_STABLE_ID
  const equipment = compileReviewedPreparedAnomalyEquipment32({
    member: actor,
    ...(firstPlumage ? {} : { wEngine: input.wEngine }),
    discs: input.discs,
  })
  if (equipment.status !== 'supported') return fail(...equipment.blockers)
  if (firstPlumage) {
    const source = getCurrentWEngineStaticData(FIRST_PLUMAGE_STABLE_ID)
    if (
      !source ||
      source.source.provider !== 'nanoka' ||
      source.source.rawSha256 !== '006b40349cce50cff242630edec086520ff6f3f196da86e92d935c20794c77ff'
    )
      return fail('phoenix_first_plumage_source_mismatch')
    const passive = resolveFirstPlumagePassive({
      refinement: input.wEngine.refinement,
      specialtyMatches: true,
      teamAnomalyCritWindowActive: firstPlumageAnomalyCritWindowActive ?? undefined,
    })
    if (passive.status !== 'supported') return fail(...passive.blockers)
    // The permanent AP grant is already in the projected initial panel. The
    // window grants fire damage, not an additional anomaly-crit component.
    for (const effect of passive.effects.filter((row) => row.stat === 'damage_bonus'))
      equipment.modifiers.push({
        effectKey: 'wengine:14164:fire_damage_window',
        stat: 'combat.dmg_.fire',
        value: effect.value,
        sourceRefs: [`${source.source.url}#sha256=${source.source.rawSha256}`],
      })
  }
  const blueprint = getCurrentAgentPlanningEffectBlueprint('agent-phoenix:core_anomProf')
  if (!blueprint) return fail('phoenix_personal_core_effect_missing')
  const initialPassive = resolveCurrentAgentInitialNumericPassive(actor.agentId, actor.coreLevel)
  if (
    actor.statBasis32 !== 'out_of_combat' ||
    initialPassive.status !== 'supported' ||
    !Number.isFinite(actor.initialStats.anomProf) ||
    actor.initialStats.anomProf < initialPassive.anomalyProficiency
  )
    return fail('phoenix_initial_panel_passive_basis_unresolved')
  const self = evaluateCurrentPlanningEffectEntries32(
    { memberIds: [actor.agentId], members: [actor] },
    [blueprint],
  )
  if (self.status !== 'supported') return fail(...self.blockers)
  if (self.results.some((row) => row.status !== 'supported'))
    return fail('phoenix_personal_core_effect_unresolved')
  const coreBuckets = planningRuntimeEffectBuckets32(self.results, [actor.agentId])
  if (
    coreBuckets.length !== 1 ||
    coreBuckets[0]!.value !== initialPassive.anomalyProficiency ||
    (input.effectBuckets ?? []).some((row) => row.effectKey === blueprint.effectKey)
  )
    return fail('phoenix_personal_core_passive_identity_or_duplicate')
  const exclusions: PreparedAnomalyExclusion32[] = [...equipment.exclusions]
  const included: string[] = [
    'prepared_self_fire_anomaly',
    'phoenix_basic_abloom',
    'agent-phoenix:core_anomProf',
  ]
  const refs = [
    ...declaration.sourceRefs,
    ...blueprint.sourceRefs,
    ...initialPassive.sourceRefs,
    `${contract.source.formulaPath}#${contract.source.formulaSha256}`,
  ]
  const sums: Record<string, number> = {}
  const blockers = collectReviewedPreparedAnomalyModifiers32({
    agentId: actor.agentId,
    attribute: 'fire',
    bucketRows: [
      // Already included by the source-projected initial panel.
      ...(input.effectBuckets ?? []),
    ],
    modifiers: [...equipment.modifiers],
    exclusions,
    included,
    refs,
    sums,
    settlementType: 'abloom',
  })
  if (blockers) return fail(...blockers)
  if (
    exclusions.some((row) =>
      row.fields.some((field) => /anom(?:aly)?_?crit|anomalyCrit/i.test(field)),
    )
  )
    return fail('phoenix_existing_anomaly_crit_stacking_unresolved')
  const n = (key: string) => sums[key] ?? 0
  const f = actor.finalStats
  const stats = {
    attackerLevel: actor.level!,
    attack: f.atk + actor.initialStats.atk * n('combat.atk_') + n('combat.atk'),
    anomalyProficiency: f.anomProf + n('combat.anomProf'),
    anomalyBaseBonus: 0,
    flatAnomalyDamage: 0,
    anomalyCritRate: 0,
    anomalyCritDamage: 0,
    damageBonus:
      (f.damageBonusesByAttribute?.fire ?? f.damageBonus ?? 0) +
      n('combat.common_dmg_') +
      n('combat.dmg_'),
    buffBonus: (f.buffBonus ?? 0) + n('combat.buff_'),
    directDamageBonus: 0,
    defenseIgnore: n('combat.defIgn_'),
    penetrationRatio: f.pen_ + n('combat.pen_'),
    penetrationFlat: f.pen ?? 0,
    resistanceIgnore: n('combat.resIgn_'),
  }
  const targetId = input.baseline.enemy.id
  const eventId = event.eventId
  const stateId = 'personal-phoenix-own-fire'
  const enemy = input.baseline.enemy
  const result = calculatePhoenixHomogeneousOriginal33({
    sourceIdentityHash: phoenixAnomalyCritHash33,
    targetId,
    eventId,
    atSeconds: declaration.triggerAtSeconds,
    skill: 'basic_purifying_flame',
    coefficientBasis: 'sinburn_fire_attack_coefficient',
    skillLevel: actor.skillLevels.basic,
    phoenix: {
      coreLevel: actor.coreLevel,
      mindscape: actor.mindscape,
      initialAnomalyMastery: actor.initialStats.anomMas,
      additionalAbilityActive: activation.active,
    },
    scorchState: {
      active: true,
      targetId,
      eventId,
      appliedAtSeconds: declaration.scorchAppliedAtSeconds,
      currentAtSeconds: declaration.triggerAtSeconds,
    },
    existingAnomalyCritSource: 'none',
    originalAnomaly: {
      eventId: 'personal-phoenix-fire-application',
      ownerAgentId: actor.agentId,
      memberAgentIds: [actor.agentId],
      attribute: 'fire',
      targetId,
      atSeconds: declaration.originalAppliedAtSeconds,
      activeAtEvent: declaration.originalActiveAtTrigger,
      targetConditionsUnchangedAtEvent: declaration.targetConditionsUnchanged,
      buildupStateId: stateId,
      totalBuildup: 1,
      target: {
        enemyDefense: enemy.defense,
        resistance: enemy.resistance,
        defenseReduction: n('enemy.defRed_') + n('enemyDebuff.common.defRed_'),
        resistanceReduction: n('enemy.resRed_') + n('enemyDebuff.common.resRed_'),
        vulnerability: enemy.vulnerability + n('enemy.dmgInc_') + n('enemyDebuff.common.dmgInc_'),
        stunMultiplier: enemy.stunMultiplier + n('enemy.stun_') + n('enemyDebuff.common.stun_'),
      },
      contributions: [
        {
          id: 'self',
          ownerAgentId: actor.agentId,
          attribute: 'fire',
          targetId,
          buildupStateId: stateId,
          buildup: 1,
          snapshotAtSeconds: declaration.originalAppliedAtSeconds,
          stats,
        },
      ],
    },
  })
  if (result.status !== 'supported') return fail(result.reason, ...result.blockers)
  exclusions.push({
    effectKey: 'unmodeled:phoenix-cycle',
    reason: 'outside_declared_single_abloom',
    fields: ['frequency', 'directDamage', 'm4Extra'],
    sourceRefs: result.sourceRefs,
  })
  const fingerprint = stableContentHash({
    formula,
    baseline: input.baseline,
    declaration,
    stats,
    result,
    equipment: input.wEngine,
    discs: input.discs,
  })
  return {
    state: 'supported',
    dimensions,
    totalDamage: result.damage.expectedDamage,
    planningDps: null,
    calculationFingerprint: fingerprint,
    reasons: [],
    coverage: {
      domain: 'prepared_anomaly_settlement',
      includedEffectKeys: included,
      excludedEffects: exclusions,
      exclusionContextFingerprint: stableContentHash({
        actor,
        exclusions,
        equipment: input.wEngine,
        discs: input.discs,
      }),
      boundary,
    },
  }
}
