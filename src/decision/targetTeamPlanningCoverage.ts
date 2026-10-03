import { stableContentHash } from '../gameDataPacks/types'
import type { PlanningEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import type { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import type { compileCurrentPlanningInteractionBundle } from '../calculation/currentPlanningInteractionBundle'
import type { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import type { TargetTeamEquipmentModifierProjection } from '../calculation/targetTeamEquipmentModifierProjection'

/** Coverage is retained once per distinct exclusion, including event-specific
 * source failures; repeated event evaluation must not inflate result payloads. */
export function compileTargetTeamPlanningCoverage({
  runtime,
  interactions,
  discEffects,
  modifierProjection,
  effectRuntimeMembers,
  sourceBoundaries,
}: {
  runtime: Extract<ReturnType<typeof evaluateSourceBackedPlanningTeamDps>, { status: 'supported' }>
  interactions: Extract<
    ReturnType<typeof compileCurrentPlanningInteractionBundle>,
    { status: 'supported' }
  >
  discEffects: ReturnType<typeof compileCurrentDriveDiscPlanningEffects>
  modifierProjection: TargetTeamEquipmentModifierProjection
  effectRuntimeMembers: readonly PlanningEffectRuntimeMember[]
  sourceBoundaries: readonly string[]
}) {
  const coverage = {
    domain: 'fixed_event_direct_damage' as const,
    includedEffectKeys: [
      ...new Set([
        ...runtime.effectBuckets
          .filter((row) => row.application !== 'outside_direct_event_formula')
          .map((row) => row.effectKey),
        ...runtime.equipmentModifierBuckets.map((row) => row.effectKey),
        ...runtime.potentialApplications
          .filter((row) => row.status === 'applied')
          .map((row) => row.effectKey),
      ]),
    ],
    excludedEffects: [
      ...runtime.sourceEffectExclusions,
      ...interactions.effectDispositions
        .filter((row) => row.disposition === 'excluded_unknown')
        .map((row) => ({
          effectKey: row.effectKey,
          reason: row.reason,
          fields: ['combat_conditions', 'event_context'],
          sourceRefs: [...row.evidenceRefs],
        })),
      ...discEffects.exclusions.map((row) => ({
        effectKey: `disc:${row.agentId}:${row.setId}:four-piece`,
        reason: row.reason,
        fields: [...row.fields],
        sourceRefs: [...row.sourceRefs],
      })),
      ...modifierProjection.directRuntime.exclusions.map((row, index) => {
        const metadata: Readonly<Record<string, unknown>> = row
        return {
          effectKey: `wengine:${String(metadata.agentId)}:${String(metadata.engineId)}:excluded:${index}`,
          reason: String(metadata.reason),
          fields: [String(metadata.stat ?? 'combat_conditions')],
          sourceRefs:
            modifierProjection.wEngines.find((engine) => engine.agentId === metadata.agentId)
              ?.sourceRefs ?? [],
        }
      }),
      ...runtime.effectBuckets
        .filter((row) => row.application === 'outside_direct_event_formula')
        .map((row) => ({
          effectKey: row.effectKey,
          reason: 'outside_fixed_event_direct_damage_domain',
          fields: [row.receiverPath ?? 'event_context'],
          sourceRefs: [...row.sourceRefs],
        })),
      ...runtime.potentialApplications
        .filter((row) => row.status === 'excluded')
        .map((row) => ({
          effectKey: row.effectKey,
          reason: row.reason,
          fields: ['potential', 'event_context', row.bucket],
          sourceRefs: [...row.sourceRefs],
        })),
    ],
    exclusionContextFingerprint: stableContentHash({
      members: effectRuntimeMembers,
      exclusions: [
        runtime.sourceEffectExclusions,
        discEffects.exclusions,
        modifierProjection.directRuntime.exclusions,
        runtime.potentialApplications,
      ],
    }),
    boundary: [runtime.boundary, ...sourceBoundaries].join(' '),
  }
  return {
    ...coverage,
    excludedEffects: [
      ...new Map(coverage.excludedEffects.map((row) => [stableContentHash(row), row])).values(),
    ],
  }
}
