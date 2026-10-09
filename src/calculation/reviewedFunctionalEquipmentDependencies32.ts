import catalog from '../gameDataPacks/generated/current-formula-mechanic-contract-catalog.v1.json'
import { matchesEventScope } from './currentPlanningDamageModifiers'
import { planningWEngineActions } from './currentPlanningWEngineDependencies32'

export type FunctionalEffectMetadata32 = {
  effectPath?: string | null
  recipientAgentIds?: string[] | null
  writeFields?: string[]
  resolvedInactive?: boolean
  action?: string | null
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/** Retain the actual source index before resolved output lists omit inactive rows. */
export function sourceEquipmentEffectPath32(
  kind: 'wengine' | 'drive_disc',
  id: string,
  effectIndex: unknown,
) {
  if (typeof effectIndex !== 'number' || !Number.isInteger(effectIndex) || effectIndex < 0)
    return null
  const items = kind === 'wengine' ? catalog.wengineItems : catalog.driveDiscItems
  const item = items.find((row) => row.stableId === id)
  const effect = record(item?.effects[effectIndex])
  if (effect?.kind === 'modifier_effect' && typeof effect.path === 'string') return effect.path
  return effect?.kind === 'damage_effect' ? 'own.damage_event' : null
}

export function functionalEffectMetadata32(
  effectPath: string | null,
  providerAgentId: string,
  memberIds: readonly string[],
  declaredTargetAgentId?: string,
  action: string | null = null,
): FunctionalEffectMetadata32 {
  const target = effectPath?.split('.')[0]
  return {
    effectPath,
    recipientAgentIds:
      target === 'own'
        ? [providerAgentId]
        : target === 'team'
          ? [...memberIds]
          : target === 'target' &&
              declaredTargetAgentId &&
              memberIds.includes(declaredTargetAgentId)
            ? [declaredTargetAgentId]
            : null,
    writeFields: effectPath ? [effectPath.split('.').slice(1).join('.')] : [],
    resolvedInactive: false,
    action,
  }
}

export function sourceEquipmentEffectMetadata32(
  kind: 'wengine' | 'drive_disc',
  id: string,
  effectIndex: unknown,
  providerAgentId: string,
  memberIds: readonly string[],
  declaredTargetAgentId?: string,
) {
  const items = kind === 'wengine' ? catalog.wengineItems : catalog.driveDiscItems
  const item = items.find((row) => row.stableId === id)
  const effect = record(typeof effectIndex === 'number' ? item?.effects[effectIndex] : null)
  const action =
    effect?.action == null
      ? null
      : typeof effect.action === 'string'
        ? (planningWEngineActions[effect.action] ?? effect.action)
        : null
  return functionalEffectMetadata32(
    sourceEquipmentEffectPath32(kind, id, effectIndex),
    providerAgentId,
    memberIds,
    declaredTargetAgentId,
    action,
  )
}

/** Unknown scope or unclassified writes cannot establish functional independence. */
export function functionalEquipmentGaps32(
  exclusions: readonly unknown[] | undefined,
  agentId: string,
  relevantFields: readonly string[],
  events: readonly { actionId: string; skill: string }[] = [],
) {
  if (exclusions === undefined) return ['functional_equipment_coverage_unbound']
  return exclusions.flatMap((input) => {
    const row = record(input)
    if (row?.resolvedInactive === true && Array.isArray(row.sourceRefs) && row.sourceRefs.length)
      return []
    if (
      !Array.isArray(row?.writeFields) ||
      !row.writeFields.length ||
      !row.writeFields.every((field) => typeof field === 'string' && field.length)
    )
      return ['functional_equipment_writes_unresolved']
    if (!row.writeFields.some((field) => relevantFields.includes(String(field)))) return []
    if (
      !Array.isArray(row.recipientAgentIds) ||
      !row.recipientAgentIds.every((id) => typeof id === 'string')
    )
      return ['functional_equipment_recipient_unresolved']
    if (!row.recipientAgentIds.includes(agentId)) return []
    if (
      typeof row.action === 'string' &&
      events.length &&
      !events.some((event) =>
        matchesEventScope(
          { action: row.action as string, attribute: null, damageType: null },
          event,
          '',
        ),
      )
    )
      return []
    return ['functional_equipment_effect_unresolved']
  })
}

export const hasReviewedShieldConsumer32 = (agentId: string) =>
  agentId === 'agent-seth' || agentId === 'agent-caesar' || agentId === 'agent-ben'
