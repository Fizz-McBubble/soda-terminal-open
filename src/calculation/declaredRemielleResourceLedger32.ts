import type { z } from 'zod'
import { contentHash } from '../application/contentHash'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  applyCurrentAgentResourceAction32,
  type CurrentAgentResourceFlow32,
} from './currentAgentResourceFlow32'
import {
  executePlanningInteractionContract,
  type PlanningInteractionContract,
} from './planningInteractionOperators'

import {
  declaredRemielleResourceLedgerSchema32,
  remielleResourceLedgerRules32,
  remielleResourceLedgerRulesHash32,
  regularFlare,
  event,
} from './remielleResourceLedgerContract32'
export {
  declaredRemielleResourceLedgerSchema32,
  remielleResourceLedgerRules32,
  remielleResourceLedgerRulesHash32,
  type DeclaredRemielleResourceLedger32,
} from './remielleResourceLedgerContract32'

type RegularFlare = z.infer<typeof regularFlare> & { origin: 'teammate_refringe' }
type SpecialFlare = {
  id: string
  origin: 'm1_entry' | 'm4_refill' | 'm6_basic_four'
  snapshotAtSeconds: number
  strengthRatio: number
}
type Flare = RegularFlare | SpecialFlare
type ResourceContract = Extract<
  PlanningInteractionContract,
  { operator: 'resource_state_transition' }
>

/** The source flow supplies numeric Radiance authority. This adapter adds only
 * explicit event legality and ephemeral queue/state, then reuses generic bounds
 * and conservation. No inferred autonomous timeline or full-cycle authority. */
export function compileRemielleResourceLedger32(
  raw: unknown,
  source: {
    sourceIdentityHash: string
    sourceRefs: readonly string[]
    resourceFlow: CurrentAgentResourceFlow32
  } | null,
) {
  const limits = {
    completeResourceCycle: false as const,
    formalCycleReady: false as const,
    runtimeTimelineProven: false as const,
    boundary:
      '显式事件的资源守恒、Phase Flow资格与最近三份虚光队列；真实时序、特殊虚光伤害与完整循环未推断。',
  }
  const fail = (blocker: string) => ({
    status: 'unsupported' as const,
    blockers: [blocker],
    ...limits,
  })
  const parsed = declaredRemielleResourceLedgerSchema32.safeParse(raw)
  if (!parsed.success) return fail('remielle_resource_ledger_invalid')
  const input = parsed.data
  if (
    !source ||
    input.sourceIdentityHash !== source.sourceIdentityHash ||
    input.rulesIdentityHash !== remielleResourceLedgerRulesHash32 ||
    !input.sourceRefs.some((ref) => source.sourceRefs.includes(ref))
  )
    return fail('remielle_resource_ledger_source_mismatch')
  const cap = source.resourceFlow.parameters.floating_radiance_cap
  const rate = source.resourceFlow.parameters.floating_radiance_phase_flow_drain_per_second
  if (
    typeof cap !== 'number' ||
    !Number.isFinite(cap) ||
    cap <= 0 ||
    typeof rate !== 'number' ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    input.initialRadiance > cap
  )
    return fail('remielle_resource_ledger_source_parameters_invalid')
  if (
    new Set(input.memberAgentIds).size !== input.memberAgentIds.length ||
    !input.memberAgentIds.includes('agent-remielle')
  )
    return fail('remielle_resource_ledger_members_invalid')
  if (
    new Set(input.events.map((row) => row.id)).size !== input.events.length ||
    input.events.some(
      (row, index) =>
        row.atSeconds > input.durationSeconds ||
        (index > 0 && row.atSeconds < input.events[index - 1]!.atSeconds),
    )
  )
    return fail('remielle_resource_ledger_event_identity_or_order_invalid')
  const validateFlare = (flare: z.infer<typeof regularFlare>, at: number) =>
    flare.ownerAgentId !== 'agent-remielle' &&
    !flare.id.startsWith('special:') &&
    input.memberAgentIds.includes(flare.ownerAgentId) &&
    getCurrentAgentEventContract(flare.ownerAgentId)?.identity.attribute === flare.attribute &&
    flare.snapshotAtSeconds <= at
  if (input.initial.voidflares.some((flare) => !validateFlare(flare, 0)))
    return fail('remielle_resource_ledger_initial_flare_invalid')
  const usedIds = new Set(input.initial.voidflares.map((flare) => flare.id))
  if (usedIds.size !== input.initial.voidflares.length)
    return fail('remielle_resource_ledger_duplicate_flare')
  let queue: Flare[] = input.initial.voidflares.map((flare) => ({
    ...flare,
    origin: 'teammate_refringe',
  }))
  let current = input.initialRadiance
  let inCombat = input.initial.inCombat
  let onField = input.initial.onField
  let reflection = input.initial.luminousReflection
  let phaseFlow = false
  let phaseRefringes = 0
  let assistAvailable = false
  let assistUsed = false
  let normalSwitchUnlocked = false
  let m4Armed = false
  let lastEntryGrant: number | null = null
  let lastAssistGain: number | null = null
  let pendingSpecial: Extract<z.infer<typeof event>, { kind: 'special_completed' }> | null = null
  let overflow = 0
  let effectiveResourceSeconds = 0
  let previousAt = 0
  const transitions: ResourceContract['transitions'] = []
  const actions: Array<{
    eventId: string
    eventKey: string
    atSeconds: number
    valueBefore: number
    valueAfter: number
    requestedAmount: number
    effectiveDelta: number
    overflow: number
    conditionApplied: boolean
  }> = []
  const ledger: Array<{
    eventId: string
    atSeconds: number
    radiance: number
    phaseFlow: boolean
    phaseRefringes: number
    assistAvailable: boolean
    assistUsed: boolean
    luminousReflection: typeof reflection
    voidflareIds: string[]
  }> = []
  const volleys: Array<{
    eventId: string
    atSeconds: number
    skill: 'rainbows_end' | 'fleeting_grace' | 'ultimate' | 'flower_feather'
    voidflares: Flare[]
    repetitions: number
    consumed: boolean
    regularSettlementReady: boolean
    ordinaryVoidflares: Array<z.infer<typeof regularFlare>> | null
  }> = []
  const decibelGrants: Array<{ eventId: string; atSeconds: number; amount: number }> = []
  const autonomousOutcomes: Array<{
    eventId: string
    atSeconds: number
    animationEventId: string
    targetId: string
    lumifluxPoints: number
    abloomDamageRatio: number
    mindscapeTwoAmplifyRatio: number
    autonomousDamageCoefficient: number
    mindscapeTwoDefenseIgnore: {
      ratio: number | null
      eligibility: 'inactive' | 'requires_fading_target_and_anomaly_damage'
    }
    cadenceSeconds: null
    sourceRefs: string[]
  }> = []
  const phaseFlowWindows: Array<{
    startSeconds: number
    endSeconds: number
    startingRadiance: number
    depletedAtSeconds: number | null
  }> = []
  const applyAction = (eventId: string, atSeconds: number, eventKey: string) => {
    const result = applyCurrentAgentResourceAction32({
      flow: source.resourceFlow,
      resource: 'floating_radiance',
      eventKey,
      current,
      maximum: cap,
    })
    if (result.status !== 'supported') return false
    current = result.valueAfter
    overflow += result.overflow
    transitions.push({
      atSeconds,
      ownerAgentId: 'agent-remielle',
      delta: result.delta,
      reason: `declared_event:${eventId}:${eventKey}`,
    })
    actions.push({
      eventId,
      eventKey,
      atSeconds,
      valueBefore: result.valueBefore,
      valueAfter: result.valueAfter,
      requestedAmount: result.requestedAmount,
      effectiveDelta: result.delta,
      overflow: result.overflow,
      conditionApplied: result.conditionApplied,
    })
    return true
  }
  const addSpecial = (
    eventId: string,
    atSeconds: number,
    origin: SpecialFlare['origin'],
    strengthRatio = 1,
  ) => {
    queue = [
      ...queue,
      ...Array.from({ length: remielleResourceLedgerRules32.voidflareCap }, (_, i) => ({
        id: `special:${eventId}:${origin}:${i}`,
        origin,
        snapshotAtSeconds: atSeconds,
        strengthRatio,
      })),
    ].slice(-remielleResourceLedgerRules32.voidflareCap)
  }
  const volley = (
    eventId: string,
    atSeconds: number,
    skill: (typeof volleys)[number]['skill'],
    consumed: boolean,
  ) => {
    const frozen = structuredClone(queue)
    const ordinaryVoidflares = frozen.every(
      (flare): flare is RegularFlare => flare.origin === 'teammate_refringe',
    )
      ? frozen.map((flare) => ({
          id: flare.id,
          ownerAgentId: flare.ownerAgentId,
          attribute: flare.attribute,
          snapshotAtSeconds: flare.snapshotAtSeconds,
          stats: flare.stats,
          storedRefringeCoefficient: flare.storedRefringeCoefficient,
          sourceRefs: flare.sourceRefs,
        }))
      : null
    volleys.push({
      eventId,
      atSeconds,
      skill,
      voidflares: frozen,
      repetitions: consumed && input.mindscape >= 6 ? 2 : 1,
      consumed,
      regularSettlementReady:
        frozen.length > 0 && frozen.every((flare) => flare.origin === 'teammate_refringe'),
      ordinaryVoidflares,
    })
  }
  for (const row of input.events) {
    if (!inCombat && row.kind !== 'battle_entry')
      return fail(`remielle_resource_ledger_out_of_combat:${row.id}`)
    // Eligibility belongs to the immediately declared completed Special -> switch.
    if (row.kind !== 'switch_out' && row.kind !== 'special_completed') pendingSpecial = null
    if (row.kind === 'battle_entry') {
      if (inCombat) return fail(`remielle_resource_ledger_duplicate_battle_entry:${row.id}`)
      inCombat = true
      onField = true
      if (!applyAction(row.id, row.atSeconds, 'battle_entry'))
        return fail('remielle_resource_ledger_action_unresolved')
      if (
        input.mindscape >= 1 &&
        (!row.investigationZone || lastEntryGrant === null || row.atSeconds - lastEntryGrant >= 180)
      ) {
        addSpecial(row.id, row.atSeconds, 'm1_entry')
        lastEntryGrant = row.atSeconds
        m4Armed = input.mindscape >= 4
      }
    } else if (row.kind === 'combat_exit') {
      if (phaseFlow) phaseFlowWindows[phaseFlowWindows.length - 1]!.endSeconds = row.atSeconds
      inCombat = false
      phaseFlow = false
      assistAvailable = false
    } else if (row.kind === 'special_completed') {
      if (!onField) return fail(`remielle_resource_ledger_action_off_field:${row.id}`)
      pendingSpecial = row
    } else if (row.kind === 'switch_out') {
      if (!onField) return fail(`remielle_resource_ledger_already_off_field:${row.id}`)
      if (row.specialEventId) {
        if (
          !pendingSpecial ||
          pendingSpecial.id !== row.specialEventId ||
          (!pendingSpecial.stanceShift && !pendingSpecial.hitStunnedEnemy) ||
          current !== cap ||
          phaseFlow
        )
          return fail(`remielle_resource_ledger_phase_entry_ineligible:${row.id}`)
        phaseFlow = true
        phaseRefringes = 0
        assistAvailable = false
        assistUsed = false
        normalSwitchUnlocked = false
        queue = []
        m4Armed = false
        phaseFlowWindows.push({
          startSeconds: row.atSeconds,
          endSeconds: input.durationSeconds,
          startingRadiance: current,
          depletedAtSeconds: null,
        })
      }
      pendingSpecial = null
      onField = false
    } else if (row.kind === 'switch_in') {
      if (onField || (phaseFlow && row.method === 'normal' && !normalSwitchUnlocked))
        return fail(`remielle_resource_ledger_switch_in_ineligible:${row.id}`)
      if (row.method === 'chain' && row.assistHit)
        return fail(`remielle_resource_ledger_chain_assist_replacement_unresolved:${row.id}`)
      onField = true
      if (row.method === 'chain') reflection = 'present'
      else if (assistAvailable && !assistUsed) {
        if (!applyAction(row.id, row.atSeconds, 'assist.flower_feather'))
          return fail('remielle_resource_ledger_assist_unresolved')
        assistAvailable = false
        assistUsed = true
        // Source/guide disagree about Reflection's conditional scope; retain input.
        reflection = row.reflectionAfterAssist
        if (row.assistHit) volley(row.id, row.atSeconds, 'flower_feather', false)
        if (
          input.mindscape >= 1 &&
          (lastAssistGain === null || row.atSeconds - lastAssistGain >= 18)
        ) {
          decibelGrants.push({ eventId: row.id, atSeconds: row.atSeconds, amount: 200 })
          lastAssistGain = row.atSeconds
        }
      } else if (row.assistHit)
        return fail(`remielle_resource_ledger_assist_not_available:${row.id}`)
    } else if (row.kind === 'teammate_refringe') {
      if (!validateFlare(row.flare, row.atSeconds) || usedIds.has(row.flare.id))
        return fail(`remielle_resource_ledger_flare_identity_invalid:${row.id}`)
      usedIds.add(row.flare.id)
      queue = [...queue, { ...row.flare, origin: 'teammate_refringe' as const }].slice(-3)
      if (phaseFlow) {
        phaseRefringes++
        if (phaseRefringes >= 3) {
          normalSwitchUnlocked = true
          if (!assistUsed) assistAvailable = true
        }
      }
    } else if (row.kind === 'phase_clock') {
      if (
        !phaseFlow ||
        row.elapsedSeconds > row.atSeconds - previousAt ||
        row.atSeconds < previousAt
      )
        return fail(`remielle_resource_ledger_phase_clock_invalid:${row.id}`)
      const consumed = Math.min(current, rate * row.elapsedSeconds)
      effectiveResourceSeconds += consumed / rate
      current -= consumed
      transitions.push({
        atSeconds: row.atSeconds,
        ownerAgentId: 'agent-remielle',
        delta: -consumed,
        reason: `declared_effective_phase_clock:${row.id}`,
      })
      if (current === 0) {
        phaseFlow = false
        const window = phaseFlowWindows[phaseFlowWindows.length - 1]!
        // atSeconds marks the end of this explicitly supplied effective span;
        // no wall-clock depletion timestamp is inferred during unspecified pauses.
        window.endSeconds = row.atSeconds
        window.depletedAtSeconds = row.atSeconds
        if (queue.length) {
          normalSwitchUnlocked = true
          if (!assistUsed) assistAvailable = true
        }
      }
    } else if (row.kind === 'autonomous_hit') {
      if (!phaseFlow) return fail(`remielle_resource_ledger_autonomous_outside_phase:${row.id}`)
      if (row.animationEventId !== remielleResourceLedgerRules32.autonomousAction.eventId)
        return fail(`remielle_resource_ledger_autonomous_event_unbound:${row.id}`)
      autonomousOutcomes.push({
        eventId: row.id,
        atSeconds: row.atSeconds,
        animationEventId: row.animationEventId,
        targetId: row.targetId,
        lumifluxPoints: row.lumifluxPoints,
        abloomDamageRatio:
          remielleResourceLedgerRules32.mindscapeTwoAutonomousDamage.abloomDamageRatio,
        mindscapeTwoAmplifyRatio:
          input.mindscape >= 2
            ? remielleResourceLedgerRules32.mindscapeTwoAutonomousDamage.amplifyRatio
            : 0,
        autonomousDamageCoefficient:
          remielleResourceLedgerRules32.mindscapeTwoAutonomousDamage.abloomDamageRatio *
          (1 +
            (input.mindscape >= 2
              ? remielleResourceLedgerRules32.mindscapeTwoAutonomousDamage.amplifyRatio
              : 0)),
        mindscapeTwoDefenseIgnore:
          input.mindscape >= 2
            ? {
                ratio: null,
                eligibility: 'requires_fading_target_and_anomaly_damage' as const,
              }
            : { ratio: 0, eligibility: 'inactive' as const },
        cadenceSeconds: null,
        sourceRefs: [
          ...remielleResourceLedgerRules32.autonomousAction.source.map(
            (source) => `${source.path}#${source.blobSha1}:${source.locator}`,
          ),
          ...remielleResourceLedgerRules32.mindscapeTwoAutonomousDamage.source.map(
            (source) => `${source.path}#${source.sha256}:${source.locator}`,
          ),
        ],
      })
    } else if (row.kind === 'completed_action') {
      if (!onField) return fail(`remielle_resource_ledger_action_off_field:${row.id}`)
      const enhanced = row.actionKey === 'basic.rainbow' || row.actionKey === 'basic.fleeting'
      if (enhanced) {
        if (
          !queue.length ||
          (row.actionKey === 'basic.fleeting' && reflection !== 'present') ||
          (row.actionKey === 'basic.rainbow' && reflection !== 'absent')
        )
          return fail(`remielle_resource_ledger_hold_basic_ineligible:${row.id}`)
        if (row.hit)
          volley(
            row.id,
            row.atSeconds,
            row.actionKey === 'basic.rainbow' ? 'rainbows_end' : 'fleeting_grace',
            true,
          )
        queue = []
        if (row.actionKey === 'basic.fleeting') reflection = 'absent'
        if (m4Armed) {
          m4Armed = false
          addSpecial(row.id, row.atSeconds, 'm4_refill')
        }
      } else if (row.actionKey === 'ultimate') {
        if (row.hit) volley(row.id, row.atSeconds, 'ultimate', false)
      }
      // Basic/Solo require a hit; enhanced holds grant their source amount at end.
      if (
        row.actionKey !== 'ultimate' &&
        (row.hit || enhanced) &&
        !applyAction(row.id, row.atSeconds, row.actionKey)
      )
        return fail('remielle_resource_ledger_action_unresolved')
      if (row.actionKey === 'basic.leap.hit4' && row.hit && input.mindscape >= 6)
        addSpecial(row.id, row.atSeconds, 'm6_basic_four', 0.25)
    }
    ledger.push({
      eventId: row.id,
      atSeconds: row.atSeconds,
      radiance: current,
      phaseFlow,
      phaseRefringes,
      assistAvailable,
      assistUsed,
      luminousReflection: reflection,
      voidflareIds: queue.map((flare) => flare.id),
    })
    previousAt = row.atSeconds
  }
  const resourceContract: ResourceContract = {
    contractId: `declared-remielle-ledger32:${contentHash(input)}`,
    operator: 'resource_state_transition',
    authority: 'source_backed',
    sourceRefs: [
      ...new Set([
        ...source.sourceRefs,
        ...input.sourceRefs,
        `upstream:${remielleResourceLedgerRules32.source.commit}:${remielleResourceLedgerRules32.source.localizationPath}:${remielleResourceLedgerRules32.source.localizationSha256}`,
      ]),
    ],
    resourceKey: 'floating_radiance',
    initialValue: input.initialRadiance,
    minimum: 0,
    maximum: cap,
    transitions,
  }
  const checked = executePlanningInteractionContract(resourceContract)
  if (
    checked.status !== 'supported' ||
    checked.operator !== 'resource_state_transition' ||
    !checked.conserved
  )
    return fail('remielle_resource_ledger_generic_resource_check_failed')
  return {
    status: 'declared_resource_arithmetic' as const,
    sourceIdentityHash: source.sourceIdentityHash,
    sourceRefs: resourceContract.sourceRefs,
    inputFingerprint: contentHash(input),
    durationSeconds: input.durationSeconds,
    initialValue: input.initialRadiance,
    cap,
    endingValue: checked.endingValue,
    generated: checked.generated,
    consumed: checked.consumed,
    conserved: checked.conserved,
    states: checked.states,
    actions,
    overflow,
    phaseFlowWindows,
    effectiveResourceSeconds,
    resourceContract,
    eventLegality: 'declared_events_checked' as const,
    ledger,
    volleys,
    decibelGrants,
    autonomousOutcomes,
    endingVoidflares: queue,
    rulesIdentityHash: contentHash(remielleResourceLedgerRules32),
    blockers: [],
    ...limits,
  }
}
