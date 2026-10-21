import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { publicAnomalySnapshotStatsSchema32 } from '../application/publicAnomalySnapshotStats32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { projectCurrentPlanningConditionCatalog32 } from './currentPlanningConditionCatalog32'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { compilePlanningAnomalyLifecycle32 } from './currentPlanningAnomalyLifecycle32'
import {
  planningAnomalyLifecycleHash32,
  planningAnomalyLifecycleIdentity32,
} from './currentPlanningAnomalyLifecycleIdentity32'
import {
  commonAnomalySettlementHash32,
  commonAnomalySettlementIdentity32,
} from './currentCommonAnomalySettlementIdentity32'
import {
  calculateAnomalyDamageCore,
  disorderBaseMultiplier,
  type DisorderAttribute,
} from './anomalyDamageCore'
import {
  compileReviewedPreparedAnomalyEquipment32,
  type PreparedAnomalyExclusion32,
} from './reviewedPreparedAnomalyEquipment32'
import { collectReviewedPreparedAnomalyModifiers32 } from './reviewedPreparedAnomalyModifiers32'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type { PlanningBaseline } from './planningDpsContract'

const time = z.number().finite().nonnegative()
export const preparedYanagiPolaritySchema32 = z
  .object({
    kind: z.literal('yanagi_ex_single_polarity'),
    acceptedSingleOwnerOriginalAnomaly: z.literal(true),
    snapshotBasis: z.literal('current_declared_panels'),
    originalOwnerAgentId: z.string().trim().min(1),
    applicationAtSeconds: time,
    activeUntilSeconds: time,
    endedAtSeconds: time.nullable(),
    triggerAtSeconds: time,
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
export type PreparedYanagiPolarity32 = z.infer<typeof preparedYanagiPolaritySchema32>

const ownedKeys = [
  'agent-yanagi:exSpecial_anom_base_',
  'agent-yanagi:exSpecial_anom_flat_dmg',
  'agent-yanagi:core_addl_disorder_',
] as const
export const reviewedPreparedPolarityObjectiveIdentity32 = Object.freeze({
  version: 'prepared-single-owner-original-yanagi-ex-polarity/v1',
  commit: commonAnomalySettlementIdentity32.commit,
  formulaSha256: '5FFF32C390B426C1CAFF95FDD0EE6C744EF8D2FDCBD3A7F24D378C2EDEB921A2',
  lifecycle: planningAnomalyLifecycleHash32,
  arithmetic: commonAnomalySettlementIdentity32.arithmeticCoreHash,
  sourceEffects: ownedKeys,
  snapshot: 'explicit-current-declared-panels-single-owner; typed-disorder-modifiers',
  expression:
    '(original-ATK*disorder-MV*source-ratio+source-Yanagi-AP-term)*original-disorder-factors',
  frost: 'locked-char-util-isMiyabi; source-upstream-key-Miyabi-only',
  scope: 'one-sourced-EX-downward-hit; no-ordinary-hit-sum-no-frequency-no-DPS',
})
export const reviewedPreparedPolarityObjectiveHash32 = stableContentHash(
  reviewedPreparedPolarityObjectiveIdentity32,
)
type Equipment = Omit<Parameters<typeof compileReviewedPreparedAnomalyEquipment32>[0], 'member'>
export type ReviewedPreparedPolarityInput32 = {
  member: PlanningEffectRuntimeMember
  members?: readonly PlanningEffectRuntimeMember[]
  baseline: PlanningBaseline
  preparation: PreparedYanagiPolarity32
  effectBuckets?: readonly SourceBackedPlanningEffectBucket[]
  equipmentModifierBuckets?: readonly SourceBackedPlanningEffectBucket[]
  wEngine?: Equipment['wEngine']
  discs?: Equipment['discs']
  /** An explicit empty object declares no dynamic original-owner equipment effects. */
  originalEquipment?: Equipment
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  sourceIdentityHash?: string
}
const boundary =
  '一次显式准备态柳EX下落攻击触发的极性紊乱；原异常为声明的单一代理人来源，按当前声明面板生成快照。只消费已提供的来源修正及装备状态，其他自身/潜能状态不推断；不包含获取异常/能量成本、普通EX直伤、频率或全周期DPS。'

/** Two owners remain distinct: the original snapshot owns its damage factors;
 * the sourced AP addend reads Yanagi at the trigger. No ordinary-anomaly crit
 * or buff is silently borrowed into the Disorder snapshot. */
export function evaluateReviewedPreparedPolarityObjective32(
  input: ReviewedPreparedPolarityInput32,
) {
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
  const parsed = preparedYanagiPolaritySchema32.safeParse(input.preparation)
  if (!parsed.success) return failure(['prepared_polarity_declaration_invalid'])
  const preparation = parsed.data
  if (
    input.sourceIdentityHash !== undefined &&
    input.sourceIdentityHash !== reviewedPreparedPolarityObjectiveHash32
  )
    return failure(['prepared_polarity_source_identity_mismatch'])
  const members = (input.members ?? [input.member]).map((row) =>
    row.agentId === input.member.agentId ? input.member : row,
  )
  const ids = members.map((row) => row.agentId)
  const owner = members.find((row) => row.agentId === preparation.originalOwnerAgentId)
  const actor = input.member
  if (
    actor.agentId !== 'agent-yanagi' ||
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    !ids.includes(actor.agentId) ||
    !owner
  )
    return failure(['prepared_polarity_formation_identity_invalid'])
  const contracts = members.map((row) => getCurrentAgentEventContract(row.agentId))
  const originalContract = getCurrentAgentEventContract(owner.agentId)!
  if (
    contracts.some(
      (row) => !row || row.source.commit !== reviewedPreparedPolarityObjectiveIdentity32.commit,
    ) ||
    getCurrentAgentEventContract(actor.agentId)!.source.formulaSha256 !==
      reviewedPreparedPolarityObjectiveIdentity32.formulaSha256
  )
    return failure(['prepared_polarity_actor_source_mismatch'])
  if (
    !/^3\.2(?:$|-)/.test(input.baseline.gameVersion) ||
    members.some(
      (row) =>
        !Number.isInteger(row.level) ||
        row.level! < 1 ||
        row.level! > 60 ||
        !Number.isInteger(row.mindscape) ||
        row.mindscape < 0 ||
        row.mindscape > 6 ||
        !Number.isInteger(row.coreLevel) ||
        row.coreLevel < 1 ||
        row.coreLevel > 7,
    ) ||
    !Number.isInteger(actor.skillLevels.special) ||
    actor.skillLevels.special! < 1 ||
    actor.skillLevels.special! > 15
  )
    return failure(['prepared_polarity_actor_domain_invalid'])
  const attribute = originalContract.identity.attribute
  if (!['physical', 'fire', 'ice', 'electric', 'ether', 'wind'].includes(attribute))
    return failure(['prepared_polarity_original_attribute_unsupported'])
  if (owner.agentId !== actor.agentId && input.originalEquipment === undefined)
    return failure(['prepared_polarity_original_equipment_declaration_required'])
  if (owner.agentId === actor.agentId && input.originalEquipment !== undefined)
    return failure(['prepared_polarity_self_original_uses_compared_equipment'])
  const references = input.baselineReferencesByAgentId?.[actor.agentId] ?? {}
  if (Object.keys(references).some((key) => /^(?:own|target|team|char|dm)\./.test(key)))
    return failure(['prepared_polarity_reserved_reference_override'])
  if (Object.hasOwn(references, 'anomalyLifecycle32'))
    return failure(['prepared_polarity_duplicate_lifecycle_declaration'])
  if (
    references.anomTimePassed !== undefined &&
    references.anomTimePassed !== preparation.triggerAtSeconds - preparation.applicationAtSeconds
  )
    return failure(['prepared_polarity_clock_reference_conflict'])
  if (
    references['polarityDisorder.value'] !== undefined &&
    references['polarityDisorder.value'] !== 1
  )
    return failure(['prepared_polarity_trigger_condition_conflict'])
  if (references.thrusts !== undefined) {
    const domain = projectCurrentPlanningConditionCatalog32({
      subjectAgentId: actor.agentId,
      memberIds: ids,
    }).defs.find((row) => row.referenceKey === 'thrusts')
    if (
      domain?.valueKind !== 'number' ||
      !Number.isFinite(domain.minimum) ||
      !Number.isFinite(domain.maximum) ||
      typeof references.thrusts !== 'number' ||
      !Number.isInteger(references.thrusts) ||
      references.thrusts < domain.minimum! ||
      references.thrusts > domain.maximum!
    )
      return failure(['prepared_polarity_thrust_reference_invalid'])
  }
  const ordered = [...members].sort((a, b) => a.agentId.localeCompare(b.agentId))
  const context = {
    objective: 'prepared_single_yanagi_ex_polarity' as const,
    preparation,
    members: [...ids].sort(),
    actors: ordered.map((row) => ({
      agentId: row.agentId,
      level: row.level,
      mindscape: row.mindscape,
      coreLevel: row.coreLevel,
      skillLevels: row.skillLevels,
      potential: row.potential ?? null,
    })),
    // Only the optimized actor's current panels may change between candidate sides.
    anchors: ordered.filter((row) => row.agentId !== actor.agentId),
    originalEquipment: owner.agentId === actor.agentId ? null : input.originalEquipment,
    enemy: input.baseline.enemy,
    references: input.baselineReferencesByAgentId ?? {},
    equipmentState: input.wEngine?.runtime ?? null,
    sourceIdentityHash: reviewedPreparedPolarityObjectiveHash32,
    frequency: null,
    duration: null,
  }
  const contextHash = stableContentHash(context)
  const identity = { ...context, contextHash }
  const refs = [
    ...preparation.sourceRefs,
    ...commonAnomalySettlementIdentity32.sources.map((r) => `${r.path}#${r.sha256}`),
  ]
  const excluded: PreparedAnomalyExclusion32[] = []
  const included: string[] = []
  const supplied = input.effectBuckets ?? []
  const otherBuckets = supplied.filter(
    (row) => !ownedKeys.includes(row.effectKey as (typeof ownedKeys)[number]),
  )
  const snapshot = (
    member: PlanningEffectRuntimeMember,
    settlementType: 'anomaly' | 'disorder',
    equipment: Equipment,
    triggerApOnly = false,
  ) => {
    const compiled = compileReviewedPreparedAnomalyEquipment32({ member, ...equipment })
    if (compiled.status !== 'supported') throw Error(compiled.blockers.join(';'))
    excluded.push(...compiled.exclusions)
    const sums: Record<string, number> = {}
    const modifiers = [...compiled.modifiers]
    const rows = [
      ...otherBuckets,
      ...(!equipment.wEngine && !equipment.discs ? (input.equipmentModifierBuckets ?? []) : []),
    ]
    if (triggerApOnly)
      for (const row of rows.filter(
        (r) =>
          r.recipientAgentIds.includes(member.agentId) &&
          (r.damageType !== null || r.action !== null || r.applicationScope === 'event_only'),
      ))
        excluded.push({
          effectKey: row.effectKey,
          reason: 'outside_polarity_trigger_AP_scope',
          fields: [row.damageType ?? '', row.action ?? ''],
          sourceRefs: row.sourceRefs,
        })
    const blockers = collectReviewedPreparedAnomalyModifiers32({
      agentId: member.agentId,
      attribute: getCurrentAgentEventContract(member.agentId)!.identity.attribute,
      bucketRows: rows.filter(
        (row) =>
          !triggerApOnly ||
          (row.damageType === null && row.action === null && row.applicationScope !== 'event_only'),
      ),
      modifiers,
      exclusions: excluded,
      included,
      refs,
      sums,
      settlementType,
    })
    if (blockers) throw Error(blockers.join(';'))
    const final = member.finalStats
    const stats = publicAnomalySnapshotStatsSchema32.parse({
      attackerLevel: member.level,
      attack:
        final.atk +
        member.initialStats.atk * (sums['combat.atk_'] ?? 0) +
        (sums['combat.atk'] ?? 0),
      anomalyProficiency: final.anomProf + (sums['combat.anomProf'] ?? 0),
      anomalyBaseBonus: sums['combat.anom_base_'] ?? 0,
      flatAnomalyDamage: sums['combat.anom_flat_dmg'] ?? 0,
      anomalyCritRate: sums['combat.anom_crit_'] ?? 0,
      anomalyCritDamage: sums['combat.anom_crit_dmg_'] ?? 0,
      damageBonus:
        (final.damageBonusesByAttribute?.[
          getCurrentAgentEventContract(member.agentId)!.identity.attribute
        ] ??
          final.damageBonus ??
          0) +
        (sums['combat.common_dmg_'] ?? 0) +
        (sums['combat.dmg_'] ?? 0),
      buffBonus: (final.buffBonus ?? 0) + (sums['combat.buff_'] ?? 0),
      directDamageBonus: 0,
      defenseIgnore: sums['combat.defIgn_'] ?? 0,
      penetrationRatio: final.pen_ + (sums['combat.pen_'] ?? 0),
      penetrationFlat: final.pen ?? 0,
      resistanceIgnore: sums['combat.resIgn_'] ?? 0,
    })
    return { stats, sums }
  }
  try {
    const originalEquipment =
      owner.agentId === actor.agentId
        ? { wEngine: input.wEngine, discs: input.discs }
        : input.originalEquipment!
    const ordinary = snapshot(owner, 'anomaly', originalEquipment)
    const disorder = snapshot(owner, 'disorder', originalEquipment)
    const trigger = snapshot(
      actor,
      'disorder',
      { wEngine: input.wEngine, discs: input.discs },
      true,
    )
    if (disorder.stats.anomalyBaseBonus !== 0 || disorder.stats.flatAnomalyDamage !== 0)
      return failure(['prepared_polarity_original_base_override_unqualified'])
    const stateId = stableContentHash({ preparation, ordinary: ordinary.stats, contextHash })
    const lifecycle = {
      sourceIdentityHash: planningAnomalyLifecycleHash32,
      application: {
        sourceIdentityHash: commonAnomalySettlementHash32,
        eventId: 'prepared_original_anomaly',
        triggerAgentId: owner.agentId,
        memberAgentIds: ids,
        attribute,
        targetId: input.baseline.enemy.id,
        atSeconds: preparation.applicationAtSeconds,
        buildupStateId: stateId,
        totalBuildup: 1,
        sourceRefs: [...refs],
        target: {
          enemyDefense: input.baseline.enemy.defense,
          resistance: input.baseline.enemy.resistance,
          defenseReduction: 0,
          resistanceReduction: 0,
          vulnerability: input.baseline.enemy.vulnerability,
          stunMultiplier: input.baseline.enemy.stunMultiplier,
          sourceRefs: [...refs],
        },
        contributions: [
          {
            id: 'declared-complete-original-snapshot',
            ownerAgentId: owner.agentId,
            ownerKind: 'agent',
            attribute,
            targetId: input.baseline.enemy.id,
            buildupStateId: stateId,
            buildup: 1,
            snapshotAtSeconds: preparation.applicationAtSeconds,
            stats: ordinary.stats,
            instance: { kind: 'anomaly', motionValueMultiplier: 1 },
            sourceRefs: [...refs],
          },
        ],
      },
      activeUntilSeconds: preparation.activeUntilSeconds,
      endedAtSeconds: preparation.endedAtSeconds,
      event: {
        eventId: planningAnomalyLifecycleIdentity32.yanagi.triggerEventId,
        ownerAgentId: actor.agentId,
        targetId: input.baseline.enemy.id,
        atSeconds: preparation.triggerAtSeconds,
      },
      sourceRefs: [...refs],
    }
    const state = compilePlanningAnomalyLifecycle32({ declaration: lifecycle, memberIds: ids })
    if (state.status !== 'supported') return failure(state.blockers)
    const done = (
      damage: number,
      ratio: number,
      triggered: boolean,
      originalDisorderDamage: number,
      apTerm: number,
    ) => {
      const core = {
        status: 'supported' as const,
        totalDamage: damage,
        settlementDamage: damage,
        modeledDirectDamage: null,
        planningDps: null,
        identity,
        contextHash,
        sourceRefs: [...new Set(refs)].sort(),
        included: [...new Set(included)].sort(),
        excluded,
        boundary,
        formalCycleReady: false as const,
        triggered,
        snapshot: disorder.stats,
        motionValueMultiplier: ratio,
        originalDisorderDamage,
        yanagiProficiencyBaseTerm: apTerm,
        ownership: { originalOwnerAgentId: owner.agentId, proficiencyOwnerAgentId: actor.agentId },
      }
      return { ...core, runtimeHash: stableContentHash({ core, input }) }
    }
    if (!state.active) return done(0, 0, false, 0, 0)
    if (references.exSpecial_used === false)
      return failure(['prepared_polarity_trigger_condition_conflict'])
    const triggerMember = {
      ...actor,
      finalStats: { ...actor.finalStats, anomProf: trigger.stats.anomalyProficiency },
    }
    const source = evaluateCurrentPlanningEffectEntries32(
      {
        memberIds: ids,
        members: members.map((row) => (row.agentId === actor.agentId ? triggerMember : row)),
        baselineReferencesByAgentId: {
          ...input.baselineReferencesByAgentId,
          [actor.agentId]: { ...references, anomalyLifecycle32: lifecycle, exSpecial_used: true },
        },
      },
      ownedKeys.map((key) => getCurrentAgentPlanningEffectBlueprint(key)!),
    )
    if (source.status !== 'supported') return failure(source.blockers)
    if (source.results.some((row) => row.status !== 'supported'))
      return failure(['prepared_polarity_source_effect_unresolved'])
    const produced = planningRuntimeEffectBuckets32(source.results, ids)
    for (const row of supplied.filter((r) =>
      ownedKeys.includes(r.effectKey as (typeof ownedKeys)[number]),
    )) {
      const actual = produced.find(
        (r) => r.effectKey === row.effectKey && r.recipientAgentIds.includes(owner.agentId),
      )
      if (
        !actual ||
        row.value !== actual.value ||
        !row.recipientAgentIds.includes(owner.agentId) ||
        row.providerAgentId !== actor.agentId ||
        row.receiverPath !== actual.receiverPath ||
        row.damageType !== actual.damageType ||
        row.application !== actual.application
      )
        return failure(['prepared_polarity_duplicate_source_conflict'])
    }
    const get = (key: string) =>
      produced.find((row) => row.effectKey === key && row.recipientAgentIds.includes(owner.agentId))
    const ratioRow = get(ownedKeys[0]),
      flatRow = get(ownedKeys[1]),
      coreRow = get(ownedKeys[2])
    if (!ratioRow || !flatRow || !coreRow)
      return failure(['prepared_polarity_original_receiver_unbound'])
    const ratio = 1 + ratioRow.value
    if (!Number.isFinite(ratio) || ratio <= 0 || flatRow.value < 0)
      return failure(['prepared_polarity_coefficient_invalid'])
    refs.push(...produced.flatMap((row) => row.sourceRefs))
    included.push(...ownedKeys)
    const sums = disorder.sums
    const target = {
      enemyDefense: input.baseline.enemy.defense,
      resistance: input.baseline.enemy.resistance,
      defenseReduction: (sums['enemy.defRed_'] ?? 0) + (sums['enemyDebuff.common.defRed_'] ?? 0),
      resistanceReduction: (sums['enemy.resRed_'] ?? 0) + (sums['enemyDebuff.common.resRed_'] ?? 0),
      vulnerability:
        input.baseline.enemy.vulnerability +
        (sums['enemy.dmgInc_'] ?? 0) +
        (sums['enemyDebuff.common.dmgInc_'] ?? 0),
      stunMultiplier:
        input.baseline.enemy.stunMultiplier +
        (sums['enemy.stun_'] ?? 0) +
        (sums['enemyDebuff.common.stun_'] ?? 0),
    }
    const baseMultiplier = disorderBaseMultiplier({
      attribute:
        originalContract.upstreamKey === 'Miyabi' ? 'frost' : (attribute as DisorderAttribute),
      frost: originalContract.upstreamKey === 'Miyabi',
      elapsedSeconds: state.elapsedSeconds!,
      additionalDisorderMultiplier: coreRow.value + (sums['combat.addl_disorder_'] ?? 0),
    })
    const original = calculateAnomalyDamageCore({ ...disorder.stats, ...target, baseMultiplier })
    const result = calculateAnomalyDamageCore({
      ...disorder.stats,
      ...target,
      baseMultiplier,
      anomalyBaseBonus: ratio - 1,
      flatAnomalyDamage: flatRow.value,
    })
    if (!Number.isFinite(result.expectedDamage) || result.expectedDamage < 0)
      return failure(['prepared_polarity_damage_invalid'])
    excluded.push({
      effectKey: 'unmodeled:polarity-direct-and-cycle',
      reason: '未计普通EX直伤、准备成本、频率及未提供的自身/潜能修正。',
      fields: [
        'ordinaryDirectDamage',
        'preparationCost',
        'frequency',
        'undeclaredSelfOrPotentialEffects',
      ],
      sourceRefs: refs,
    })
    return done(result.expectedDamage, ratio, true, original.expectedDamage, flatRow.value)
  } catch (error) {
    return failure([error instanceof Error ? error.message : 'prepared_polarity_settlement_failed'])
  }
}
