import {
  getCurrentFormulaWEngineEffectEntries,
  resolveCurrentFormulaWEngineContract,
} from './currentFormulaMechanicContracts'
import { currentCombatPlanningModifierTargets } from './currentCombatPlanningModifierTargets'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'

export const planningWEngineActions: Readonly<Record<string, string>> = {
  basic: 'basic_attack',
  basic_attack: 'basic_attack',
  dash: 'dash',
  dodgeCounter: 'dodge_counter',
  dodge_counter: 'dodge_counter',
  exSpecial: 'ex_special',
  ex_special: 'ex_special',
  chain: 'chain',
  ult: 'ultimate',
  ultimate: 'ultimate',
}

export function planningWEngineEffectScope(stat: string, action?: string | null) {
  const channel =
    /^combat\.(dmg_|common_dmg_|crit_dmg_|laceration_dmg_|sharp_dmg_|sheer_dmg_|direct_dmg_|buff_|defIgn_|resIgn_)\.(physical|fire|ice|electric|ether|wind)$/.exec(
      stat,
    )
  const application =
    currentCombatPlanningModifierTargets[
      (channel ? `combat.${channel[1]}` : stat) as keyof typeof currentCombatPlanningModifierTargets
    ]
  return {
    application,
    attribute: channel?.[2] ?? null,
    action: action == null ? null : planningWEngineActions[action],
  }
}

/** Keep the source expression even when its static preview is zero; final CR can cross a threshold. */
export function retainPlanningWEngineDependencies32(input: {
  buckets: SourceBackedEquipmentModifierBucket[]
  agentId: string
  engineId: string
  refinement: number
  runtime?: NonNullable<SourceBackedEquipmentModifierBucket['sourceFormula']>['runtime']
  boundRuntime: NonNullable<SourceBackedEquipmentModifierBucket['sourceFormula']>['runtime']
  sourceRefs: string[]
  target: 'own' | 'team'
  recipientAgentIds: string[]
}) {
  const buckets = [...input.buckets]
  for (const entry of getCurrentFormulaWEngineEffectEntries(input.engineId)) {
    const [target, ...parts] = entry.path.split('.')
    if (target !== input.target || !entry.finalStatReferences.length) continue
    const scope = planningWEngineEffectScope(parts.join('.'), entry.action)
    if (!scope.application || (entry.action && !scope.action)) continue
    const preview = resolveCurrentFormulaWEngineContract({
      stableId: input.engineId,
      refinement: input.refinement,
      specialtyMatches: true,
      runtimePolicy: 'exclude_unobserved',
      runtime: input.boundRuntime,
      effectIndices: [entry.effectIndex],
    })
    // An unobserved trigger stays excluded. Do not fabricate a deferred activation.
    if (preview.status !== 'supported' || preview.exclusions.length) continue
    const value = preview.effects[0]?.value ?? 0
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const existingIndex = buckets.findIndex(
      (bucket) =>
        bucket.providerAgentId === input.agentId &&
        bucket.application === scope.application &&
        bucket.action === scope.action &&
        bucket.attribute === scope.attribute &&
        bucket.value === value &&
        bucket.recipientAgentIds.join('|') === input.recipientAgentIds.join('|'),
    )
    const template = existingIndex >= 0 ? buckets.splice(existingIndex, 1)[0] : null
    const id = `wengine:${input.engineId}:source-effect:${entry.effectIndex}`
    buckets.push({
      ...template,
      bucketId: `${input.agentId}:${id}:${input.recipientAgentIds.join(',')}`,
      effectKey: id,
      providerAgentId: input.agentId,
      recipientAgentIds: input.recipientAgentIds,
      receiverPath: null,
      damageType: null,
      application: scope.application,
      action: scope.action ?? null,
      attribute: scope.attribute,
      value,
      sourceRefs: input.sourceRefs,
      sourceFormula: {
        engineId: input.engineId,
        refinement: input.refinement,
        effectIndex: entry.effectIndex,
        finalStatReferences: entry.finalStatReferences,
        runtime: input.runtime,
      },
    })
  }
  return buckets
}
