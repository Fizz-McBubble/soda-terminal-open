import {
  bindCurrentWEngineFormulaRuntime,
  type CurrentWEngineFormulaRuntime,
} from './currentWEnginePersonalPlanningEffects'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  getCurrentFormulaContractRequirements,
  getCurrentFormulaWEngineEffectEntries,
  resolveCurrentFormulaWEngineContract,
  resolveCurrentDriveDiscFourPieceContract,
} from './currentFormulaMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'

export type PreparedAnomalyModifier32 = {
  effectKey: string
  stat: string
  value: number
  sourceRefs: string[]
}
export type PreparedAnomalyExclusion32 = {
  effectKey: string
  reason: string
  fields: string[]
  sourceRefs: string[]
}

/** Read the existing equipment IR directly: the direct-event compiler excludes
 * AP/AM modifiers, so reusing its filtered output would lose anomaly effects. */
export function compileReviewedPreparedAnomalyEquipment32(input: {
  member: PlanningEffectRuntimeMember
  wEngine?: { engineId: string; refinement: number; runtime?: CurrentWEngineFormulaRuntime }
  discs?: readonly { setId: string }[]
}) {
  const modifiers: PreparedAnomalyModifier32[] = []
  const exclusions: PreparedAnomalyExclusion32[] = []
  const blockers: string[] = []
  const identity = getCurrentAgentEventContract(input.member.agentId)?.identity
  const consume = (
    prefix: string,
    result:
      | ReturnType<typeof resolveCurrentFormulaWEngineContract>
      | ReturnType<typeof resolveCurrentDriveDiscFourPieceContract>,
  ) => {
    if (result.status !== 'supported') {
      blockers.push(...result.blockers)
      return
    }
    const refs =
      'formulaPath' in result.source
        ? [result.source.formulaPath, result.source.formulaSha256]
        : [result.source.path, result.source.sha256]
    result.exclusions.forEach((row) =>
      exclusions.push({
        effectKey: `${prefix}:formula:${row.effectIndex}`,
        reason: 'unobserved_equipment_condition',
        fields: row.reasons,
        sourceRefs: refs,
      }),
    )
    result.effects.forEach((output, index) => {
      const row = output as Record<string, unknown>
      const effectKey = `${prefix}:resolved:${index}`
      if (row.kind !== 'modifier' || row.target !== 'own' || row.action !== undefined) {
        exclusions.push({
          effectKey,
          reason: 'not_self_generic_anomaly_modifier',
          fields: [String(row.stat ?? ''), String(row.action ?? '')],
          sourceRefs: refs,
        })
        return
      }
      if (
        typeof row.stat !== 'string' ||
        typeof row.value !== 'number' ||
        !Number.isFinite(row.value)
      ) {
        blockers.push(`invalid_anomaly_equipment_modifier:${effectKey}`)
        return
      }
      modifiers.push({ effectKey, stat: row.stat, value: row.value, sourceRefs: refs })
    })
  }
  if (input.wEngine) {
    const source = getCurrentWEngineStaticData(input.wEngine.engineId)
    if (!source || !identity) blockers.push('prepared_anomaly_equipment_identity_missing')
    else if (source.formulaAdoption.status === 'static_only')
      exclusions.push({
        effectKey: `wengine:${input.wEngine.engineId}:passive`,
        reason: 'static_only_passive',
        fields: ['passive'],
        sourceRefs: [source.source.dataPath, source.source.dataSha256],
      })
    else {
      const runtime = bindCurrentWEngineFormulaRuntime({
        ...input.wEngine,
        agentId: input.member.agentId,
        member: input.member,
      })
      blockers.push(...runtime.blockers)
      // No event-final fixed-point solver is adopted for this new anomaly
      // consumer. Keep reactive stat effects out rather than reading stale AP.
      const entries = getCurrentFormulaWEngineEffectEntries(input.wEngine.engineId)
      const independentIndices = entries
        .filter((row) => !row.finalStatReferences.length)
        .map((row) => row.effectIndex)
      entries
        .filter((row) => row.finalStatReferences.length)
        .forEach((row) =>
          exclusions.push({
            effectKey: `wengine:${input.wEngine!.engineId}:formula:${row.effectIndex}`,
            reason: 'anomaly_event_final_dependency_unbound',
            fields: row.finalStatReferences,
            sourceRefs: [source.source.formulaPath, source.source.formulaSha256],
          }),
        )
      const stackCaps: Record<string, number> =
        input.wEngine.engineId === 'wengine-13008'
          ? {
              'WeepingGemini:anomaly_stack':
                source.passiveParameterTable[input.wEngine.refinement - 1]?.params[1] ?? Number.NaN,
            }
          : input.wEngine.engineId === 'wengine-14118'
            ? {
                'FusionCompiler:specialUsed':
                  source.passiveParameterTable[input.wEngine.refinement - 1]?.params[3] ??
                  Number.NaN,
              }
            : {}
      for (const [key, cap] of Object.entries(stackCaps)) {
        const count = input.wEngine.runtime?.accumulators?.[key]
        if (
          count !== undefined &&
          (!Number.isInteger(count) || count < 0 || !Number.isFinite(cap) || count > cap)
        )
          blockers.push(`prepared_anomaly_equipment_stack_domain:${key}`)
      }
      consume(
        `wengine:${input.wEngine.engineId}`,
        resolveCurrentFormulaWEngineContract({
          stableId: input.wEngine.engineId,
          refinement: input.wEngine.refinement,
          specialtyMatches:
            source.specialty === (identity.specialty === 'attack' ? 'damage' : identity.specialty),
          effectIndices: independentIndices,
          runtimePolicy: 'exclude_unobserved',
          runtime,
        }),
      )
    }
  }
  const counts = new Map<string, number>()
  input.discs?.forEach((disc) => counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1))
  for (const [setId, count] of counts) {
    if (count < 4) continue
    const flags: Record<string, boolean> = {}
    for (const flag of getCurrentFormulaContractRequirements('drive_disc', setId)?.flags ?? []) {
      const match = /^eq:own.char.(attribute|specialty):(.+)$/.exec(flag)
      if (match && identity)
        flags[flag] = identity[match[1] as 'attribute' | 'specialty'] === match[2]
    }
    consume(
      `disc:${setId}`,
      resolveCurrentDriveDiscFourPieceContract({
        stableId: setId,
        equippedPieces: count,
        runtimePolicy: 'exclude_unobserved',
        runtime: {
          flags,
          numbers: {
            'own.initial.def': input.member.initialStats.def,
            'own.final.anomMas': input.member.finalStats.anomMas,
          },
          accumulators: {},
        },
      }),
    )
  }
  return blockers.length
    ? { status: 'unsupported' as const, blockers }
    : { status: 'supported' as const, modifiers, exclusions }
}
