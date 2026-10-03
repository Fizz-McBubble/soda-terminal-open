import { stableContentHash } from '../gameDataPacks/types'
import { directDamageCoreVersion } from './directDamageCore'
import { anomalyDamageCoreVersion } from './anomalyDamageCore'
import { sheerDamageCoreVersion } from './sheerDamageCore'
import { calculateDamageFormula, commonAnomalySettlementHash32 } from './damageFormulaDispatch'
import { damageFormula32Identity, isDamageFormula32Version } from './sharpDamageCore'
import {
  referenceCombatInputSchema,
  referenceModifierKeys,
  type ReferenceCombatInput,
  type ReferenceCombatEvent,
  type ReferenceCombatResult,
  type ReferenceModifierKey,
} from './referenceCombatContract'
import { validateReferenceCombat } from './referenceCombatValidation'

export const referenceCombatRuntimeVersion = 'soda-reference-combat-runtime/v1'
const formulaVersions = {
  directDamageCoreVersion,
  anomalyDamageCoreVersion,
  sheerDamageCoreVersion,
  damageFormula32Identity,
  commonAnomalySettlementHash32,
}
export const referenceCombatCalculationHash = stableContentHash({
  runtime: referenceCombatRuntimeVersion,
  formulaVersions,
})
const targetModifiers = new Set<ReferenceModifierKey>([
  'vulnerability',
  'defenseReduction',
  'resistanceReduction',
])

function eventModifiers(input: ReferenceCombatInput, event: ReferenceCombatEvent) {
  const values = Object.fromEntries(referenceModifierKeys.map((key) => [key, 0])) as Record<
    ReferenceModifierKey,
    number
  >
  const appliedEffectIds: string[] = []
  const sourceRefs = [...event.sourceRefs]
  const selected = new Map<
    string,
    { value: number; start: number; effectId: string; refs: string[]; key: ReferenceModifierKey }
  >()
  for (const effect of input.effects) {
    if (
      !effect.recipientAgentIds.includes(event.ownerAgentId) ||
      !effect.requiredTags.every((tag) => event.tags.includes(tag))
    )
      continue
    let used = false
    for (const modifier of effect.modifiers) {
      // Anomaly attacker stats can snapshot; enemy state always belongs to settlement time.
      const at = targetModifiers.has(modifier.key) ? event.at : (event.snapshotAt ?? event.at)
      if (at >= effect.start && (at < effect.end || effect.stacking === 'refresh')) {
        const group = `${effect.providerAgentId}:${effect.stackGroup}:${modifier.key}`
        const existing = selected.get(group)
        if (effect.stacking === 'add') {
          values[modifier.key] += modifier.value
          used = true
        } else if (
          !existing ||
          (effect.stacking === 'refresh'
            ? effect.start > existing.start
            : modifier.value > existing.value)
        ) {
          selected.set(group, {
            value: at < effect.end ? modifier.value : 0,
            start: effect.start,
            effectId: at < effect.end ? effect.id : '',
            refs: effect.sourceRefs,
            key: modifier.key,
          })
        }
      }
    }
    if (used) {
      appliedEffectIds.push(effect.id)
      sourceRefs.push(...effect.sourceRefs)
    }
  }
  for (const selection of selected.values()) {
    values[selection.key] += selection.value
    if (!selection.effectId) continue
    appliedEffectIds.push(selection.effectId)
    sourceRefs.push(...selection.refs)
  }
  return { values, appliedEffectIds: [...new Set(appliedEffectIds)].sort(), sourceRefs }
}

function calculateEvent(input: ReferenceCombatInput, event: ReferenceCombatEvent) {
  const member = input.members.find((row) => row.agentId === event.ownerAgentId)!
  const { stats } = member
  const { values: mod, appliedEffectIds, sourceRefs } = eventModifiers(input, event)
  const stun = input.stunWindows.find((row) => event.at >= row.start && event.at < row.end)
  const stunMultiplier = stun?.multiplier ?? 1
  const attackDelta = (stats.baseAttack ?? 0) * mod.attackPercent + mod.attackFlat
  const common = {
    multiplier: event.multiplier,
    hitCount: event.hitCount,
    critRate: stats.critRate + mod.critRate,
    critDamage: stats.critDamage + mod.critDamage,
    damageBonus: stats.damageBonus + mod.damageBonus,
    vulnerability: mod.vulnerability,
    resistance: input.scenario.enemyResistance,
    resistanceReduction: mod.resistanceReduction + mod.resistanceIgnore,
    stunMultiplier,
  }
  const expectedDamage = calculateDamageFormula({
    ...common,
    family: event.kind,
    formulaVersion: isDamageFormula32Version(input.gameVersion) ? '3.2' : 'legacy',
    scalingAttribute: event.scalingAttribute ?? (event.kind === 'sheer' ? 'sheerForce' : 'attack'),
    attackerLevel: member.level,
    attack: stats.attack + attackDelta,
    defense:
      stats.defense === undefined
        ? undefined
        : stats.defense + (stats.baseDefense ?? 0) * mod.defensePercent + mod.defenseFlat,
    sheerForce:
      stats.sheerForce === undefined
        ? undefined
        : stats.sheerForce + mod.sheerForce + attackDelta * (stats.sheerForceAttackRatio ?? 0),
    lacerationDamage:
      stats.lacerationDamage === undefined
        ? undefined
        : stats.lacerationDamage + mod.lacerationDamage,
    sharpDamageBonus: (stats.sharpDamageBonus ?? 0) + mod.sharpDamageBonus,
    sheerDamageBonus: mod.sheerDamageBonus,
    anomalyProficiency: stats.anomalyProficiency + mod.anomalyProficiency,
    anomalyBaseBonus: mod.anomalyBaseBonus,
    flatAnomalyDamage: mod.flatAnomalyDamage,
    anomalyCritRate: mod.anomalyCritRate,
    anomalyCritDamage: mod.anomalyCritDamage,
    flatDamage: mod.flatDamage,
    directDamageBonus: mod.directDamageBonus,
    buffBonus: mod.buffBonus,
    defenseReduction: mod.defenseReduction,
    defenseIgnore: mod.defenseIgnore,
    penetrationRatio: stats.penetrationRatio + mod.penetrationRatio,
    penetrationFlat: stats.penetrationFlat + mod.penetrationFlat,
    enemyDefense: input.scenario.enemyDefense,
    resistanceReduction: mod.resistanceReduction,
    resistanceIgnore: mod.resistanceIgnore,
  }).expectedDamage
  if (!Number.isFinite(expectedDamage) || expectedDamage < 0)
    throw new Error(`invalid_damage:${event.id}`)
  return {
    eventId: event.id,
    ownerAgentId: event.ownerAgentId,
    at: event.at,
    expectedDamage,
    appliedEffectIds,
    stunMultiplier,
    sourceRefs: [
      ...new Set([
        ...sourceRefs,
        ...member.sourceRefs,
        ...input.actions.find((action) => action.id === event.actionId)!.sourceRefs,
        ...(stun?.sourceRefs ?? []),
      ]),
    ].sort(),
  }
}

function canonicalInput(input: ReferenceCombatInput) {
  // Permutation of declarations is not a new rotation or source revision.
  const sorted = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id))
  return {
    ...input,
    members: [...input.members].sort((a, b) => a.agentId.localeCompare(b.agentId)),
    sources: sorted(input.sources),
    actions: sorted(input.actions),
    events: sorted(input.events),
    effects: sorted(input.effects),
    resources: sorted(input.resources),
    resourceChanges: sorted(input.resourceChanges),
    stunWindows: [...input.stunWindows].sort((a, b) => a.start - b.start),
  }
}

export function evaluateReferenceCombat(raw: unknown): ReferenceCombatResult {
  const empty: ReferenceCombatResult = {
    caseId: '',
    gameVersion: '',
    status: 'unsupported',
    comparisonKey: null,
    inputHash: null,
    totalDamage: null,
    evidenceStatus: 'unverified_inputs',
    memberDamage: [],
    trace: [],
    resourceLedger: [],
    blockers: [],
    assumptions: [],
  }
  const parsed = referenceCombatInputSchema.safeParse(raw)
  if (!parsed.success)
    return {
      ...empty,
      blockers: parsed.error.issues.map(
        (issue) => `schema:${issue.path.join('.')}:${issue.message}`,
      ),
    }
  const input = canonicalInput(parsed.data)
  const { blockers, resourceLedger } = validateReferenceCombat(input)
  const identity = {
    caseId: input.caseId,
    gameVersion: input.gameVersion,
    inputHash: stableContentHash(input),
    comparisonKey: stableContentHash({
      gameVersion: input.gameVersion,
      protocolId: input.protocolId,
      buildPolicyId: input.buildPolicyId,
      scenario: input.scenario,
      runtime: referenceCombatRuntimeVersion,
      formulaVersions,
    }),
  }
  const assumptions = input.sources
    .filter((source) => source.kind === 'reference_policy')
    .map((source) => source.ref)
  if (blockers.length) return { ...empty, ...identity, blockers, assumptions }
  try {
    const trace = [...input.events]
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
      .map((event) => calculateEvent(input, event))
    const memberDamage = input.members.map((member) => ({
      agentId: member.agentId,
      damage: trace
        .filter((event) => event.ownerAgentId === member.agentId)
        .reduce((sum, event) => sum + event.expectedDamage, 0),
    }))
    return {
      ...empty,
      ...identity,
      status: 'computed',
      totalDamage: memberDamage.reduce((sum, member) => sum + member.damage, 0),
      evidenceStatus: input.sources.some((source) => source.kind === 'semantic_fixture')
        ? 'unverified_inputs'
        : 'declared_inputs',
      memberDamage,
      trace,
      resourceLedger,
      assumptions,
    }
  } catch (error) {
    return {
      ...empty,
      ...identity,
      blockers: [error instanceof Error ? error.message : String(error)],
      assumptions,
    }
  }
}
