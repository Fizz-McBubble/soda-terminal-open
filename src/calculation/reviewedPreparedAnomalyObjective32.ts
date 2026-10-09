import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningBaseline } from './planningDpsContract'
import {
  commonAnomalySettlementHash32,
  commonAnomalySettlementIdentity32,
} from './currentCommonAnomalySettlementIdentity32'
import { calculateCommonAnomalySettlement32 } from './currentCommonAnomalySettlement32'
import {
  compileReviewedPreparedAnomalyEquipment32,
  type PreparedAnomalyExclusion32,
  type PreparedAnomalyModifier32,
} from './reviewedPreparedAnomalyEquipment32'
import type { CurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'
import {
  compileReviewedPreparedJaneAssault32,
  reviewedPreparedJaneEffectIds32,
} from './reviewedPreparedJaneAssault32'
import {
  sourceFormulaHashes,
  promeiaProfile,
  promeiaCoreFact,
  promeiaCore,
  reviewedPreparedAnomalyObjectiveHash32,
  reviewedPreparedAnomalyPreparation32,
  type PreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyDeclarations32'
export {
  reviewedPreparedAnomalyObjectiveHash32,
  reviewedPreparedAnomalyObjectiveIdentity32,
  reviewedPreparedAnomalyPreparation32,
  type PreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyDeclarations32'

export type ReviewedPreparedAnomalyObjectiveInput32 = {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  baseline: PlanningBaseline
  preparation?: PreparedAnomalyPreparation32
  /** Explicit formation buckets only. Equipment is separately resolved below. */
  effectBuckets?: readonly SourceBackedPlanningEffectBucket[]
  equipmentModifierBuckets?: readonly SourceBackedPlanningEffectBucket[]
  wEngine?: { engineId: string; refinement: number; runtime?: CurrentWEngineFormulaRuntime }
  discs?: readonly { setId: string }[]
  sourceIdentityHash?: string
}

const baseBoundary =
  '只评价一个已声明、100%本人来源的准备态异常结算。准备资源与异常基底是比较条件，未计其获取成本；不推断异常阈值、积蓄次数、循环频率或全周期DPS。直伤、其他属性基底与特殊混合快照保持未建模。'
const ownEffects: Record<string, string[]> = {
  'agent-piper': ['ability_common_dmg_'],
  'agent-alice': ['ability_anomProf', 'm2_physical_anomaly_buff_', 'm4_physical_resIgn_'],
  'agent-promeia': [],
  'agent-jane': [],
}

/** Actual panel -> sourced effects/equipment -> declared settlement runtime.
 * This is a mechanism objective for candidate ranking, never a whole actor sum. */
export function evaluateReviewedPreparedAnomalyObjective32(
  input: ReviewedPreparedAnomalyObjectiveInput32,
) {
  const { member } = input
  const preparation = input.preparation ?? reviewedPreparedAnomalyPreparation32(member.agentId)
  const boundary =
    baseBoundary +
    (member.agentId === 'agent-jane'
      ? '简的本次结算显式声明狂热、猎物及此前强击/紊乱增益；这些是准备态前提，未从盘面推断。'
      : '')
  const members = input.members ?? [member]
  const contract = getCurrentAgentEventContract(member.agentId)
  const decision = getCurrentAgentDecisionMechanicContract(member.agentId)
  const exclusions: PreparedAnomalyExclusion32[] = []
  const failure = (blockers: string[]) => ({
    status: 'unsupported' as const,
    totalDamage: null,
    settlementDamage: null,
    modeledDirectDamage: null,
    planningDps: null,
    blockers,
    boundary,
    formalCycleReady: false as const,
  })
  if (!preparation || !contract || !decision || !(member.agentId in sourceFormulaHashes))
    return failure(['prepared_anomaly_actor_not_adopted'])
  if (
    input.sourceIdentityHash !== undefined &&
    input.sourceIdentityHash !== reviewedPreparedAnomalyObjectiveHash32
  )
    return failure(['prepared_anomaly_source_identity_mismatch'])
  if (
    contract.source.commit !== commonAnomalySettlementIdentity32.commit ||
    contract.source.formulaSha256 !==
      sourceFormulaHashes[member.agentId as keyof typeof sourceFormulaHashes]
  )
    return failure(['prepared_anomaly_actor_source_mismatch'])
  if (
    !/^3\.2(?:$|-)/.test(input.baseline.gameVersion) ||
    !Number.isInteger(member.level) ||
    member.level! < 1 ||
    member.level! > 60 ||
    !Number.isInteger(member.coreLevel) ||
    member.coreLevel < 1 ||
    member.coreLevel > 7 ||
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    (member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6))
  )
    return failure(['prepared_anomaly_actor_domain_invalid'])
  if (
    new Set(members.map((row) => row.agentId)).size !== members.length ||
    !members.some((row) => row.agentId === member.agentId) ||
    members.some((row) => !getCurrentAgentEventContract(row.agentId))
  )
    return failure(['prepared_anomaly_formation_identity_invalid'])
  const expectedPreparation = reviewedPreparedAnomalyPreparation32(member.agentId)!
  if (
    preparation.kind !== expectedPreparation.kind ||
    preparation.acceptedSingleOwnerSettlement !== true
  )
    return failure(['prepared_anomaly_preparation_identity_mismatch'])
  if (preparation.kind === 'piper_single_assault' && preparation.powerStacks !== 0)
    return failure(['unreviewed_piper_power_preparation'])
  if (preparation.kind === 'alice_single_polarized_assault' && preparation.bladeEtiquette !== 300)
    return failure(['alice_blade_etiquette_preparation_invalid'])
  if (
    preparation.kind === 'promeia_single_self_ice_abloom' &&
    (preparation.trialByCold !== 1 ||
      typeof preparation.ownIceAnomalyPresent !== 'boolean' ||
      member.coreLevel < 2)
  )
    return failure(['promeia_core_tier_or_trial_preparation_unresolved'])
  if (
    preparation.kind === 'jane_single_assault' &&
    (typeof preparation.passion !== 'boolean' ||
      typeof preparation.gnawed !== 'boolean' ||
      typeof preparation.priorAssaultOrDisorderBuffActive !== 'boolean')
  )
    return failure(['jane_prepared_state_unresolved'])
  const refs = [
    ...commonAnomalySettlementIdentity32.sources.map((row) => `${row.path}#${row.sha256}`),
    `${contract.source.formulaPath}#${contract.source.formulaSha256}`,
    `${contract.source.statsPath}#${contract.source.statsSha256}`,
    decision.resourceContract?.resourceFlow.evidenceLocator ?? '',
  ].filter(Boolean)
  let motionValueMultiplier = 1
  if (preparation.kind === 'alice_single_polarized_assault') {
    const parameters = decision.resourceContract?.resourceFlow.parameters as
      | Record<string, unknown>
      | undefined
    if (parameters?.polarized_assault_ratio !== 1 || parameters?.blade_etiquette_cap !== 300)
      return failure(['alice_polarized_assault_resource_source_mismatch'])
    motionValueMultiplier = Number(parameters.polarized_assault_ratio)
  }
  if (preparation.kind === 'promeia_single_self_ice_abloom') {
    motionValueMultiplier =
      promeiaCore.abloom_multiplier_by_tier[member.coreLevel - 2] ?? Number.NaN
    if (!Number.isFinite(motionValueMultiplier) || motionValueMultiplier <= 0)
      return failure(['promeia_abloom_core_coefficient_unresolved'])
    refs.push(
      `${promeiaCoreFact.record_id}@${promeiaCoreFact.source_revision}`,
      `candidate-profile:${promeiaProfile.profileHash}:source-version-${promeiaProfile.gameFactsVersion}`,
    )
  }
  const context = {
    objective: 'prepared_single_anomaly_settlement' as const,
    agentId: member.agentId,
    members: members.map((row) => row.agentId).sort(),
    actor: {
      level: member.level,
      coreLevel: member.coreLevel,
      mindscape: member.mindscape,
      potential: member.potential ?? null,
      skillLevels: member.skillLevels,
    },
    preparation,
    enemy: input.baseline.enemy,
    formulaIdentity: reviewedPreparedAnomalyObjectiveHash32,
    equipmentState: input.wEngine?.runtime ?? null,
    declaredEffectContext: (input.effectBuckets ?? []).map((row) => ({
      effectKey: row.effectKey,
      providerAgentId: row.providerAgentId,
      recipientAgentIds: row.recipientAgentIds,
      sourceRefs: row.sourceRefs,
    })),
    ownership: '100_percent_self_snapshot',
    frequency: null,
    duration: null,
  }
  const contextHash = stableContentHash(context)
  const identity = {
    ...context,
    contextHash,
    sourceIdentityHash: reviewedPreparedAnomalyObjectiveHash32,
  }
  exclusions.push({
    effectKey: 'unmodeled:direct-and-cycle',
    reason: '未计获取准备资源的直伤、其他直伤动作及异常循环次数。',
    fields: ['crit_', 'crit_dmg_', 'actionDamageBonuses', 'rotation', 'frequency'],
    sourceRefs: refs,
  })
  exclusions.push({
    effectKey: 'unmodeled:buildup-frequency',
    reason: '单次已接受异常结算未评价掌控和积蓄对触发频率的收益；爱丽丝来源掌控转精通仍单独计算。',
    fields: ['anomMas', 'anomBuildup_', 'frequency'],
    sourceRefs: refs,
  })
  const included: string[] = [
    'static_projected_panel:atk:anomProf:attribute_damage:penetration',
    `prepared_settlement:${preparation.kind}`,
  ]
  // A proven absent base is inactive. Missing/invalid preparation was rejected above.
  if (preparation.kind === 'promeia_single_self_ice_abloom' && !preparation.ownIceAnomalyPresent) {
    const core = {
      status: 'supported' as const,
      totalDamage: 0,
      settlementDamage: 0,
      modeledDirectDamage: null,
      planningDps: null,
      identity,
      contextHash,
      sourceRefs: refs,
      included,
      excluded: exclusions,
      boundary,
      formalCycleReady: false as const,
      triggered: false as const,
    }
    return { ...core, runtimeHash: stableContentHash({ core, input }) }
  }
  const selected = currentAgentPlanningEffectBlueprints.filter(
    (row) =>
      row.providerAgentId === member.agentId && ownEffects[member.agentId]!.includes(row.effectId),
  )
  const self = evaluateCurrentPlanningEffectEntries32(
    {
      memberIds: members.map((row) => row.agentId),
      members,
      baselineReferencesByAgentId: {
        [member.agentId]: { power: 0, assault_triggered: false, physical_anomaly_inflicted: false },
      },
    },
    selected,
  )
  if (self.status === 'unsupported') return failure(self.blockers)
  for (const row of currentAgentPlanningEffectBlueprints.filter(
    (row) =>
      row.providerAgentId === member.agentId &&
      !selected.includes(row) &&
      !(member.agentId === 'agent-jane' && reviewedPreparedJaneEffectIds32.includes(row.effectId)),
  )) {
    exclusions.push({
      effectKey: row.effectKey,
      reason: 'outside_declared_settlement_or_unbound_state',
      fields: [row.effectId],
      sourceRefs: row.sourceRefs,
    })
  }
  const equipment = compileReviewedPreparedAnomalyEquipment32({
    member,
    wEngine: input.wEngine,
    discs: input.discs,
  })
  if (equipment.status === 'unsupported') return failure(equipment.blockers)
  exclusions.push(...equipment.exclusions)
  const bucketRows = [
    ...planningRuntimeEffectBuckets32(
      self.results,
      members.map((row) => row.agentId),
    ),
    ...(input.effectBuckets ?? []),
    ...(!input.wEngine && !input.discs ? (input.equipmentModifierBuckets ?? []) : []),
  ]
  const modifiers: PreparedAnomalyModifier32[] = [...equipment.modifiers]
  const seenBuckets = new Map<string, SourceBackedPlanningEffectBucket>()
  const applicationStat: Partial<Record<SourceBackedPlanningEffectBucket['application'], string>> =
    {
      attack_percent: 'combat.atk_',
      attack_flat: 'combat.atk',
      damage_bonus: 'combat.common_dmg_',
      buff_bonus: 'combat.buff_',
      penetration_ratio: 'combat.pen_',
      defense_ignore: 'combat.defIgn_',
      resistance_ignore: 'combat.resIgn_',
      defense_reduction: 'enemy.defRed_',
      resistance_reduction: 'enemy.resRed_',
      vulnerability: 'enemy.dmgInc_',
      stun_damage_bonus: 'enemy.stun_',
    }
  for (const row of bucketRows) {
    const previous = seenBuckets.get(row.effectKey)
    if (previous) {
      if (stableContentHash(previous) !== stableContentHash(row))
        return failure([`conflicting_anomaly_effect_bucket:${row.effectKey}`])
      continue
    }
    seenBuckets.set(row.effectKey, row)
    if (
      !row.recipientAgentIds.includes(member.agentId) ||
      (row.attribute !== null && row.attribute !== contract.identity.attribute)
    )
      continue
    if (
      row.action !== null ||
      row.applicationScope === 'event_only' ||
      (row.damageType !== null && row.damageType !== 'anomaly' && row.damageType !== 'abloom')
    ) {
      exclusions.push({
        effectKey: row.effectKey,
        reason: 'outside_anomaly_settlement_scope',
        fields: [row.action ?? '', row.damageType ?? ''],
        sourceRefs: row.sourceRefs,
      })
      continue
    }
    const stat =
      row.receiverPath?.replace(/^(ownBuff|teamBuff|notOwnBuff)\./, '') ??
      applicationStat[row.application]
    if (!stat) {
      exclusions.push({
        effectKey: row.effectKey,
        reason: 'outside_anomaly_modifier_domain',
        fields: [row.application],
        sourceRefs: row.sourceRefs,
      })
      continue
    }
    modifiers.push({ effectKey: row.effectKey, stat, value: row.value, sourceRefs: row.sourceRefs })
  }
  const sums: Record<string, number> = {}
  for (const row of modifiers) {
    if (!Number.isFinite(row.value) || !row.sourceRefs.length)
      return failure(['prepared_anomaly_modifier_source_or_value_invalid'])
    const channel = /\.(physical|fire|ice|electric|ether|wind)$/.exec(row.stat)
    if (channel && channel[1] !== contract.identity.attribute) continue
    const stat = row.stat.replace(/\.(physical|fire|ice|electric|ether|wind)$/, '')
    if (
      [
        'combat.atk_',
        'combat.atk',
        'combat.anomProf',
        'combat.common_dmg_',
        'combat.dmg_',
        'combat.buff_',
        'combat.pen_',
        'combat.defIgn_',
        'combat.resIgn_',
        'enemy.defRed_',
        'enemy.resRed_',
        'enemy.dmgInc_',
        'enemy.stun_',
        'enemyDebuff.common.defRed_',
        'enemyDebuff.common.resRed_',
        'enemyDebuff.common.dmgInc_',
        'enemyDebuff.common.stun_',
      ].includes(stat)
    ) {
      sums[stat] = (sums[stat] ?? 0) + row.value
      included.push(row.effectKey)
      refs.push(...row.sourceRefs)
    } else
      exclusions.push({
        effectKey: row.effectKey,
        reason:
          stat.includes('anomMas') || stat.includes('anomBuildup')
            ? 'buildup_not_inferred_into_damage_or_AP'
            : 'outside_anomaly_settlement_formula',
        fields: [row.stat],
        sourceRefs: row.sourceRefs,
      })
  }
  const final = member.finalStats
  if (preparation.kind === 'jane_single_assault') {
    const jane = compileReviewedPreparedJaneAssault32({
      member,
      members,
      preparation,
      anomalyProficiency: final.anomProf + (sums['combat.anomProf'] ?? 0),
    })
    if (jane.status !== 'supported') return failure(jane.blockers)
    for (const row of jane.modifiers) {
      sums[row.stat] = (sums[row.stat] ?? 0) + row.value
      included.push(row.effectKey)
      refs.push(...row.sourceRefs)
    }
  }
  const attack =
    final.atk + member.initialStats.atk * (sums['combat.atk_'] ?? 0) + (sums['combat.atk'] ?? 0)
  const stats = {
    attackerLevel: member.level!,
    attack,
    anomalyProficiency: final.anomProf + (sums['combat.anomProf'] ?? 0),
    anomalyBaseBonus: 0,
    flatAnomalyDamage: 0,
    anomalyCritRate: sums['combat.anom_crit_'] ?? 0,
    anomalyCritDamage: sums['combat.anom_crit_dmg_'] ?? 0,
    damageBonus:
      (final.damageBonusesByAttribute?.[contract.identity.attribute] ?? final.damageBonus ?? 0) +
      (sums['combat.common_dmg_'] ?? 0) +
      (sums['combat.dmg_'] ?? 0),
    buffBonus: final.buffBonus ?? 0,
    directDamageBonus: 0,
    defenseIgnore: sums['combat.defIgn_'] ?? 0,
    penetrationRatio: final.pen_ + (sums['combat.pen_'] ?? 0),
    penetrationFlat: final.pen ?? 0,
    resistanceIgnore: sums['combat.resIgn_'] ?? 0,
  }
  stats.buffBonus += sums['combat.buff_'] ?? 0
  try {
    const result = calculateCommonAnomalySettlement32({
      sourceIdentityHash: commonAnomalySettlementHash32,
      eventId: preparation.kind,
      triggerAgentId: member.agentId,
      memberAgentIds: members.map((row) => row.agentId),
      attribute: contract.identity.attribute as 'physical' | 'ice',
      targetId: input.baseline.enemy.id,
      atSeconds: 0,
      buildupStateId: contextHash,
      totalBuildup: 1,
      sourceRefs: refs,
      target: {
        enemyDefense: input.baseline.enemy.defense,
        resistance: input.baseline.enemy.resistance,
        defenseReduction: (sums['enemy.defRed_'] ?? 0) + (sums['enemyDebuff.common.defRed_'] ?? 0),
        resistanceReduction:
          (sums['enemy.resRed_'] ?? 0) + (sums['enemyDebuff.common.resRed_'] ?? 0),
        vulnerability:
          input.baseline.enemy.vulnerability +
          (sums['enemy.dmgInc_'] ?? 0) +
          (sums['enemyDebuff.common.dmgInc_'] ?? 0),
        stunMultiplier:
          input.baseline.enemy.stunMultiplier +
          (sums['enemy.stun_'] ?? 0) +
          (sums['enemyDebuff.common.stun_'] ?? 0),
        sourceRefs: [`declared-prepared-target:${stableContentHash(input.baseline.enemy)}`],
      },
      contributions: [
        {
          id: 'declared-complete-self-snapshot',
          ownerAgentId: member.agentId,
          ownerKind: 'agent',
          attribute: contract.identity.attribute as 'physical' | 'ice',
          targetId: input.baseline.enemy.id,
          buildupStateId: contextHash,
          buildup: 1,
          snapshotAtSeconds: 0,
          stats,
          instance: {
            kind: preparation.kind === 'promeia_single_self_ice_abloom' ? 'abloom' : 'anomaly',
            motionValueMultiplier,
          },
          sourceRefs: refs,
        },
      ],
    })
    const core = {
      status: 'supported' as const,
      totalDamage: result.expectedDamage,
      settlementDamage: result.expectedDamage,
      modeledDirectDamage: null,
      planningDps: null,
      identity,
      contextHash,
      sourceRefs: [...new Set(refs)].sort(),
      included: [...new Set(included)].sort(),
      excluded: exclusions,
      boundary,
      formalCycleReady: false as const,
      triggered: true as const,
      snapshot: stats,
      motionValueMultiplier,
    }
    return { ...core, runtimeHash: stableContentHash({ core, input }) }
  } catch (error) {
    return failure([error instanceof Error ? error.message : 'prepared_anomaly_settlement_failed'])
  }
}
