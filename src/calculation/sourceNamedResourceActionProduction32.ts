import { contentHash } from '../application/contentHash'
import { reviewedNamedResourceProductionContracts32 } from './declaredResourceTimeline32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'

/** These source grants are once per completed action/activation. Per-hit gains,
 * resource-clock rates, branch-specific forms, cooldowns and external receipts
 * cannot be inferred from a source action-row occurrence count. */
const actionGrantKeys = new Set([
  'ex_barrage_completed',
  'ultimate_activation',
  'chain_activation',
  'chain_completed',
  'ex_activation',
  'gale_suppression_completed',
  'ultimate_completed',
  'EXSpecialAttackWatchYourStep.activation',
  'EXSpecialAttackCrimsonVortex.activation',
  'SpecialAttackCorrosiveFlash.activation',
  'EXSpecialAttackAuroraThrustNorthernCross.activation',
  'EXSpecialAttackAuroraThrustSouthernCross.activation',
  'EXSpecialAttackCavityAlert.activation',
  'EXSpecialAttackCavityAlertRightNow.activation',
  'endless_talisman_completed',
  'endless_talisman_activation',
  'assist_followup',
  'flash_freeze_basic_attack',
  'cold_snap_activation',
  'glacial_blade_activation',
  'touch_of_death_activation',
  'lightning_strike_activation',
])

export function summarizeSourceNamedResourceActionProduction32(input: {
  agentId: string
  actionId: string
  occurrenceCount: number
  sourceRefs: readonly string[]
}) {
  const source = reviewedNamedResourceProductionContracts32.find(
    (row) => row.agentId === input.agentId,
  )
  const validQuantity = Number.isSafeInteger(input.occurrenceCount) && input.occurrenceCount > 0
  const rules =
    source?.rules.filter((rule) => {
      const action = /^(basic|special|chain|assist|dodge)\.([^.]+)\.desc(?:\.|$)/.exec(rule.locator)
      return (
        action &&
        (action[2] === input.actionId || `${action[1]}.${action[2]}` === input.actionId) &&
        actionGrantKeys.has(rule.eventKey) &&
        rule.conditionKeys.length === 0 &&
        rule.cooldownSeconds === undefined &&
        !rule.operation.endsWith('_per_unit') &&
        rule.amount !== null
      )
    }) ?? []
  const rows = validQuantity
    ? rules.map((rule) => ({
        resource: rule.resource,
        operation: rule.operation,
        unit: rule.unit,
        amountBeforeReceiptAndCap: rule.amount! * input.occurrenceCount,
        sourceEventKey: rule.eventKey,
        sourceRef: `upstream:${source!.source.commit}:${source!.source.path}:${source!.source.sha256}#${rule.locator}`,
      }))
    : []
  const result = {
    status: !validQuantity
      ? ('unknown' as const)
      : rows.length
        ? ('source_action_production' as const)
        : ('not_declared_by_selected_action' as const),
    agentId: input.agentId,
    actionId: input.actionId,
    occurrenceCount: input.occurrenceCount,
    rows,
    sourceRefs: [...input.sourceRefs],
    completeResourceCycle: false as const,
    boundary:
      '现有固定动作包的逐动作资源产出/请求消耗，未推定实际收取、容量、入场状态、冷却或循环；逐击产出不按动作行数补造。',
  }
  return { ...result, fingerprint: contentHash(result) }
}

/** Adapt the actual query's complete action packets. A collection of damage
 * rows with different counts, missing source segments or rate quantities is not
 * silently relabelled as that many full action activations. */
export function summarizeNamedResourceProductionFromUsages32(
  usages: readonly PlanningEventUsage[],
) {
  const groups = new Map<
    string,
    { agentId: string; actionId: string; rows: PlanningEventUsage[] }
  >()
  for (const usage of usages) {
    const event = getCurrentAgentEventContract(usage.ownerAgentId)?.eventContract.events.find(
      (row) => row.eventId === usage.eventId,
    )
    if (!event) continue
    const key = `${usage.ownerAgentId}:${event.actionId}`
    const group = groups.get(key) ?? {
      agentId: usage.ownerAgentId,
      actionId: event.actionId,
      rows: [],
    }
    group.rows.push(usage)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => {
    const expected = getCurrentAgentEventContract(group.agentId)!.eventContract.events.filter(
      (row) => row.actionId === group.actionId && row.formulaProjection !== 'raw_only',
    )
    const count = group.rows[0]?.occurrenceCount ?? 0
    const complete =
      new Set(group.rows.map((row) => row.eventId)).size === group.rows.length &&
      expected.length === group.rows.length &&
      expected.every((row) => group.rows.some((usage) => usage.eventId === row.eventId)) &&
      group.rows.every((row) => row.occurrenceCount === count && row.durationSeconds === undefined)
    const actionGrant = summarizeSourceNamedResourceActionProduction32({
      agentId: group.agentId,
      actionId: group.actionId,
      occurrenceCount: complete ? count : 0,
      sourceRefs: [...new Set(group.rows.flatMap((row) => row.evidenceRefs))],
    })
    if (!complete) return actionGrant
    const contract = reviewedNamedResourceProductionContracts32.find(
      (row) => row.agentId === group.agentId,
    )
    const perHit = group.rows.flatMap((usage) =>
      (contract?.rules ?? [])
        .filter(
          (rule) =>
            rule.eventKey === usage.eventId &&
            rule.conditionKeys.length === 0 &&
            rule.cooldownSeconds === undefined &&
            !rule.operation.endsWith('_per_unit') &&
            (rule.operation === 'add' || rule.operation === 'consume') &&
            rule.amount !== null,
        )
        .map((rule) => ({
          resource: rule.resource,
          operation: rule.operation,
          unit: rule.unit,
          amountBeforeReceiptAndCap: rule.amount! * usage.occurrenceCount,
          sourceEventKey: usage.eventId,
          sourceRef:
            rule.sourceRef ??
            `upstream:${contract!.source.commit}:${contract!.source.path}:${contract!.source.sha256}#${rule.locator}`,
        })),
    )
    if (!perHit.length) return actionGrant
    const combined = new Map<string, (typeof perHit)[number]>()
    for (const row of [...actionGrant.rows, ...perHit]) {
      const key = `${row.resource}:${row.operation}:${row.unit}`
      const existing = combined.get(key)
      combined.set(
        key,
        existing
          ? {
              ...existing,
              amountBeforeReceiptAndCap:
                existing.amountBeforeReceiptAndCap + row.amountBeforeReceiptAndCap,
              sourceEventKey: `${existing.sourceEventKey}|${row.sourceEventKey}`,
              sourceRef: `${existing.sourceRef}|${row.sourceRef}`,
            }
          : row,
      )
    }
    const rows = [...combined.values()]
    const status = rows.length ? ('source_action_production' as const) : actionGrant.status
    const result = {
      status,
      agentId: group.agentId,
      actionId: group.actionId,
      occurrenceCount: actionGrant.occurrenceCount,
      rows,
      sourceRefs: actionGrant.sourceRefs,
      completeResourceCycle: false as const,
      boundary: actionGrant.boundary,
    }
    return {
      ...result,
      fingerprint: contentHash(result),
    }
  })
}
