import { createSavedDeclaredLuminizeSettlement32 } from '../accounts/luminizePlanPersistence32'
import { getAgentSkillMaxFor, regularAgentSkillFields } from '../accounts/agentProgressionRules'
import { contentHash } from '../application/contentHash'
import {
  accountLuminizeEquipmentBoundary32,
  luminizeEquipmentComparisonOptionsSchema32,
  luminizeEquipmentSnapshotSchema32,
  type LuminizeEquipmentComparisonOptions32,
  type LuminizeEquipmentSnapshot32,
} from '../application/publicLuminizeComparison32'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectDomain'
import {
  declaredLuminizeSettlementSchema32,
  type DeclaredLuminizeSettlement32,
} from '../calculation/luminizeSettlementContract32'
import { planningBaselineSchema, type PlanningBaseline } from '../calculation/planningDpsContract'
import { evaluateReviewedLuminizeSettlement32 } from '../calculation/reviewedLuminizeSettlement32'
import {
  evaluateReviewedRefringeCoefficient32,
  reviewedLumifluxMechanicsHash32,
  reviewedLumifluxMechanicsIdentity32,
} from '../calculation/reviewedLumifluxMechanics32'

export { accountLuminizeEquipmentBoundary32 } from '../application/publicLuminizeComparison32'

const ordinaryAttributes = ['physical', 'fire', 'ice', 'electric', 'ether', 'wind'] as const
const skillFields = {
  rainbows_end: 'basic',
  fleeting_grace: 'basic',
  ultimate: 'chain',
  flower_feather: 'assist',
} as const

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const integerBetween = (value: unknown, minimum: number, maximum: number) =>
  finite(value) && Number.isInteger(value) && value >= minimum && value <= maximum
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Input members must come from compileTargetTeamPlanningMembers, before combat
 * effects. This creates a new counterfactual; it never updates an older saved
 * declaration or treats a final combat panel as a historical capture. */
export function projectAccountLuminizeEquipmentSnapshot32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  memberIds: readonly string[]
  options: LuminizeEquipmentComparisonOptions32
  baseline: PlanningBaseline
  assetBindingFingerprint: string
  sourceRefs: readonly string[]
}): LuminizeEquipmentSnapshot32 {
  const failure = (...blockers: string[]): LuminizeEquipmentSnapshot32 =>
    luminizeEquipmentSnapshotSchema32.parse({
      status: 'unsupported',
      basis: 'account_equipment_static_preparation',
      assetBindingFingerprint: nonempty(input.assetBindingFingerprint)
        ? input.assetBindingFingerprint
        : 'unbound',
      snapshot: null,
      totalDamage: null,
      blockers,
      boundary: accountLuminizeEquipmentBoundary32,
    })
  const options = luminizeEquipmentComparisonOptionsSchema32.safeParse(input.options)
  const baseline = planningBaselineSchema.safeParse(input.baseline)
  if (!options.success) return failure('luminize_equipment_options_invalid')
  if (
    !baseline.success ||
    !/^3\.2(?:$|[.-])/u.test(baseline.data.gameVersion) ||
    !nonempty(baseline.data.enemy.id) ||
    !Object.values(baseline.data.enemy).every((value) => typeof value === 'string' || finite(value))
  )
    return failure('luminize_equipment_target_invalid')
  if (
    !nonempty(input.assetBindingFingerprint) ||
    !Array.isArray(input.sourceRefs) ||
    !input.sourceRefs.length ||
    !input.sourceRefs.every(nonempty)
  )
    return failure('luminize_equipment_source_binding_missing')
  if (
    input.memberIds.length !== 3 ||
    new Set(input.memberIds).size !== 3 ||
    !input.memberIds.includes('agent-remielle') ||
    input.members.length !== 3 ||
    new Set(input.members.map((member) => member.agentId)).size !== 3 ||
    input.members.some((member) => !input.memberIds.includes(member.agentId))
  )
    return failure('luminize_equipment_formation_mismatch')
  const members = input.memberIds.map(
    (id) => input.members.find((member) => member.agentId === id)!,
  )
  for (const member of members) {
    const contract = getCurrentAgentEventContract(member.agentId)
    if (
      !contract ||
      contract.source.commit !== reviewedLumifluxMechanicsIdentity32.source.commit ||
      (member.agentId === 'agent-remielle'
        ? contract.identity.attribute !== 'lumiflux'
        : !ordinaryAttributes.includes(
            contract.identity.attribute as (typeof ordinaryAttributes)[number],
          ))
    )
      return failure(`luminize_equipment_member_source_or_attribute_invalid:${member.agentId}`)
    if (
      !integerBetween(member.level, 1, 60) ||
      !integerBetween(member.mindscape, 0, 6) ||
      !integerBetween(member.coreLevel, 1, 7) ||
      member.skillLevels?.core !== member.coreLevel ||
      regularAgentSkillFields.some(
        (field) =>
          !integerBetween(
            member.skillLevels?.[field],
            1,
            getAgentSkillMaxFor(field, member.mindscape),
          ),
      )
    )
      return failure(`luminize_equipment_progression_unknown_or_invalid:${member.agentId}`)
    const stats = member.finalStats
    // Do not repair missing observations with nominal ATK/AP/PEN/level defaults.
    if (
      !stats ||
      ![
        'atk',
        'def',
        'hp',
        'crit_',
        'crit_dmg_',
        'anomMas',
        'anomProf',
        'impact',
        'pen_',
        'enerRegen',
      ].every(
        (key) =>
          finite(stats[key as keyof typeof stats]) && Number(stats[key as keyof typeof stats]) >= 0,
      ) ||
      stats.atk <= 0 ||
      stats.pen_ > 1 ||
      !finite(stats.pen) ||
      stats.pen < 0 ||
      !finite(stats.damageBonus) ||
      stats.damageBonus < -1 ||
      (stats.damageBonusesByAttribute !== undefined &&
        ((member.agentId !== 'agent-remielle' &&
          !finite(stats.damageBonusesByAttribute[contract.identity.attribute])) ||
          Object.values(stats.damageBonusesByAttribute).some(
            (value) => !finite(value) || value < -1,
          )))
    )
      return failure(`luminize_equipment_stats_unknown_or_invalid:${member.agentId}`)
  }
  const remielle = members.find((member) => member.agentId === 'agent-remielle')!
  const refringe = evaluateReviewedRefringeCoefficient32({
    anomalyProficiency: remielle.finalStats.anomProf,
    anomalyMemberCount: members.filter(
      (member) => getCurrentAgentEventContract(member.agentId)!.identity.specialty === 'anomaly',
    ).length,
    mindscape: remielle.mindscape,
  })
  if (refringe.status !== 'limited_benchmark') return failure(...refringe.blockers)
  const refs = [
    ...new Set([
      ...input.sourceRefs,
      `asset-binding:${input.assetBindingFingerprint}`,
      `luminize-mechanics:${reviewedLumifluxMechanicsHash32}`,
      `source:${reviewedLumifluxMechanicsIdentity32.source.repository}@${reviewedLumifluxMechanicsIdentity32.source.commit}`,
      `equipment-runtime:${contentHash(members)}`,
    ]),
  ]
  const voidflares = members
    .filter((member) => member !== remielle)
    .map((member) => {
      const contract = getCurrentAgentEventContract(member.agentId)!
      const attribute = contract.identity
        .attribute as DeclaredLuminizeSettlement32['voidflares'][number]['attribute']
      const stats = member.finalStats
      return {
        id: `equipment-regular-voidflare:${member.agentId}`,
        ownerAgentId: member.agentId,
        attribute,
        snapshotAtSeconds: 0,
        stats: {
          attackerLevel: member.level!,
          attack: stats.atk,
          anomalyProficiency: stats.anomProf,
          damageBonus: stats.damageBonusesByAttribute?.[attribute] ?? stats.damageBonus!,
          penetrationRatio: stats.pen_,
          penetrationFlat: stats.pen!,
        },
        storedRefringeCoefficient: refringe.coefficient,
        sourceRefs: [...refs, `member:${member.agentId}:${contract.source.formulaSha256}`],
      }
    })
  const declaration = declaredLuminizeSettlementSchema32.safeParse({
    contract: 'soda-declared-luminize-settlement32/v1',
    sourceIdentityHash: reviewedLumifluxMechanicsHash32,
    authority: 'declared_unrefringed_snapshots',
    eventId: `account-equipment-static-volley:${options.data.skill}`,
    targetId: baseline.data.enemy.id,
    atSeconds: 0,
    memberAgentIds: [...input.memberIds],
    skill: options.data.skill,
    effectiveSkillLevel: remielle.skillLevels[skillFields[options.data.skill]],
    remielle: {
      agentId: 'agent-remielle',
      coreLevel: remielle.coreLevel,
      mindscape: remielle.mindscape,
      anomalyProficiency: remielle.finalStats.anomProf,
      // This preparation deliberately activates no additional battle effects.
      // No generic/skill/anomaly/crit field on a teammate becomes this rider.
      generalAnomalyDamageBonus: 0,
      prismaticDefenseIgnoreWindow: options.data.prismaticDefenseIgnoreWindow,
      sourceRefs: refs,
    },
    voidflares,
    target: {
      enemyDefense: baseline.data.enemy.defense,
      resistanceByAttribute: Object.fromEntries(
        voidflares.map(({ attribute }) => [attribute, baseline.data.enemy.resistance]),
      ),
      resistanceReductionByAttribute: Object.fromEntries(
        voidflares.map(({ attribute }) => [attribute, 0]),
      ),
      defenseReduction: 0,
      vulnerability: baseline.data.enemy.vulnerability,
      stunMultiplier: baseline.data.enemy.stunMultiplier,
      sourceRefs: [
        `luminize-mechanics:${reviewedLumifluxMechanicsHash32}`,
        `planning-baseline:${baseline.data.baselineId}:${contentHash(baseline.data)}`,
      ],
    },
    sourceRefs: refs,
  })
  if (!declaration.success) return failure('luminize_equipment_declaration_invalid')
  const evaluated = evaluateReviewedLuminizeSettlement32(declaration.data)
  if (evaluated.status !== 'declared_arithmetic') return failure(...evaluated.blockers)
  return luminizeEquipmentSnapshotSchema32.parse({
    status: 'supported',
    basis: 'account_equipment_static_preparation',
    assetBindingFingerprint: input.assetBindingFingerprint,
    snapshot: createSavedDeclaredLuminizeSettlement32(declaration.data),
    totalDamage: evaluated.totalDamage,
    blockers: [],
    boundary: accountLuminizeEquipmentBoundary32,
  })
}
