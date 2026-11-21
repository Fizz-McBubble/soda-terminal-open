import { isDamageFormula32Version } from './sharpDamageCore'
import { executePlanningInteractionContract } from './planningInteractionOperators'
import type {
  ReferenceCombatEvent,
  ReferenceCombatInput,
  ReferenceCombatResult,
} from './referenceCombatContract'

// Claret's released core text explicitly retains DEF scaling and the two laceration checks.
// A numeric skill-row pin alone cannot establish continuity of the damage family.
export const claretSharpSource33 =
  'https://static.nanoka.cc/zzz/3.3/zh/character/1611.json#sha256=7e4ea618277eb357e961f5ba20807db82dd3382d8c49afe04d85152212bf6ebd'

export function referenceEventUsesTypedFormula(
  input: ReferenceCombatInput,
  event: ReferenceCombatEvent,
) {
  if (isDamageFormula32Version(input.gameVersion)) return true
  return (
    input.gameVersion === '3.3' &&
    event.kind === 'sharp' &&
    event.ownerAgentId === 'agent-claret' &&
    event.scalingAttribute === 'defense' &&
    input.sources.some(
      (s) =>
        event.sourceRefs.includes(s.id) &&
        s.kind === 'verified_definition' &&
        s.sourceVersion === '3.3' &&
        s.targetVersion === '3.3' &&
        s.ref === claretSharpSource33,
    )
  )
}

const unique = (values: readonly string[]) => new Set(values).size === values.length

export function validateReferenceCombat(input: ReferenceCombatInput) {
  const blockers = [...input.missingInputs]
  const memberIds = new Set(input.members.map((member) => member.agentId))
  const sources = new Map(input.sources.map((source) => [source.id, source]))
  const actions = new Map(input.actions.map((action) => [action.id, action]))
  const resources = new Map(input.resources.map((resource) => [resource.id, resource]))
  const duration = input.scenario.durationSeconds
  const sourceRefs = (refs: readonly string[]) => {
    for (const ref of refs) if (!sources.has(ref)) blockers.push(`unknown_source:${ref}`)
  }
  const numericSource = (refs: readonly string[], subject: string) => {
    if (
      !refs.some((ref) =>
        ['verified_definition', 'semantic_fixture'].includes(sources.get(ref)?.kind ?? ''),
      )
    )
      blockers.push(`missing_numeric_definition:${subject}`)
  }
  const member = (id: string) => {
    if (!memberIds.has(id)) blockers.push(`unknown_member:${id}`)
  }
  for (const [name, rows] of Object.entries({
    sources: input.sources,
    actions: input.actions,
    events: input.events,
    effects: input.effects,
    resources: input.resources,
    changes: input.resourceChanges,
  }))
    if (!unique(rows.map((row) => row.id))) blockers.push(`duplicate_id:${name}`)
  if (memberIds.size !== 3) blockers.push('exact_three_members_required')
  for (const source of input.sources) {
    if (source.targetVersion !== input.gameVersion) blockers.push(`stale_source:${source.id}`)
    if (source.kind === 'unverified') blockers.push(`unverified_source:${source.id}`)
    if (source.sourceVersion !== input.gameVersion && !source.continuityRef)
      blockers.push(`continuity_required:${source.id}`)
  }
  for (const row of input.members) {
    if (row.buildPolicyId !== input.buildPolicyId)
      blockers.push(`unequal_build_policy:${row.agentId}`)
    sourceRefs(row.sourceRefs)
    numericSource(row.sourceRefs, `build:${row.agentId}`)
  }
  for (const action of input.actions) {
    member(action.ownerAgentId)
    sourceRefs(action.sourceRefs)
    if (
      action.end <= action.start ||
      action.end > duration ||
      action.fieldEnd < action.start ||
      action.fieldEnd > action.end
    )
      blockers.push(`invalid_action_window:${action.id}`)
  }
  const field = input.actions
    .filter((action) => action.fieldEnd > action.start)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  for (let index = 1; index < field.length; index++)
    if (field[index]!.start < field[index - 1]!.fieldEnd)
      blockers.push(`field_overlap:${field[index - 1]!.id}:${field[index]!.id}`)
  for (const event of input.events) {
    member(event.ownerAgentId)
    sourceRefs(event.sourceRefs)
    numericSource(event.sourceRefs, `event:${event.id}`)
    if (input.coveredMechanics.includes('full-rotation-state-settlement') && !event.settlement)
      blockers.push(`missing_full_rotation_settlement:${event.id}`)
    if (event.settlement) {
      const settlementKind = event.settlement.family === 'direct' ? 'direct' : 'anomaly'
      if (settlementKind !== event.kind || event.anomalyContributions || event.anomalyDomain ||
        input.effects.length || !input.coveredMechanics.includes('full-rotation-state-settlement'))
        blockers.push(`mixed_settlement_paths:${event.id}`)
      if (event.multiplier !== (event.settlement.family === 'direct'
        ? event.settlement.motionValue : event.settlement.family === 'anomaly'
          ? event.settlement.baseMultiplier : 1) ||
        event.hitCount !== (event.settlement.family === 'direct' ? event.settlement.hitCount : 1))
        blockers.push(`settlement_identity_mismatch:${event.id}`)
    }
    if (event.anomalyContributions) {
      if (event.kind !== 'anomaly' || !event.attribute || event.hitCount !== 1 ||
        (event.attribute === 'wind' && event.anomalyDomain?.kind !== 'wind') ||
        (event.attribute !== 'wind' && event.anomalyDomain?.kind === 'wind') ||
        (event.attribute === 'wind' && event.anomalyDomain?.kind === 'vortex'))
        blockers.push(`unsupported_contribution_anomaly:${event.id}`)
      if (!unique(event.anomalyContributions.map((row) => row.id)))
        blockers.push(`duplicate_anomaly_contribution:${event.id}`)
      for (const contribution of event.anomalyContributions) {
        member(contribution.ownerAgentId)
        sourceRefs(contribution.sourceRefs)
        numericSource(contribution.sourceRefs, `contribution:${contribution.id}`)
        if (contribution.snapshotAt > event.at)
          blockers.push(`future_contribution_snapshot:${contribution.id}`)
        if (input.members.find(row => row.agentId === contribution.ownerAgentId)?.level !== contribution.snapshot.attackerLevel)
          blockers.push(`contribution_level_mismatch:${contribution.id}`)
      }
    }
    if (event.anomalyDomain && !event.anomalyContributions) blockers.push(`missing_anomaly_contributions:${event.id}`)
    if (event.anomalyDomain && event.anomalyDomain.kind !== 'ordinary' && event.multiplier !== 1)
      blockers.push(`ambiguous_anomaly_domain_multiplier:${event.id}`)
    const action = actions.get(event.actionId)
    if (!action) blockers.push(`unknown_event_action:${event.id}`)
    else {
      if (event.at < action.start) blockers.push(`event_before_action:${event.id}`)
      if (event.at >= action.end && !event.delayed) blockers.push(`event_after_action:${event.id}`)
      if (event.ownerAgentId !== action.ownerAgentId && event.ownership !== 'sourced_off_field')
        blockers.push(`event_owner_mismatch:${event.id}`)
      if (
        (event.delayed || event.ownership === 'sourced_off_field') &&
        (!event.mechanicId || !input.coveredMechanics.includes(event.mechanicId))
      )
        blockers.push(`unbound_shared_mechanic:${event.id}`)
    }
    if (event.at >= duration) blockers.push(`event_outside_horizon:${event.id}`)
    if (event.snapshotAt !== undefined && event.snapshotAt > event.at)
      blockers.push(`future_snapshot:${event.id}`)
    if (
      event.kind === 'sheer' &&
      !input.members.find((row) => row.agentId === event.ownerAgentId)?.stats.sheerForce
    )
      blockers.push(`missing_sheer_force:${event.ownerAgentId}`)
    if (event.kind === 'sharp' && !referenceEventUsesTypedFormula(input, event))
      blockers.push(`sharp_version_not_reviewed:${event.id}`)
    const stats = input.members.find((row) => row.agentId === event.ownerAgentId)?.stats
    if ((event.kind === 'sharp' || event.scalingAttribute === 'defense') && !stats?.defense)
      blockers.push(`missing_defense:${event.ownerAgentId}`)
    if (event.kind === 'sharp' && stats?.lacerationDamage === undefined)
      blockers.push(`missing_laceration_damage:${event.ownerAgentId}`)
    if (event.kind === 'sharp' && event.scalingAttribute !== 'defense')
      blockers.push(`missing_sharp_scaling_contract:${event.id}`)
    if (event.kind === 'anomaly' && event.scalingAttribute && event.scalingAttribute !== 'attack')
      blockers.push(`invalid_anomaly_scaling:${event.id}`)
    if (event.kind === 'sheer' && event.scalingAttribute && event.scalingAttribute !== 'sheerForce')
      blockers.push(`invalid_sheer_scaling:${event.id}`)
    if (event.kind === 'direct' && event.scalingAttribute === 'sheerForce')
      blockers.push(`invalid_direct_scaling:${event.id}`)
  }
  for (const effect of input.effects) {
    member(effect.providerAgentId)
    effect.recipientAgentIds.forEach(member)
    sourceRefs(effect.sourceRefs)
    numericSource(effect.sourceRefs, `effect:${effect.id}`)
    if (!effect.stackGroup || !effect.stacking) blockers.push(`missing_stack_contract:${effect.id}`)
    if (!unique(effect.modifiers.map((modifier) => modifier.key)))
      blockers.push(`duplicate_modifier:${effect.id}`)
    const activation = effect.activationActionId ? actions.get(effect.activationActionId) : null
    if (effect.initial) {
      if (effect.start !== 0 || activation) blockers.push(`invalid_initial_effect:${effect.id}`)
    } else if (
      !activation ||
      activation.ownerAgentId !== effect.providerAgentId ||
      effect.start < activation.start ||
      effect.start > activation.end
    )
      blockers.push(`unbound_effect_activation:${effect.id}`)
    if (!unique(effect.recipientAgentIds)) blockers.push(`duplicate_recipient:${effect.id}`)
    if (effect.end <= effect.start || effect.start >= duration)
      blockers.push(`invalid_effect_window:${effect.id}`)
    for (const recipient of input.members.filter((row) =>
      effect.recipientAgentIds.includes(row.agentId),
    )) {
      if (
        effect.modifiers.some((modifier) => modifier.key === 'attackPercent') &&
        !recipient.stats.baseAttack
      )
        blockers.push(`missing_base_attack:${recipient.agentId}`)
      if (
        effect.modifiers.some((modifier) => modifier.key === 'defensePercent') &&
        !recipient.stats.baseDefense
      )
        blockers.push(`missing_base_defense:${recipient.agentId}`)
      if (
        input.events.some(
          (event) => event.ownerAgentId === recipient.agentId && event.kind === 'sheer',
        ) &&
        effect.modifiers.some(
          (modifier) => modifier.key === 'attackPercent' || modifier.key === 'attackFlat',
        ) &&
        recipient.stats.sheerForceAttackRatio === undefined
      )
        blockers.push(`missing_sheer_conversion:${recipient.agentId}`)
    }
  }
  for (const effect of input.effects) {
    const overlapping = input.effects.filter(
      (other) =>
        other.providerAgentId === effect.providerAgentId &&
        other.stackGroup === effect.stackGroup &&
        other.start < effect.end &&
        effect.start < other.end &&
        other.recipientAgentIds.some((recipient) => effect.recipientAgentIds.includes(recipient)),
    )
    if (overlapping.some((other) => other.stacking !== effect.stacking))
      blockers.push(`conflicting_stack_contract:${effect.stackGroup}`)
    if (effect.stacking === 'add') {
      for (const at of overlapping.map((other) => other.start)) {
        const count = overlapping.filter((other) => other.start <= at && at < other.end).length
        if (count > (effect.maxStacks ?? 1)) blockers.push(`stack_limit:${effect.stackGroup}`)
      }
    } else if (
      effect.stacking === 'refresh' &&
      overlapping.some((other) => other.id !== effect.id && other.start === effect.start)
    )
      blockers.push(`ambiguous_refresh:${effect.stackGroup}`)
  }
  const stun = [...input.stunWindows].sort((a, b) => a.start - b.start)
  stun.forEach((row, index) => {
    sourceRefs(row.sourceRefs)
    const activation = row.activationActionId ? actions.get(row.activationActionId) : null
    if (row.activationEventId) {
      const tied = input.events.filter((event) => event.at === row.start)
      const trigger = tied.find((event) => event.id === row.activationEventId)
      if (row.initial || !trigger || trigger.actionId !== row.activationActionId)
        blockers.push('unbound_stun_contact')
      if (
        tied.length > 1 &&
        (tied.some((event) => event.contactOrder === undefined) ||
          new Set(tied.map((event) => event.contactOrder)).size !== tied.length)
      )
        blockers.push('ambiguous_stun_contact_order')
    }
    if (row.initial) {
      if (row.start !== 0 || activation) blockers.push('invalid_initial_stun')
    } else if (!activation || row.start < activation.start || row.start > activation.end)
      blockers.push('unbound_stun_activation')
    if (
      row.end <= row.start ||
      row.start >= duration ||
      (index > 0 && row.start < stun[index - 1]!.end)
    )
      blockers.push('invalid_stun_windows')
  })
  const changeOrder = new Set<string>()
  for (const change of input.resourceChanges) {
    sourceRefs(change.sourceRefs)
    const action = actions.get(change.actionId)
    const resource = resources.get(change.resourceId)
    if (!action || !resource) blockers.push(`unknown_resource_binding:${change.id}`)
    else if (
      (resource.ownerAgentId !== action.ownerAgentId && change.ownership !== 'sourced_off_field') ||
      change.at < action.start ||
      change.at > action.end ||
      (change.at === action.end && change.phase !== 'completion')
    )
      blockers.push(`invalid_resource_binding:${change.id}`)
    if (change.ownership === 'sourced_off_field' &&
      (!change.mechanicId || !input.coveredMechanics.includes(change.mechanicId)))
      blockers.push(`unbound_resource_mechanic:${change.id}`)
    if (change.at > duration || (change.at === duration && change.phase !== 'completion'))
      blockers.push(`resource_outside_horizon:${change.id}`)
    const orderKey = `${change.resourceId}:${change.at}:${change.order}`
    if (changeOrder.has(orderKey)) blockers.push(`ambiguous_resource_order:${change.id}`)
    changeOrder.add(orderKey)
  }
  const resourceLedger: ReferenceCombatResult['resourceLedger'] = []
  for (const resource of input.resources) {
    member(resource.ownerAgentId)
    sourceRefs(resource.sourceRefs)
    numericSource(resource.sourceRefs, `resource:${resource.id}`)
    const changes = input.resourceChanges
      .filter((change) => change.resourceId === resource.id)
      .sort((a, b) => a.at - b.at || a.order - b.order)
    const result = executePlanningInteractionContract({
      contractId: resource.id,
      sourceRefs: resource.sourceRefs,
      authority: 'source_backed',
      operator: 'resource_state_transition',
      resourceKey: resource.id,
      initialValue: resource.initial,
      minimum: resource.minimum,
      maximum: resource.maximum,
      transitions: changes.map((change) => ({
        atSeconds: change.at,
        ownerAgentId: resource.ownerAgentId,
        delta: change.delta,
        reason: change.id,
      })),
    })
    if (result.status === 'unsupported') blockers.push(`resource_balance:${resource.id}`)
    else if (result.operator === 'resource_state_transition')
      result.states.forEach((state) => {
        resourceLedger.push({
          resourceId: resource.id,
          at: state.atSeconds,
          changeId: state.reason,
          valueAfter: state.valueAfter,
        })
      })
  }
  for (const required of input.requiredMechanics)
    if (!input.coveredMechanics.includes(required)) blockers.push(`missing_mechanic:${required}`)
  return { blockers: [...new Set(blockers)], resourceLedger }
}
