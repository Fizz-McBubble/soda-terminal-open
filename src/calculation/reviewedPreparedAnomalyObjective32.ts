import { validateReviewedPreparedAnomalyPreparation32 } from './reviewedPreparedAnomalyValidation32'
import { collectReviewedPreparedAnomalyModifiers32 } from './reviewedPreparedAnomalyModifiers32'
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
  ariaProfile,
  ariaCoreFact,
  ariaLocalizationSourceSha256,
  ariaEtherAbloomMultipliers,
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
  'agent-promeia': ['reviewed_initial_mastery_proficiency32'],
  'agent-jane': [],
  'agent-aria': ['reviewed_core_proficiency32'],
}

/** Actual panel -> sourced effects/equipment -> declared settlement runtime.
 * This is a mechanism objective for candidate ranking, never a whole actor sum. */
export function evaluateReviewedPreparedAnomalyObjective32(
  input: ReviewedPreparedAnomalyObjectiveInput32,
) {
  const { member } = input
  const preparation =
    input.preparation ??
    reviewedPreparedAnomalyPreparation32(member.agentId, {
      enemyStunned: input.baseline.enemy.stunMultiplier > 1,
    })
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
  const preparationBlockers = validateReviewedPreparedAnomalyPreparation32(
    member,
    preparation,
    input.baseline,
  )
  if (preparationBlockers) return failure(preparationBlockers)
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
  if (preparation.kind === 'aria_single_self_ether_abloom') {
    const coreRatio = ariaEtherAbloomMultipliers[member.coreLevel - 1] ?? Number.NaN
    const initialAnomMas = member.initialStats.anomMas
    if (
      !Number.isFinite(coreRatio) ||
      coreRatio <= 0 ||
      !Number.isFinite(initialAnomMas) ||
      initialAnomMas <= 0
    )
      return failure(['aria_abloom_core_coefficient_unresolved'])
    motionValueMultiplier = (initialAnomMas / 10) * coreRatio * (preparation.enemyStunned ? 1.5 : 1)
    refs.push(
      `${ariaCoreFact.record_id}@${ariaCoreFact.source_revision}`,
      `candidate-profile:${ariaProfile.profileHash}:source-version-${ariaProfile.gameFactsVersion}`,
      `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/core/desc/0..6/1`,
      'libs/zzz/formula/src/data/char/sheets/Aria.ts#3164FA902E16366CCDBBBF2F41660D77DA72168F95E618157B51CE2A28E3A7F3',
      'libs/zzz/stats/Data/Characters/Aria.json#18BFB18C204CCD5AEA6383B93A960070711E2A22F6A955CEACCFDD8D50C6E8C2',
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
  if (
    (preparation.kind === 'promeia_single_self_ice_abloom' && !preparation.ownIceAnomalyPresent) ||
    (preparation.kind === 'aria_single_self_ether_abloom' && !preparation.ownEtherAnomalyPresent)
  ) {
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
  const sums: Record<string, number> = {}
  const modifierBlockers = collectReviewedPreparedAnomalyModifiers32({
    agentId: member.agentId,
    attribute: contract.identity.attribute,
    bucketRows,
    modifiers,
    exclusions,
    included,
    refs,
    sums,
  })
  if (modifierBlockers) return failure(modifierBlockers)
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
  if (preparation.kind === 'aria_single_self_ether_abloom') {
    if (member.mindscape >= 1) {
      const excessMas = Math.max(0, member.initialStats.anomMas - 100)
      const m1CritRate = 0.25 + excessMas * 0.005
      const m1CritDmg = 0.25
      sums['combat.anom_crit_'] = (sums['combat.anom_crit_'] ?? 0) + m1CritRate
      sums['combat.anom_crit_dmg_'] = (sums['combat.anom_crit_dmg_'] ?? 0) + m1CritDmg
      included.push('agent-aria:m1_energetic_sound_waves')
      refs.push(
        `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/1`,
      )
      exclusions.push({
        effectKey: 'agent-aria:m1_buildup_res_ignore',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['anomBuildupRes_'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/1`,
        ],
      })
    }
    if (member.mindscape >= 2) {
      const m2DefIgn = 0.16 + (preparation.momentOfDelusion ? 0.08 : 0)
      sums['combat.defIgn_'] = (sums['combat.defIgn_'] ?? 0) + m2DefIgn
      included.push('agent-aria:m2_fantastical_beat')
      refs.push(
        `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/2`,
      )
    }
    if (member.mindscape >= 3) {
      exclusions.push({
        effectKey: 'agent-aria:m3_delulu',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['skillLevels'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/3`,
        ],
      })
    }
    if (member.mindscape >= 4) {
      exclusions.push({
        effectKey: 'agent-aria:m4_mechanical_angel',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['energy', 'decibels', 'rotation'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/4`,
        ],
      })
    }
    if (member.mindscape >= 5) {
      exclusions.push({
        effectKey: 'agent-aria:m5_tears_in_the_rain',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['skillLevels'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/5`,
        ],
      })
    }
    if (member.mindscape >= 6) {
      exclusions.push({
        effectKey: 'agent-aria:m6_constructs_dream',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['decibels', 'actionDamageBonus', 'allOutCheering', 'rotation'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/6`,
        ],
      })
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
      attribute: contract.identity.attribute as 'physical' | 'ice' | 'ether',
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
          attribute: contract.identity.attribute as 'physical' | 'ice' | 'ether',
          targetId: input.baseline.enemy.id,
          buildupStateId: contextHash,
          buildup: 1,
          snapshotAtSeconds: 0,
          stats,
          instance: {
            kind:
              preparation.kind === 'promeia_single_self_ice_abloom' ||
              preparation.kind === 'aria_single_self_ether_abloom'
                ? 'abloom'
                : 'anomaly',
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
