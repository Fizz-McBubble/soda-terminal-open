import { z } from 'zod'
import { contentHash } from '../application/contentHash'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { compileRemielleResourceLedger32 } from './declaredRemielleResourceLedger32'
import { applyCurrentAgentResourceAction32 } from './currentAgentResourceFlow32'
import {
  executePlanningInteractionContract,
  type PlanningInteractionContract,
} from './planningInteractionOperators'

const finite = z.number().finite()
const id = z.string().trim().min(1)
const refs = z.array(id).min(1)
const resource = 'floating_radiance' as const
const ownerAgentId = 'agent-remielle' as const

const actionKey = z.enum([
  'battle_entry',
  'basic.leap.hit1',
  'basic.leap.hit2',
  'basic.leap.hit3',
  'basic.leap.hit4',
  'basic.solo_dance',
  'basic.rainbow',
  'basic.fleeting',
  'assist.flower_feather',
])

const sourceFlowSchema = z
  .object({
    status: z.literal('compiled'),
    parameterClassification: z.literal('named_resource_or_state'),
    parameters: z.record(id, z.unknown()),
    resources: z
      .array(
        z
          .object({
            resource: id,
            stateParameterKeys: z.array(id),
            producerParameterKeys: z.array(id).optional(),
            consumerParameterKeys: z.array(id).optional(),
          })
          .passthrough(),
      )
      .min(1),
    transitionTemplates: z
      .array(
        z
          .object({
            eventKey: id,
            resource: z.literal(resource),
            operation: z.enum(['set', 'add', 'consume', 'set_to_cap']),
            parameterKey: id,
            parameterIndex: finite.int().nonnegative().optional(),
            condition: id.optional(),
          })
          .strict(),
      )
      .min(1),
    sourceRefs: refs,
    evidenceLocator: id,
  })
  .passthrough()

/** Identity covers the actual adopted flow, including parameters and provenance. */
export function getDeclaredRemielleRadianceSource32() {
  const raw = getCurrentAgentDecisionMechanicContract(ownerAgentId)?.resourceContract?.resourceFlow
  const parsed = sourceFlowSchema.safeParse(raw)
  if (!parsed.success || !parsed.data.resources.some((entry) => entry.resource === resource))
    return null
  return {
    sourceIdentityHash: contentHash({ agentId: ownerAgentId, resourceFlow: raw }),
    sourceRefs: [...new Set([...parsed.data.sourceRefs, parsed.data.evidenceLocator])],
    resourceFlow: parsed.data,
  }
}

export const declaredRemielleRadianceSchema32 = z
  .object({
    contract: z.literal('soda-declared-remielle-radiance32/v1'),
    sourceIdentityHash: id,
    sourceRefs: refs,
    durationSeconds: finite.positive(),
    initialRadiance: finite.nonnegative(),
    /** Completed action segments, not inferred physical hit timestamps. */
    events: z.array(z.object({ atSeconds: finite.nonnegative(), eventKey: actionKey }).strict()),
    /** All timestamps use the declared resource clock, not wall/enemy-stop time. */
    phaseFlowWindows: z.array(
      z
        .object({
          startSeconds: finite.nonnegative(),
          endSeconds: finite.positive(),
        })
        .strict(),
    ),
  })
  .strict()

export type DeclaredRemielleRadiance32 = z.infer<typeof declaredRemielleRadianceSchema32>
type ResourceContract = Extract<
  PlanningInteractionContract,
  { operator: 'resource_state_transition' }
>

export const declaredRemielleRadianceBoundary32 =
  '显式资源时钟与已完成动作段的光映值算术；复用已采用参数和通用资源守恒。' +
  '不验证虚光、动作资格、能量、喧响、自动攻击、停表时序或完整资源周期。'

/** Compile only the missing action/time adapter; generic resource arithmetic is
 * checked by executePlanningInteractionContract. At each timestamp: drain,
 * declared actions in input order, then require full Radiance for window entry.
 * Depletion ends that window's effective drain; a later refill cannot restart it. */
export function compileDeclaredRemielleRadiance32(raw: unknown) {
  if (
    raw &&
    typeof raw === 'object' &&
    'contract' in raw &&
    raw.contract === 'soda-declared-remielle-resource-ledger32/v1'
  )
    return compileRemielleResourceLedger32(raw, getDeclaredRemielleRadianceSource32())
  const limits = {
    boundary: declaredRemielleRadianceBoundary32,
    completeResourceCycle: false as const,
    formalCycleReady: false as const,
    runtimeTimelineProven: false as const,
  }
  const failure = (blocker: string) => ({
    status: 'unsupported' as const,
    blockers: [blocker],
    ...limits,
  })
  const parsed = declaredRemielleRadianceSchema32.safeParse(raw)
  if (!parsed.success) return failure('remielle_radiance_declaration_invalid')
  const input = parsed.data
  const source = getDeclaredRemielleRadianceSource32()
  if (!source) return failure('remielle_radiance_source_unavailable')
  if (
    input.sourceIdentityHash !== source.sourceIdentityHash ||
    !input.sourceRefs.some((ref) => source.sourceRefs.includes(ref))
  )
    return failure('remielle_radiance_source_mismatch')
  const flow = source.resourceFlow
  const numeric = (key: string) => {
    const value = flow.parameters[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const cap = numeric('floating_radiance_cap')
  const rate = numeric('floating_radiance_phase_flow_drain_per_second')
  const initial = numeric('floating_radiance_initial')
  if (
    cap === null ||
    cap <= 0 ||
    rate === null ||
    rate <= 0 ||
    initial === null ||
    initial < 0 ||
    initial > cap
  )
    return failure('remielle_radiance_source_parameters_invalid')
  if (input.initialRadiance > cap) return failure('remielle_radiance_initial_out_of_bounds')
  if (
    input.events.some(
      (event, index) =>
        event.atSeconds > input.durationSeconds ||
        (index > 0 && event.atSeconds < input.events[index - 1]!.atSeconds),
    )
  )
    return failure('remielle_radiance_event_order_or_time_invalid')
  if (
    input.phaseFlowWindows.some(
      (window, index) =>
        window.endSeconds <= window.startSeconds ||
        window.endSeconds > input.durationSeconds ||
        (index > 0 && window.startSeconds < input.phaseFlowWindows[index - 1]!.endSeconds),
    )
  )
    return failure('remielle_radiance_window_order_or_overlap_invalid')
  const templates = new Map(
    flow.transitionTemplates.map((template) => [template.eventKey, template]),
  )
  if (templates.size !== flow.transitionTemplates.length)
    return failure('remielle_radiance_source_duplicate_template')

  const transitions: ResourceContract['transitions'] = []
  const actions: Array<{
    eventKey: z.infer<typeof actionKey>
    atSeconds: number
    valueBefore: number
    valueAfter: number
    requestedAmount: number
    effectiveDelta: number
    overflow: number
    conditionApplied: boolean
  }> = []
  const windows: Array<{
    startSeconds: number
    endSeconds: number
    startingRadiance: number
    depletedAtSeconds: number | null
  }> = []
  let current = input.initialRadiance
  let overflow = 0
  const push = (atSeconds: number, delta: number, reason: string) => {
    current += delta
    transitions.push({ atSeconds, ownerAgentId, delta, reason })
  }
  let active: (typeof windows)[number] | undefined
  let previous = 0
  let eventIndex = 0
  let windowIndex = 0
  const times = [
    ...new Set([
      0,
      input.durationSeconds,
      ...input.events.map((event) => event.atSeconds),
      ...input.phaseFlowWindows.flatMap((window) => [window.startSeconds, window.endSeconds]),
    ]),
  ].sort((left, right) => left - right)
  for (const atSeconds of times) {
    if (active && active.depletedAtSeconds === null && atSeconds > previous) {
      const elapsed = atSeconds - previous
      const secondsToEmpty = current / rate
      if (elapsed >= secondsToEmpty) {
        const depletedAt = previous + secondsToEmpty
        push(depletedAt, -current, 'phase_flow:declared_resource_clock_depletion')
        active.depletedAtSeconds = depletedAt
      } else {
        push(atSeconds, -(elapsed * rate), 'phase_flow:declared_resource_clock_drain')
      }
    }
    if (active?.endSeconds === atSeconds) active = undefined
    while (input.events[eventIndex]?.atSeconds === atSeconds) {
      const event = input.events[eventIndex++]!
      const template = templates.get(event.eventKey)
      if (!template) return failure('remielle_radiance_action_template_missing')
      if (!template.condition && event.eventKey === 'assist.flower_feather') {
        return failure('remielle_radiance_assist_condition_missing')
      }
      const before = current
      const applied = applyCurrentAgentResourceAction32({
        flow,
        resource,
        eventKey: event.eventKey,
        current,
        maximum: cap,
      })
      if (applied.status !== 'supported') return failure(`remielle_radiance_${applied.reason}`)
      push(atSeconds, applied.delta, `completed_action:${event.eventKey}`)
      overflow += applied.overflow
      actions.push({
        ...event,
        valueBefore: before,
        valueAfter: current,
        requestedAmount: applied.requestedAmount,
        effectiveDelta: applied.delta,
        overflow: applied.overflow,
        conditionApplied: applied.conditionApplied,
      })
      if (active && active.depletedAtSeconds === null && current === 0)
        active.depletedAtSeconds = atSeconds
    }
    const starting = input.phaseFlowWindows[windowIndex]
    if (starting?.startSeconds === atSeconds) {
      if (current !== cap) return failure('remielle_radiance_phase_entry_requires_full_resource')
      active = { ...starting, startingRadiance: current, depletedAtSeconds: null }
      windows.push(active)
      windowIndex++
    }
    previous = atSeconds
  }
  const resourceContract: ResourceContract = {
    contractId: `declared-remielle-radiance32:${contentHash(input)}`,
    operator: 'resource_state_transition',
    authority: 'source_backed',
    sourceRefs: [...new Set([...source.sourceRefs, ...input.sourceRefs])],
    resourceKey: resource,
    initialValue: input.initialRadiance,
    minimum: 0,
    maximum: cap,
    transitions,
  }
  const checked = executePlanningInteractionContract(resourceContract)
  if (
    checked.status !== 'supported' ||
    checked.operator !== 'resource_state_transition' ||
    !checked.conserved ||
    !Number.isFinite(overflow) ||
    ![checked.endingValue, checked.generated, checked.consumed].every(Number.isFinite)
  )
    return failure('remielle_radiance_generic_resource_check_failed')
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
    overflow,
    conserved: checked.conserved,
    states: checked.states,
    actions,
    phaseFlowWindows: windows,
    resourceContract,
    blockers: [],
    ...limits,
  }
}
