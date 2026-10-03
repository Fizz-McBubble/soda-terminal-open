import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { validateCalculationContext, calculationContextSchema } from './calculationContext'
import { calculateDamageFormula, type DamageFormulaInput } from './damageFormulaDispatch'
import { damageFormula32Identity, isDamageFormula32Version } from './sharpDamageCore'
import { referenceCombatInputSchema, referenceCombatStatsSchema } from './referenceCombatContract'
import { evaluateReferenceCombat } from './referenceCombatRuntime'

const id = z.string().min(1)
const refs = z.array(id).min(1)
const sourced = z.object({ value: z.number().finite(), evidenceRefs: refs }).strict()
const positive = sourced.extend({ value: z.number().finite().positive() })
const family = z.enum(['direct', 'sharp', 'sheer', 'anomaly'])
const scaling = z.enum(['attack', 'defense', 'sheerForce'])
const attribute = z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind'])
const statShape = {
  attack: positive,
  defense: positive.optional(),
  sheerForce: positive.optional(),
  critRate: sourced,
  critDamage: sourced,
  lacerationDamage: sourced.optional(),
  sharpDamageBonus: sourced.optional(),
  sheerDamageBonus: sourced.optional(),
  anomalyProficiency: sourced.optional(),
  anomalyBaseBonus: sourced.optional(),
  flatAnomalyDamage: sourced.optional(),
  anomalyCritRate: sourced.optional(),
  anomalyCritDamage: sourced.optional(),
  flatDamage: sourced.optional(),
  damageBonus: sourced,
  directDamageBonus: sourced,
  buffBonus: sourced,
  defenseReduction: sourced,
  defenseIgnore: sourced,
  penetrationRatio: sourced,
  penetrationFlat: sourced,
  resistanceReduction: sourced,
  resistanceIgnore: sourced,
}
export const reviewedDamageStats32Schema = z.object(statShape).strict()
export const reviewedDamageStatsHash32 = (raw: unknown) =>
  stableContentHash(reviewedDamageStats32Schema.parse(raw))
export const reviewedReferenceStatsHash32 = (raw: unknown) =>
  stableContentHash(referenceCombatStatsSchema.parse(raw))

/** Reviewed numeric adapter only; no action duration, coefficient, or trigger is inferred. */
export const reviewedDamageEvent32Schema = z
  .object({
    context: calculationContextSchema,
    subjectAgentId: id,
    actorFinalStatsHash: id,
    upstreamCommit: z.literal(damageFormula32Identity.upstreamCommit),
    formulaEvidenceRefs: refs,
    contextEvidenceRefs: refs,
    stats: reviewedDamageStats32Schema,
    definition: z
      .object({
        subjectAgentId: id,
        eventId: id,
        family,
        scalingAttribute: scaling,
        attribute,
        targetVersion: z.enum(['3.2', '3.2-phase-ii']),
        evidenceRefs: refs,
      })
      .strict(),
    event: z
      .object({
        eventId: id,
        family,
        scalingAttribute: scaling,
        attribute,
        multiplier: positive,
        hitCount: positive.extend({ value: z.number().int().positive() }),
        evidenceRefs: refs,
      })
      .strict(),
  })
  .strict()
export type ReviewedDamageEvent32 = z.infer<typeof reviewedDamageEvent32Schema>

/** Gate only the consumed subject/family fields. A candidate package is never promoted. */
function consumedEvidenceGaps(value: ReviewedDamageEvent32) {
  const context = value.context
  const byId = new Map(context.evidence.map((row) => [row.fieldId, row]))
  const usedRefs = [
    ...new Set([
      ...value.formulaEvidenceRefs,
      ...value.contextEvidenceRefs,
      ...value.definition.evidenceRefs,
      ...value.event.evidenceRefs,
      ...value.event.multiplier.evidenceRefs,
      ...value.event.hitCount.evidenceRefs,
      ...Object.values(value.stats).flatMap((row) => row?.evidenceRefs ?? []),
    ]),
  ]
  const gaps: string[] = []
  for (const ref of usedRefs) {
    const row = byId.get(ref)
    if (!row) {
      gaps.push(`unknown_evidence:${ref}`)
      continue
    }
    if (
      row.status !== 'formal' ||
      row.conflict ||
      row.stale ||
      !['verified_current', 'continuous'].includes(row.applicability)
    )
      gaps.push(`unreviewed_evidence:${ref}`)
    if (
      !row.requiredFor.some((capability) =>
        ['formal_event_damage_ready', 'formal_single_event', 'formal_damage'].includes(capability),
      )
    )
      gaps.push(`wrong_evidence_capability:${ref}`)
    if (row.sourceVersion !== context.gameVersion && row.applicability !== 'continuous')
      gaps.push(`cross_version_evidence:${ref}`)
  }
  const formulaSources = new Set(
    value.formulaEvidenceRefs.flatMap((ref) => byId.get(ref)?.sourceRefs ?? []),
  )
  for (const ref of damageFormula32Identity.evidenceRefs)
    if (!formulaSources.has(ref)) gaps.push(`unbound_formula_source:${ref}`)
  return { gaps, usedRefs }
}

export function evaluateReviewedDamageEvent32(raw: unknown) {
  const unsupported = (gaps: string[]) => ({ status: 'unsupported' as const, gaps })
  const parsed = reviewedDamageEvent32Schema.safeParse(raw)
  if (!parsed.success)
    return unsupported(parsed.error.issues.map((row) => `schema:${row.path.join('.')}`))
  const value = parsed.data
  const contextValidation = validateCalculationContext(value.context)
  if (!contextValidation.success) return unsupported([contextValidation.reason])
  const { context, event, definition } = value
  const actor = context.actors.find((row) => row.agentId === value.subjectAgentId)
  const enemy = context.scenario.enemy
  const { gaps, usedRefs } = consumedEvidenceGaps(value)
  if (
    !isDamageFormula32Version(context.gameVersion) ||
    context.canonical.gameVersion !== context.gameVersion ||
    definition.targetVersion !== context.gameVersion
  )
    gaps.push('wrong_version')
  if (context.accountSnapshot.stale) gaps.push('stale_account')
  if (context.objective !== 'formal_damage' && context.objective !== 'formal_dps')
    gaps.push('wrong_objective')
  if (!actor || actor.level === null || actor.level < 1 || actor.level > 60)
    gaps.push('missing_actor_level')
  if (
    !actor ||
    actor.finalStatsHash !== value.actorFinalStatsHash ||
    value.actorFinalStatsHash !== stableContentHash(value.stats)
  )
    gaps.push('stats_hash_mismatch')
  if (
    !enemy ||
    enemy.defense === null ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null
  )
    gaps.push('missing_enemy_context')
  if (
    definition.subjectAgentId !== value.subjectAgentId ||
    definition.eventId !== event.eventId ||
    definition.family !== event.family ||
    definition.scalingAttribute !== event.scalingAttribute ||
    definition.attribute !== event.attribute
  )
    gaps.push('subject_family_definition_mismatch')
  if (event.family === 'sharp' && value.stats.lacerationDamage === undefined)
    gaps.push('missing_laceration_damage')
  const familyInputs =
    event.family === 'direct'
      ? ['flatDamage']
      : event.family === 'sharp'
        ? ['sharpDamageBonus']
        : event.family === 'sheer'
          ? ['sheerDamageBonus']
          : [
              'anomalyProficiency',
              'anomalyBaseBonus',
              'flatAnomalyDamage',
              'anomalyCritRate',
              'anomalyCritDamage',
            ]
  for (const key of familyInputs)
    if (value.stats[key as keyof typeof value.stats] === undefined)
      gaps.push(`missing_sourced_family_input:${key}`)
  if (event.scalingAttribute === 'defense' && value.stats.defense === undefined)
    gaps.push('missing_defense')
  if (event.family === 'sheer' && value.stats.sheerForce === undefined)
    gaps.push('missing_sheer_force')
  if (gaps.length) return unsupported([...new Set(gaps)])
  try {
    const stats = Object.fromEntries(
      Object.entries(value.stats).map(([key, row]) => [key, row.value]),
    )
    const result = calculateDamageFormula({
      ...stats,
      family: event.family,
      formulaVersion: '3.2',
      scalingAttribute: event.scalingAttribute,
      multiplier: event.multiplier.value,
      hitCount: event.hitCount.value,
      attackerLevel: actor!.level!,
      enemyDefense: enemy!.defense!,
      resistance: enemy!.resistance!,
      stunMultiplier: enemy!.stunMultiplier!,
      vulnerability: enemy!.vulnerability!,
    } as DamageFormulaInput)
    return {
      status:
        context.canonical.status === 'formal'
          ? ('formal' as const)
          : ('candidate_sourced' as const),
      ...result,
      subjectAgentId: value.subjectAgentId,
      eventId: event.eventId,
      family: event.family,
      attribute: event.attribute,
      contextFingerprint: context.fingerprint,
      inputHash: stableContentHash(value),
      formulaIdentity: damageFormula32Identity,
      evidenceRefs: usedRefs,
      boundary: 'Single explicitly reviewed event; no rotation, trigger, or simulation inferred.',
    }
  } catch (error) {
    return unsupported([error instanceof Error ? error.message : String(error)])
  }
}

export const reviewedFixedCycle32Schema = z
  .object({
    context: calculationContextSchema,
    cycle: referenceCombatInputSchema,
    upstreamCommit: z.literal(damageFormula32Identity.upstreamCommit),
    formulaEvidenceRefs: refs,
    cycleEvidenceRefs: refs,
  })
  .strict()

/** A finite sourced cycle stays a declared reference calculation, never simulation readiness. */
export function evaluateReviewedFixedCycle32(raw: unknown) {
  const parsed = reviewedFixedCycle32Schema.safeParse(raw)
  if (!parsed.success)
    return {
      status: 'unsupported' as const,
      gaps: parsed.error.issues.map((row) => `schema:${row.path.join('.')}`),
    }
  const { context, cycle, formulaEvidenceRefs, cycleEvidenceRefs } = parsed.data
  const valid = validateCalculationContext(context)
  const gaps: string[] = valid.success ? [] : [valid.reason]
  if (
    !isDamageFormula32Version(context.gameVersion) ||
    cycle.gameVersion !== context.gameVersion ||
    context.canonical.gameVersion !== context.gameVersion
  )
    gaps.push('wrong_version')
  if (context.accountSnapshot.stale) gaps.push('stale_account')
  if (context.scope.kind !== 'team' || context.scope.agentIds.length !== 3)
    gaps.push('team_context_required')
  if (context.objective !== 'formal_dps') gaps.push('fixed_cycle_objective_required')
  const actionHash = stableContentHash(cycle.actions)
  const buffHash = stableContentHash({ effects: cycle.effects, stunWindows: cycle.stunWindows })
  if (
    !context.cycle?.complete ||
    context.cycle.durationSeconds !== cycle.scenario.durationSeconds ||
    context.cycle.actionSequenceHash !== actionHash ||
    context.cycle.buffWindowHash !== buffHash ||
    context.cycle.hitCount !== cycle.events.reduce((sum, row) => sum + row.hitCount, 0)
  )
    gaps.push('cycle_context_mismatch')
  if (
    context.scenario.enemy?.defense !== cycle.scenario.enemyDefense ||
    context.scenario.enemy?.resistance !== cycle.scenario.enemyResistance ||
    context.scenario.enemy?.stunMultiplier !== 1 ||
    context.scenario.enemy?.vulnerability !== 0
  )
    gaps.push('enemy_context_mismatch')
  for (const event of cycle.events) {
    if (!event.scalingAttribute || !event.attribute)
      gaps.push(`missing_typed_cycle_event:${event.id}`)
  }
  for (const member of cycle.members) {
    const actor = context.actors.find((row) => row.agentId === member.agentId)
    if (
      !actor ||
      actor.level !== member.level ||
      actor.finalStatsHash !== member.buildHash ||
      member.buildHash !== stableContentHash(member.stats)
    )
      gaps.push(`actor_context_mismatch:${member.agentId}`)
    if (
      cycle.events.some((row) => row.ownerAgentId === member.agentId && row.kind === 'sharp') &&
      member.stats.sharpDamageBonus === undefined
    )
      gaps.push(`missing_sourced_sharp_bonus:${member.agentId}`)
  }
  const byId = new Map(context.evidence.map((row) => [row.fieldId, row]))
  const formulaSources = new Set(
    formulaEvidenceRefs.flatMap((ref) => byId.get(ref)?.sourceRefs ?? []),
  )
  for (const ref of damageFormula32Identity.evidenceRefs)
    if (!formulaSources.has(ref)) gaps.push(`unbound_formula_source:${ref}`)
  for (const ref of [...formulaEvidenceRefs, ...cycleEvidenceRefs]) {
    const evidence = byId.get(ref)
    if (
      !evidence ||
      evidence.status !== 'formal' ||
      evidence.stale ||
      evidence.conflict ||
      !['verified_current', 'continuous'].includes(evidence.applicability) ||
      (evidence.sourceVersion !== context.gameVersion && evidence.applicability !== 'continuous')
    )
      gaps.push(`unreviewed_cycle_evidence:${ref}`)
    const acceptedCapabilities = cycleEvidenceRefs.includes(ref)
      ? ['formal_dps', 'estimated_rotation']
      : ['formal_damage', 'formal_single_event', 'formal_event_damage_ready']
    if (!evidence?.requiredFor.some((capability) => acceptedCapabilities.includes(capability)))
      gaps.push(`wrong_cycle_evidence_capability:${ref}`)
  }
  for (const source of cycle.sources) {
    if (
      !cycleEvidenceRefs.includes(source.id) ||
      !byId.get(source.id)?.sourceRefs.includes(source.ref)
    )
      gaps.push(`unbound_cycle_source:${source.id}`)
  }
  if (cycle.sources.some((row) => row.kind === 'semantic_fixture'))
    gaps.push('semantic_fixture_not_production_cycle')
  if (gaps.length) return { status: 'unsupported' as const, gaps: [...new Set(gaps)] }
  const result = evaluateReferenceCombat(cycle)
  return {
    ...result,
    contextFingerprint: context.fingerprint,
    formulaIdentity: damageFormula32Identity,
    formalPromotion: false as const,
    declaredDurationSeconds: cycle.scenario.durationSeconds,
    fixedCycleDps:
      result.totalDamage === null ? null : result.totalDamage / cycle.scenario.durationSeconds,
  }
}
