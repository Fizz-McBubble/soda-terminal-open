import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from '../calculation/currentAgentMechanicContracts'
import {
  calculateCurrentPhoenixPlanningAnomalyEvent33,
  currentAgentPlanningEffectBlueprints,
} from '../calculation/currentAgentPlanningEffectBlueprint'
import {
  bindPhoenixDecisionAnomalySnapshot33,
  type PhoenixDecisionSnapshotInput33,
} from '../calculation/phoenixDecisionMechanic33'
import {
  phoenixEventSnapshot33Schema,
  type PhoenixEventSnapshot33Input,
} from '../calculation/phoenixEventSnapshot33'
import { calculatePhoenixHomogeneousOriginal33 } from '../calculation/phoenixHomogeneousAnomalyAdapter33'
import { phoenixAnomalyCritHash33 } from '../calculation/reviewedPhoenixAnomalyCrit33'
import {
  standardAnomalyBaseMultiplier,
  type AnomalyDamageCoreInput,
} from '../calculation/anomalyDamageCore'
import { aggregateOrdinaryAnomalySnapshots } from '../calculation/dynamic/ordinaryAnomalyAggregation'
import { evaluateCurrentPlanningEffectEntries32 } from '../calculation/currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from '../calculation/currentPlanningSelfEffects32'
import {
  effectReceiverMetadata,
  effectAttributeForReceiver,
} from '../calculation/currentPlanningEffectExpressions'
import {
  recipientIds,
  type SourceBackedPlanningEffectBucket,
} from '../calculation/currentPlanningDamageModifiers'
import { collectReviewedPreparedAnomalyModifiers32 } from '../calculation/reviewedPreparedAnomalyModifiers32'
import type {
  PreparedAnomalyExclusion32,
  PreparedAnomalyModifier32,
} from '../calculation/reviewedPreparedAnomalyEquipment32'
import { stableContentHash } from '../gameDataPacks/types'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import type { PlanningBaseline } from '../calculation/planningDpsContract'

export const phoenixCanonicalAnomalyBridge33 = 'soda-phoenix-canonical-anomaly-bridge/v1' as const
export const phoenixCanonicalScenario33 =
  'declared-complete-self-fire-original-basic-abloom-at-application' as const
export const phoenixOrdinaryScenario33 =
  'declared-complete-owner-ordinary-anomaly-with-phoenix-scorch' as const
export const phoenixCanonicalSourceMapping33 = {
  event:
    'phoenix-event-contract.3.3.json:eventContract.events[actionId=BasicAttackPurifyingFlame|UltimateSoulSearchingBlaze]; identity only, never direct damageMultiplier',
  cultivation:
    'existing equipped runtime member: explicit coreLevel/mindscape/skillLevels; potential remains separate',
  mastery: 'runtimeMember.initialStats.anomMas; never combat/final mastery',
  activation: 'evaluateCurrentAgentTeamActivation exact three members',
  selfProficiency:
    'source-compiled core_anomProf IR via existing planning effect runtime; once, self only',
  crit: 'calculateCurrentPhoenixPlanningAnomalyEvent33 ordinary / bindPhoenixDecisionAnomalySnapshot33 and calculateReviewedPhoenixAbloomSnapshot33 original named Abloom',
  original:
    'snapshot.originalAnomaly owner/target/contributions/buildup conservation/timeline; existing independent aggregation',
  basicFireCoefficient:
    'BasicAttackPurifyingFlame/Sinburn native1641005 + original fire: explicit ATK coefficient225%+20%*(basicLevel-1); legacy ratio packets and Ultimate retain their source units',
  standard:
    'explicit complete self fire share at local application coordinate t=0 with active Scorch, unchanged neutral target; static equipment panel slice; no conditional equipment passives, threshold, occurrence, duration or setup cost inferred',
} as const
export type PhoenixCanonicalEvent33 = {
  kind: 'ordinary_anomaly' | 'phoenix_abloom'
  binding: PhoenixDecisionSnapshotInput33
  /** Original contributions are preserved even for ordinary anomaly settlement. */
  snapshot: PhoenixEventSnapshot33Input
  consumedBuckets: SourceBackedPlanningEffectBucket[]
  unknownEffects: { effectKey: string; fields: string[]; sourceRefs: string[] }[]
  sourceRefs: string[]
  scenario: string
}

const fail = (...blockers: string[]) => ({ status: 'unsupported' as const, blockers })
const same = (a: unknown, b: unknown) => stableContentHash(a) === stableContentHash(b)

/** No contact packet, occurrence count, duration, tier or role enters this consumer. */
export function settlePhoenixCanonicalEvent33(packet: PhoenixCanonicalEvent33) {
  const { binding, snapshot } = packet
  const parsed = phoenixEventSnapshot33Schema.safeParse(snapshot)
  if (!parsed.success)
    return fail(
      ...parsed.error.issues.map(
        (issue) => `phoenix_snapshot_field:${issue.path.join('.')}:${issue.code}`,
      ),
    )
  if (
    !same([...binding.memberIds].sort(), [...snapshot.originalAnomaly.memberAgentIds].sort()) ||
    !same(binding.crit.phoenix, snapshot.phoenix) ||
    !same(binding.crit.scorchState, snapshot.scorchState) ||
    binding.recipient.targetId !== snapshot.targetId ||
    binding.recipient.eventId !== snapshot.eventId ||
    binding.recipient.atSeconds !== snapshot.atSeconds ||
    binding.crit.sourceIdentityHash !== snapshot.sourceIdentityHash ||
    binding.crit.existingAnomalyCritSource !== snapshot.existingAnomalyCritSource ||
    binding.crit.damageKind !== packet.kind
  )
    return fail('phoenix_canonical_snapshot_binding_conflict')
  const bound = bindPhoenixDecisionAnomalySnapshot33(binding)
  if (bound.status !== 'supported') return bound
  if (
    snapshot.originalAnomaly.contributions.some(
      (row) =>
        getCurrentAgentEventContract(row.ownerAgentId)?.identity.attribute !== row.attribute ||
        row.stats.anomalyCritRate !== 0 ||
        row.stats.anomalyCritDamage !== 0,
    )
  )
    return fail('phoenix_canonical_original_attribute_or_existing_crit_conflict')
  if (packet.kind === 'phoenix_abloom' && binding.crit.phoenixAbloomInstance !== snapshot.skill)
    return fail('phoenix_canonical_abloom_instance_mismatch')
  const sourceEvent = getCurrentAgentEventContract('agent-phoenix')?.eventContract.events.find(
    (row) => row.eventId === snapshot.eventId,
  )
  if (
    packet.kind === 'phoenix_abloom' &&
    sourceEvent?.actionId !==
      (snapshot.skill === 'basic_purifying_flame'
        ? 'BasicAttackPurifyingFlame'
        : 'UltimateSoulSearchingBlaze')
  )
    return fail('phoenix_canonical_named_skill_event_mismatch')
  // Reuse the existing strict snapshot schema and conservation/timeline checks
  // before using its original anomaly. Its Abloom result is not an ordinary proc.
  const abloom = calculatePhoenixHomogeneousOriginal33(snapshot)
  if (abloom.status !== 'supported') return fail(...abloom.blockers, abloom.reason)
  let expectedDamage = abloom.damage.expectedDamage
  if (packet.kind === 'ordinary_anomaly') {
    if (
      binding.recipient.ownerAgentId !== snapshot.originalAnomaly.ownerAgentId ||
      snapshot.atSeconds !== snapshot.originalAnomaly.atSeconds
    )
      return fail('phoenix_ordinary_original_owner_or_application_time_mismatch')
    const rows = snapshot.originalAnomaly.contributions
    const homogeneous = rows.every((row) => same(row.stats, rows[0]!.stats))
    const aggregate = homogeneous
      ? { virtualSnapshot: rows[0]!.stats }
      : aggregateOrdinaryAnomalySnapshots({
          rows,
          effectiveAgentBuildup: snapshot.originalAnomaly.totalBuildup,
        })
    const original: AnomalyDamageCoreInput = {
      ...aggregate.virtualSnapshot,
      ...snapshot.originalAnomaly.target,
      baseMultiplier: standardAnomalyBaseMultiplier(snapshot.originalAnomaly.attribute),
    }
    const ordinary = calculateCurrentPhoenixPlanningAnomalyEvent33({
      ...binding,
      snapshot: original,
    })
    if (ordinary.status !== 'supported') return ordinary
    expectedDamage = ordinary.damage.expectedDamage
  }
  return {
    status: packet.unknownEffects.length ? ('partial' as const) : ('supported' as const),
    fixedEventValue: expectedDamage,
    consumedBuckets: packet.consumedBuckets,
    unknownEffects: packet.unknownEffects,
    exclusions: [],
    relevantEquipmentExclusions: [],
    sourceRefs: [...new Set([...packet.sourceRefs, ...bound.sourceRefs, ...abloom.sourceRefs])],
    identity: stableContentHash({
      bridge: phoenixCanonicalAnomalyBridge33,
      mapping: phoenixCanonicalSourceMapping33,
      packet,
      expectedDamage,
    }),
    binding: bound,
    abloom: packet.kind === 'phoenix_abloom' ? abloom : null,
    boundary: 'one_named_anomaly_event_no_frequency_duration_rotation_or_dps' as const,
  }
}

/** Opt-in finite comparison condition, not an observed proc or time-to-proc.
 * t=0 is the local application coordinate. Unit buildup is a 100% self share,
 * not a game threshold. Neutral entries below declare absent modifiers within
 * this slice; missing required panel/condition values are never filled. */
export function createStandardPhoenixCanonicalEvent33(input: {
  memberIds: readonly [string, string, string]
  subjectAgentId?: string
  members: readonly PlanningEffectRuntimeMember[]
  baseline: PlanningBaseline
  references: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}) {
  const phoenix = input.members.find((row) => row.agentId === 'agent-phoenix')
  const owner = input.members.find(
    (row) => row.agentId === (input.subjectAgentId ?? 'agent-phoenix'),
  )
  const ordinary = owner?.agentId !== 'agent-phoenix'
  const ownerContract = owner && getCurrentAgentEventContract(owner.agentId)
  if (!owner || !ownerContract || ownerContract.identity.specialty !== 'anomaly')
    return fail('phoenix_standard_requires_registered_anomaly_owner')
  // These actors have separately reviewed existing anomaly crit; never declare
  // it absent or import ordinary CR/CD into the Phoenix stacking equation.
  if (owner.agentId === 'agent-jane' || (owner.agentId === 'agent-aria' && owner.mindscape >= 1))
    return fail(`phoenix_standard_existing_anomaly_crit_stacking_unreviewed:${owner.agentId}`)
  const attribute = ownerContract.identity.attribute
  const scenario = ordinary ? phoenixOrdinaryScenario33 : phoenixCanonicalScenario33
  if (
    !phoenix ||
    !Number.isInteger(phoenix.mindscape) ||
    !Number.isInteger(phoenix.coreLevel) ||
    !Number.isFinite(phoenix.initialStats.anomMas) ||
    !Number.isFinite(phoenix.finalStats.anomProf) ||
    !Number.isFinite(owner.finalStats.pen) ||
    !Number.isFinite(owner.finalStats.damageBonusesByAttribute?.[attribute])
  )
    return fail('phoenix_standard_requires_explicit_cultivation_initial_mastery_and_panel')
  const activation = evaluateCurrentAgentTeamActivation({
    stableId: 'agent-phoenix',
    memberIds: input.memberIds,
  })
  if (activation.status !== 'supported') return activation
  const event = getCurrentAgentEventContract('agent-phoenix')?.eventContract.events.find(
    (row) => row.actionId === 'BasicAttackPurifyingFlame',
  )
  if (!event) return fail('phoenix_standard_named_basic_abloom_source_missing')
  const entries = currentAgentPlanningEffectBlueprints.filter((entry) => {
    if (!input.memberIds.includes(entry.providerAgentId) || entry.applicationScope === 'event_only')
      return false
    const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const effectAttribute = effectAttributeForReceiver(metadata.receiverPath)
    return (
      (effectAttribute === null || effectAttribute === attribute) &&
      (metadata.damageType === null || metadata.damageType === 'anomaly') &&
      recipientIds({
        ...entry,
        memberIds: input.memberIds,
        receiverPath: metadata.receiverPath,
      }).includes(owner.agentId) &&
      /(?:^|\.)(?:atk|atk_|anomProf|common_dmg_|dmg_|buff_|pen_|defIgn_|resIgn_|defRed_|resRed_|dmgInc_|stun_)(?:\.|$)/.test(
        metadata.receiverPath ?? '',
      )
    )
  })
  const runtime = evaluateCurrentPlanningEffectEntries32(
    {
      memberIds: input.memberIds,
      members: input.members,
      baselineReferencesByAgentId: input.references,
    },
    entries,
  )
  if (runtime.status !== 'supported') return runtime
  const consumedBuckets = planningRuntimeEffectBuckets32(runtime.results, input.memberIds)
  const modifiers: PreparedAnomalyModifier32[] = []
  const exclusions: PreparedAnomalyExclusion32[] = []
  const refs = [
    `phoenix-canonical-scenario:${scenario}`,
    `${ownerContract.source.formulaPath}#${ownerContract.source.formulaSha256}`,
    `${getCurrentAgentEventContract('agent-phoenix')!.source.formulaPath}#${getCurrentAgentEventContract('agent-phoenix')!.source.formulaSha256}`,
  ]
  const sums: Record<string, number> = {}
  const blockers = collectReviewedPreparedAnomalyModifiers32({
    agentId: owner.agentId,
    attribute,
    bucketRows: consumedBuckets,
    modifiers,
    exclusions,
    included: [],
    refs,
    sums,
  })
  if (blockers) return fail(...blockers)
  const unknownEffects = runtime.results.flatMap((row) =>
    row.status === 'excluded_unknown'
      ? [{ effectKey: row.effectKey, fields: row.missing, sourceRefs: row.sourceRefs }]
      : [],
  )
  unknownEffects.push(
    ...exclusions.map((row) => ({
      effectKey: row.effectKey,
      fields: row.fields,
      sourceRefs: row.sourceRefs,
    })),
  )
  const n = (key: string) => sums[key] ?? 0 // Empty sum of admitted modifiers, never an observation fallback.
  const final = owner.finalStats
  const stats = {
    attackerLevel: owner.level!,
    attack: final.atk + owner.initialStats.atk * n('combat.atk_') + n('combat.atk'),
    anomalyProficiency: final.anomProf + n('combat.anomProf'),
    anomalyBaseBonus: 0,
    flatAnomalyDamage: 0,
    anomalyCritRate: 0,
    anomalyCritDamage: 0,
    damageBonus:
      final.damageBonusesByAttribute![attribute]! + n('combat.common_dmg_') + n('combat.dmg_'),
    buffBonus: n('combat.buff_'),
    directDamageBonus: 0,
    defenseIgnore: n('combat.defIgn_'),
    penetrationRatio: final.pen_ + n('combat.pen_'),
    penetrationFlat: final.pen!,
    resistanceIgnore: n('combat.resIgn_'),
  }
  const targetId = input.baseline.enemy.id
  const eventId = ordinary ? `${scenario}:${owner.agentId}:${attribute}:application` : event.eventId
  const stateId = `${scenario}:${owner.agentId}:${attribute}`
  const snapshot: PhoenixEventSnapshot33Input = {
    sourceIdentityHash: phoenixAnomalyCritHash33,
    targetId,
    eventId,
    atSeconds: 0,
    skill: 'basic_purifying_flame',
    ...(!ordinary && attribute === 'fire'
      ? { coefficientBasis: 'sinburn_fire_attack_coefficient' as const } : {}),
    skillLevel: phoenix.skillLevels.basic,
    phoenix: {
      coreLevel: phoenix.coreLevel,
      mindscape: phoenix.mindscape,
      initialAnomalyMastery: phoenix.initialStats.anomMas,
      additionalAbilityActive: activation.active,
    },
    scorchState: { active: true, targetId, eventId, appliedAtSeconds: 0, currentAtSeconds: 0 },
    existingAnomalyCritSource: 'none',
    originalAnomaly: {
      eventId: `${scenario}:ordinary-${attribute}-application`,
      ownerAgentId: owner.agentId,
      memberAgentIds: [...input.memberIds],
      attribute: attribute as PhoenixEventSnapshot33Input['originalAnomaly']['attribute'],
      targetId,
      atSeconds: 0,
      activeAtEvent: true,
      targetConditionsUnchangedAtEvent: true,
      buildupStateId: stateId,
      totalBuildup: 1,
      target: {
        enemyDefense: input.baseline.enemy.defense,
        resistance: input.baseline.enemy.resistance,
        defenseReduction: n('enemy.defRed_') + n('enemyDebuff.common.defRed_'),
        resistanceReduction: n('enemy.resRed_') + n('enemyDebuff.common.resRed_'),
        vulnerability:
          input.baseline.enemy.vulnerability + n('enemy.dmgInc_') + n('enemyDebuff.common.dmgInc_'),
        stunMultiplier:
          input.baseline.enemy.stunMultiplier + n('enemy.stun_') + n('enemyDebuff.common.stun_'),
      },
      contributions: [
        {
          id: 'declared-complete-owner-snapshot',
          ownerAgentId: owner.agentId,
          attribute: attribute as PhoenixEventSnapshot33Input['originalAnomaly']['attribute'],
          targetId,
          buildupStateId: stateId,
          buildup: 1,
          snapshotAtSeconds: 0,
          stats,
        },
      ],
    },
  }
  const binding: PhoenixDecisionSnapshotInput33 = {
    memberIds: input.memberIds,
    recipient: {
      kind: 'anomaly_snapshot',
      ownerAgentId: owner.agentId,
      targetId,
      eventId,
      atSeconds: 0,
    },
    crit: {
      sourceIdentityHash: snapshot.sourceIdentityHash,
      targetId,
      eventId,
      phoenix: snapshot.phoenix as PhoenixDecisionSnapshotInput33['crit']['phoenix'],
      scorchState: snapshot.scorchState,
      existingAnomalyCritSource: 'none',
      damageKind: ordinary ? 'ordinary_anomaly' : 'phoenix_abloom',
      ...(ordinary ? {} : { phoenixAbloomInstance: snapshot.skill }),
    },
  }
  const packet: PhoenixCanonicalEvent33 = {
    kind: ordinary ? 'ordinary_anomaly' : 'phoenix_abloom',
    binding,
    snapshot,
    consumedBuckets,
    unknownEffects,
    sourceRefs: refs,
    scenario,
  }
  return { status: 'ready' as const, packet }
}

export function phoenixCanonicalPacketIdentity33(packet: PhoenixCanonicalEvent33) {
  const standard = [phoenixCanonicalScenario33, phoenixOrdinaryScenario33].some(
    (scenario) => scenario === packet.scenario,
  )
  return stableContentHash({
    bridge: phoenixCanonicalAnomalyBridge33,
    kind: packet.kind,
    scenario: packet.scenario,
    source: packet.binding.crit.sourceIdentityHash,
    recipient: packet.binding.recipient,
    skill: packet.snapshot.skill,
    coefficientBasis: packet.snapshot.coefficientBasis ?? 'original_anomaly_multiplier',
    phoenixInvestment: {
      coreLevel: packet.binding.crit.phoenix.coreLevel,
      mindscape: packet.binding.crit.phoenix.mindscape,
      initialAnomalyMastery: packet.binding.crit.phoenix.initialAnomalyMastery,
    },
    scorchState: packet.binding.crit.scorchState,
    skillLevel: packet.snapshot.skillLevel,
    chainSkillLevel: packet.snapshot.chainSkillLevel,
    original: {
      ...packet.snapshot.originalAnomaly,
      memberAgentIds: undefined,
      contributions: packet.snapshot.originalAnomaly.contributions.map(({ stats, ...row }) => ({
        ...row,
        ...(standard ? {} : { stats }),
      })),
      target: standard ? undefined : packet.snapshot.originalAnomaly.target,
    },
  })
}
