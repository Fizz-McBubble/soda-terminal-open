import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { bindReviewedPotentialApplications } from './potentialApplicationBinding'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PreparedAnomalyModifier32 } from './reviewedPreparedAnomalyEquipment32'
import type { PreparedAnomalyPreparation32 } from './reviewedPreparedAnomalyDeclarations32'

const sourceEffects = [
  'passion_atk',
  'core_assault_crit_',
  'core_assault_crit_dmg_',
  'm1_common_dmg_',
  'm2_defIgn_',
  'm2_assault_crit_dmg_',
  'm4_anomaly_dmg_',
]
export const reviewedPreparedJaneEffectIds32 = [...sourceEffects, 'potential_assault_crit_dmg_']

/** One self-owned physical Assault, with explicitly declared pre-event states.
 * Evaluate sourced IR against event-final AP after equipment/formation AP.
 * Ordinary M6 crit and notOwnBuff M2 defense-ignore cannot enter this snapshot. */
export function compileReviewedPreparedJaneAssault32(input: {
  member: PlanningEffectRuntimeMember
  members: readonly PlanningEffectRuntimeMember[]
  preparation: Extract<PreparedAnomalyPreparation32, { kind: 'jane_single_assault' }>
  anomalyProficiency: number
}) {
  const failure = (blockers: string[]) => ({ status: 'unsupported' as const, blockers })
  if (!Number.isFinite(input.anomalyProficiency) || input.anomalyProficiency < 0)
    return failure(['jane_event_final_AP_invalid'])
  const selected = currentAgentPlanningEffectBlueprints.filter(
    (row) => row.providerAgentId === 'agent-jane' && sourceEffects.includes(row.effectId),
  )
  if (
    selected.length !== sourceEffects.length ||
    sourceEffects.some(
      (effectId) => selected.filter((row) => row.effectId === effectId).length !== 1,
    )
  )
    return failure(['jane_prepared_source_effect_missing'])
  const runtime = evaluateCurrentPlanningEffectEntries32(
    {
      members: input.members,
      memberIds: input.members.map((row) => row.agentId),
      finalStatsByAgentId: {
        'agent-jane': { ...input.member.finalStats, anomProf: input.anomalyProficiency },
      },
      baselineReferencesByAgentId: {
        'agent-jane': {
          passion: input.preparation.passion,
          gnawed: input.preparation.gnawed,
          // This event cannot activate a buff retroactively on its own damage.
          assault_or_disorder_triggered: input.preparation.priorAssaultOrDisorderBuffActive,
        },
      },
    },
    selected,
  )
  if (runtime.status !== 'supported') return failure(runtime.blockers)
  const modifiers: PreparedAnomalyModifier32[] = []
  for (const row of runtime.results) {
    if (row.status !== 'supported' || typeof row.value !== 'number' || !row.receiverPath)
      return failure([`jane_prepared_effect_unresolved:${row.effectKey}`])
    if (!sourceEffects.includes(row.effectId)) continue
    const stat = row.receiverPath.replace(/^(ownBuff|teamBuff)\./, '').replace(/\.physical$/, '')
    if (
      ![
        'combat.atk',
        'combat.anom_crit_',
        'combat.anom_crit_dmg_',
        'combat.common_dmg_',
        'combat.defIgn_',
        'combat.buff_',
      ].includes(stat)
    )
      return failure([`jane_prepared_effect_receiver_mismatch:${row.effectKey}`])
    modifiers.push({ effectKey: row.effectKey, stat, value: row.value, sourceRefs: row.sourceRefs })
  }
  const potential = bindReviewedPotentialApplications({
    member: {
      agentId: input.member.agentId,
      potential: input.member.potential,
      initialStats: input.member.initialStats,
      provenance: 'calculation_context',
    },
    event: {
      eventId: input.preparation.kind,
      actionFamilies: ['physical_assault'],
      providerStateKeys: [],
      targetStateKeys: input.preparation.gnawed ? ['gnawed'] : [],
      sourceRefs: ['declared-prepared-self-physical-assault'],
    },
  }).find((row) => row.effectId === 'potential_assault_crit_damage')
  if (!potential || potential.bucket !== 'self_crit_damage' || potential.targetKind !== 'self')
    return failure(['jane_prepared_potential_binding_unresolved'])
  // A reviewed Assault-only CD modifier is independent of ordinary panel CD.
  // With Gnawed explicitly absent the anomaly CR is zero, so CD has no benefit.
  modifiers.push({
    effectKey: potential.effectKey,
    stat: 'combat.anom_crit_dmg_',
    value: potential.value,
    sourceRefs: [...potential.sourceRefs],
  })
  return { status: 'supported' as const, modifiers }
}
