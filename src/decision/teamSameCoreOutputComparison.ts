import {
  bindDeclaredTeamStrengthSupportInput,
  compareDeclaredTeamStrengthSupportContribution,
  projectDeclaredTeamStrengthSupportContribution,
  type DeclaredTeamStrengthSupportInput,
} from './teamStrengthSupportContribution'
import { sourceCapacityEventPacketIdentity } from './teamStrengthSourceCapacityPolicy'
import { createTeamStrengthCapacityContext } from './teamStrengthSourceCapacityActions'
import { memberFacts } from './teamStrengthMemberFacts'
import { resolveTeamStrengthRecipientContext } from './teamStrengthSourceCapacityPolicy'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getPlanningDamageEventSemantics } from '../calculation/currentPlanningDamageModifiers'
import {
  createStandardPhoenixCanonicalEvent33,
  settlePhoenixCanonicalEvent33,
  phoenixCanonicalPacketIdentity33,
  phoenixCanonicalScenario33,
  phoenixOrdinaryScenario33,
} from './teamPhoenixCanonicalAnomaly33'
import { cachedCommonMemberInvariant } from './teamSameCoreMemberInvariant'
import { bindDeclaredTeamStrengthFiniteEventState } from './teamStrengthDeclaredFiniteEventState'

function finiteOutputSystem(input: DeclaredTeamStrengthSupportInput) {
  const contract = getCurrentAgentEventContract(input.subjectAgentId)
  const families = new Set(
    input.eventUsages.map((usage) => {
      const event = contract?.eventContract.events.find((row) => row.eventId === usage.eventId)
      return event ? getPlanningDamageEventSemantics(event)?.family : undefined
    }),
  )
  if (families.size !== 1) return null
  const family = [...families][0]
  return family === 'direct'
    ? ('direct_damage' as const)
    : family === 'sharp'
      ? ('sharp' as const)
      : family === 'sheer'
        ? ('rupture' as const)
        : null
}

export const teamSameCoreOutputComparisonPolicy = Object.freeze({
  contract: 'soda-team-same-core-output-comparison/v2',
  productionEligible: false,
  scope: 'same-owner-same-declared-event-one-or-two-teammate-replacement',
  settlement: 'shared-source-formulas-with-joint-recipient-bound-effects',
  relativeNumericalTolerance: 1e-9,
  boundary:
    'Priority applies only to the declared finite output packet under the supplied conditions. Two-teammate replacement is allowed only when the same owner keeps the same panel, equipment, cultivation, event packet, target baseline and relevant formula sources. It excludes setup costs, uptime, resource loops, other actors and complete-team DPS. Provider-off deltas explain the joint settlement and are never summed.',
} as const)

export type TeamSameCoreOutputDeclaration = Pick<
  DeclaredTeamStrengthSupportInput,
  'memberIds' | 'subjectAgentId' | 'standardTeamReferenceSelection' | 'eventObservation'
> & {
  referenceConditions: TeamStrengthReferenceConditions
  /** Required source observations, not inferred uptime. Absent keys remain
   * absent in the event runtime and may produce a partial settlement. */
  baselineReferencesByAgentId: NonNullable<
    DeclaredTeamStrengthSupportInput['baselineReferencesByAgentId']
  >
}

/** Build the actual owner's whole finite source packet and equipped reference
 * from existing consumers. No new event, frequency, skill or buff amount is
 * authored here. The default equipment protocol is the existing static panel
 * slice; conditional equipment requires a standard selection with its states. */
export function createTeamSameCoreOutputInput(declaration: TeamSameCoreOutputDeclaration) {
  const { memberIds, subjectAgentId, referenceConditions, standardTeamReferenceSelection } =
    declaration
  const unsupported = (blockers: string[]) => ({ status: 'unsupported' as const, blockers })
  if (new Set(memberIds).size !== 3 || !memberIds.includes(subjectAgentId))
    return unsupported(['same_core_output_requires_exact_trio_and_owner'])
  const members = memberIds.flatMap((id) => {
    const member = memberFacts(id, memberIds, referenceConditions.potentialByAgentId[id])
    return member ? [member] : []
  })
  if (members.length !== 3) return unsupported(['same_core_output_member_source_missing'])
  const explicit = declaration.baselineReferencesByAgentId
  const sourceReferences = referenceConditions.supportReferencesByAgentId ?? {}
  if (
    [...Object.keys(explicit), ...Object.keys(sourceReferences)].some(
      (id) => !memberIds.includes(id),
    ) ||
    memberIds.some((id) =>
      Object.entries(sourceReferences[id] ?? {}).some(
        ([key, value]) =>
          Object.hasOwn(explicit[id] ?? {}, key) &&
          stableContentHash(explicit[id]![key]) !== stableContentHash(value),
      ),
    )
  )
    return unsupported(['same_core_output_source_observations_conflict'])
  if (
    declaration.eventObservation !== undefined &&
    referenceConditions.eventObservation !== undefined &&
    stableContentHash(declaration.eventObservation) !==
      stableContentHash(referenceConditions.eventObservation)
  )
    return unsupported(['same_core_output_event_observation_conflict'])
  const eventState = bindDeclaredTeamStrengthFiniteEventState(
    {
      eventObservation: declaration.eventObservation ?? referenceConditions.eventObservation,
      baselineReferencesByAgentId: Object.fromEntries(
        memberIds.map((id) => [id, { ...sourceReferences[id], ...explicit[id] }]),
      ),
    },
    memberIds,
    currentNormalizedPlanningBaseline.enemy.id,
  )
  if (eventState.status !== 'supported') return eventState
  const references = eventState.references
  const actualObservation = eventState.eventObservation
    ? { eventObservation: eventState.eventObservation }
    : {}
  const conditions = { ...referenceConditions, supportReferencesByAgentId: references }
  if (referenceConditions.phoenixCanonicalEvent33) {
    const input: DeclaredTeamStrengthSupportInput = {
      memberIds,
      subjectAgentId,
      referenceConditions: conditions,
      eventUsages: [],
      baseline: currentNormalizedPlanningBaseline,
      ...actualObservation,
      baselineReferencesByAgentId: references,
      equipmentModifierBuckets: [],
      equipmentEffectExclusions: [],
      ...(standardTeamReferenceSelection ? { standardTeamReferenceSelection } : {}),
    }
    const bound = bindDeclaredTeamStrengthSupportInput(input)
    if (bound.status !== 'ready') return bound
    const declared = referenceConditions.phoenixCanonicalEvent33
    const standard =
      'kind' in declared
        ? { status: 'ready' as const, packet: declared }
        : (declared.scenario === phoenixCanonicalScenario33 &&
              subjectAgentId === 'agent-phoenix') ||
            (declared.scenario === phoenixOrdinaryScenario33 && subjectAgentId !== 'agent-phoenix')
          ? createStandardPhoenixCanonicalEvent33({
              memberIds,
              subjectAgentId,
              members: bound.input.members,
              baseline: input.baseline,
              references,
            })
          : {
              status: 'unsupported' as const,
              blockers: ['phoenix_canonical_scenario_or_subject_mismatch'],
            }
    if (standard.status !== 'ready') return standard
    if (
      standard.packet.binding.recipient.ownerAgentId !== subjectAgentId ||
      stableContentHash([...standard.packet.binding.memberIds].sort()) !==
        stableContentHash([...memberIds].sort())
    )
      return unsupported(['phoenix_canonical_declaration_formation_or_owner_mismatch'])
    input.phoenixCanonicalEvent33 = standard.packet
    return {
      status: 'ready' as const,
      input,
      protocol: 'phoenix-canonical-named-anomaly-event' as const,
      boundary: teamSameCoreOutputComparisonPolicy.boundary,
    }
  }
  const context = createTeamStrengthCapacityContext(
    members,
    conditions,
    standardTeamReferenceSelection,
  )
  if (context.status === 'unsupported')
    return unsupported(context.gaps.flatMap((gap) => gap.fields))
  const eventUsages = context.contactUsages(subjectAgentId)
  if (!eventUsages.length || !sourceCapacityEventPacketIdentity(eventUsages))
    return unsupported(['same_core_output_owner_packet_missing'])
  // Reuse the same context resolver as feature extraction. There is no scalar
  // capability, provider maximum or formation role in the damage declaration.
  const recipientContext = resolveTeamStrengthRecipientContext(memberIds, conditions)
  const input: DeclaredTeamStrengthSupportInput = {
    memberIds,
    subjectAgentId,
    eventUsages,
    baseline: {
      ...currentNormalizedPlanningBaseline,
      enemy: { ...currentNormalizedPlanningBaseline.enemy, stunMultiplier: 1 },
    },
    ...actualObservation,
    referenceConditions: { ...conditions, recipientContext },
    baselineReferencesByAgentId: references,
    equipmentModifierBuckets: [],
    equipmentEffectExclusions: [],
    ...(standardTeamReferenceSelection ? { standardTeamReferenceSelection } : {}),
  }
  return {
    status: 'ready' as const,
    input,
    protocol: 'existing-equipped-reference-finite-source-packet' as const,
    boundary: teamSameCoreOutputComparisonPolicy.boundary,
  }
}

/** Preserve the declaration beside the settlement: a value or marginal alone
 * cannot prove common target, equipment, recipient or co-active conditions. */
export function projectTeamSameCoreOutput(input: DeclaredTeamStrengthSupportInput) {
  const declaration = structuredClone(input)
  const packet = declaration.phoenixCanonicalEvent33
  const prepared = bindDeclaredTeamStrengthSupportInput(declaration)
  let packetResult = packet ? settlePhoenixCanonicalEvent33(packet) : null
  if (
    packet &&
    [phoenixCanonicalScenario33, phoenixOrdinaryScenario33].some(
      (scenario) => scenario === packet.scenario,
    ) &&
    prepared.status === 'ready'
  ) {
    const rebuilt = createStandardPhoenixCanonicalEvent33({
      memberIds: declaration.memberIds,
      subjectAgentId: declaration.subjectAgentId,
      members: prepared.input.members,
      baseline: declaration.baseline,
      references: declaration.baselineReferencesByAgentId ?? {},
    })
    if (
      rebuilt.status !== 'ready' ||
      stableContentHash(rebuilt.packet) !== stableContentHash(packet)
    )
      packetResult = {
        status: 'unsupported',
        blockers: ['phoenix_standard_snapshot_does_not_match_bound_source_inputs'],
      }
  }
  return {
    input: declaration,
    prepared,
    eventPacketIdentity: packet
      ? phoenixCanonicalPacketIdentity33(packet)
      : sourceCapacityEventPacketIdentity(declaration.eventUsages),
    outputSystem: packet ? ('attribute_anomaly' as const) : finiteOutputSystem(declaration),
    result: packetResult ?? projectDeclaredTeamStrengthSupportContribution(declaration),
  }
}

export type TeamSameCoreOutputEvidence = ReturnType<typeof projectTeamSameCoreOutput>

/** Detached immutable comparison snapshot. No build, bibliography, event graph,
 * equipment objects or mutable runtime cache crosses a producer batch. */
export type TeamSameCoreRankingSnapshot = {
  input: { memberIds: readonly string[]; subjectAgentId: string }
  eventPacketIdentity: string | null
  outputSystem: TeamSameCoreOutputEvidence['outputSystem']
  result: { status: 'supported' | 'partial' | 'unsupported'; fixedEventValue: number | null }
  preparedReady: boolean
  phoenixPacketIdentity: string | null
  declarationIdentity: string | null
  commonInvariants: Readonly<Record<string, string>>
}

export function snapshotTeamSameCoreRanking(
  evidence: TeamSameCoreOutputEvidence,
): TeamSameCoreRankingSnapshot {
  const commonInvariants: Record<string, string> = {}
  const ready = evidence.prepared.status === 'ready'
  if (ready && evidence.result.status === 'supported') {
    const owner = evidence.input.subjectAgentId
    for (const common of [
      [owner],
      ...evidence.input.memberIds.filter((id) => id !== owner).map((id) => [owner, id]),
    ])
      commonInvariants[[...common].sort().join('|')] = cachedCommonMemberInvariant(evidence, common)
  }
  const phoenix = evidence.input.phoenixCanonicalEvent33
  return {
    input: {
      memberIds: [...evidence.input.memberIds],
      subjectAgentId: evidence.input.subjectAgentId,
    },
    eventPacketIdentity: evidence.eventPacketIdentity,
    outputSystem: evidence.outputSystem,
    result: {
      status: evidence.result.status,
      fixedEventValue:
        evidence.result.status === 'unsupported' ? null : evidence.result.fixedEventValue,
    },
    preparedReady: ready,
    phoenixPacketIdentity: phoenix ? phoenixCanonicalPacketIdentity33(phoenix) : null,
    declarationIdentity: phoenix ? stableContentHash(evidence.input) : null,
    commonInvariants,
  }
}

export function compareTeamSameCoreRankingSnapshots(
  left: TeamSameCoreRankingSnapshot,
  right: TeamSameCoreRankingSnapshot,
): 'left' | 'right' | 'tie' | 'incomparable' {
  if (
    left.result.status !== 'supported' ||
    right.result.status !== 'supported' ||
    left.input.subjectAgentId !== right.input.subjectAgentId ||
    left.phoenixPacketIdentity !== right.phoenixPacketIdentity
  )
    return 'incomparable'
  const common = left.input.memberIds.filter((id) => right.input.memberIds.includes(id))
  if ([1, 2].includes(common.length) && common.includes(left.input.subjectAgentId)) {
    const key = common.sort().join('|')
    if (
      !left.preparedReady ||
      !right.preparedReady ||
      !left.commonInvariants[key] ||
      left.commonInvariants[key] !== right.commonInvariants[key]
    )
      return 'incomparable'
  } else if (
    !(left.phoenixPacketIdentity && left.declarationIdentity === right.declarationIdentity)
  )
    return 'incomparable'
  const a = left.result.fixedEventValue!
  const b = right.result.fixedEventValue!
  const delta = a - b
  return Math.abs(delta) <=
    Math.max(1, a, b) * teamSameCoreOutputComparisonPolicy.relativeNumericalTolerance
    ? 'tie'
    : delta > 0
      ? 'left'
      : 'right'
}

function compareSameOwnerReplacement(
  leftEvidence: TeamSameCoreOutputEvidence,
  rightEvidence: TeamSameCoreOutputEvidence,
) {
  const left = leftEvidence.input
  const right = rightEvidence.input
  if (left.phoenixCanonicalEvent33 || right.phoenixCanonicalEvent33) {
    if (
      !left.phoenixCanonicalEvent33 ||
      !right.phoenixCanonicalEvent33 ||
      phoenixCanonicalPacketIdentity33(left.phoenixCanonicalEvent33) !==
        phoenixCanonicalPacketIdentity33(right.phoenixCanonicalEvent33)
    )
      return { status: 'unsupported' as const, blockers: ['phoenix_canonical_packet_mismatch'] }
  }
  const common = left.memberIds.filter((id) => right.memberIds.includes(id))
  if (
    ![1, 2].includes(common.length) ||
    !common.includes(left.subjectAgentId) ||
    left.subjectAgentId !== right.subjectAgentId
  )
    return null
  const a = leftEvidence.prepared
  const b = rightEvidence.prepared
  if (a.status === 'unsupported' || b.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [
        ...(a.status === 'unsupported' ? a.blockers : []),
        ...(b.status === 'unsupported' ? b.blockers : []),
      ],
    }
  if (
    cachedCommonMemberInvariant(leftEvidence, common) !==
    cachedCommonMemberInvariant(rightEvidence, common)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['同主输出换人须保持所有共同成员的面板、装备、培养、事件、目标及公式来源一致。'],
    }
  const leftResult = leftEvidence.result
  const rightResult = rightEvidence.result
  if (leftResult.status === 'unsupported' || rightResult.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [
        ...(leftResult.status === 'unsupported' ? leftResult.blockers : []),
        ...(rightResult.status === 'unsupported' ? rightResult.blockers : []),
      ],
    }
  return {
    status:
      leftResult.status === 'partial' || rightResult.status === 'partial'
        ? ('partial' as const)
        : ('supported' as const),
    seam:
      common.length === 1
        ? ('same-owner-two-teammate-replacement' as const)
        : ('same-owner-one-teammate-replacement' as const),
    left: leftResult,
    right: rightResult,
    fixedEventDelta: rightResult.fixedEventValue - leftResult.fixedEventValue,
    identity: stableContentHash({ left: leftResult.identity, right: rightResult.identity }),
    changes: {
      removed: left.memberIds.filter((id) => !common.includes(id)),
      added: right.memberIds.filter((id) => !common.includes(id)),
    },
    numericalStrengthAdjudication: false as const,
  }
}

/** This reuses the shared finite-event formula while replacing team-bibliography
 * hashes with member-specific panel, equipment, cultivation, event and formula
 * invariants. One or two common members are supported. Partial settlements are
 * diagnostic, never zero. */
export function compareTeamSameCoreOutput(
  left: TeamSameCoreOutputEvidence,
  right: TeamSameCoreOutputEvidence,
) {
  const comparison =
    compareSameOwnerReplacement(left, right) ??
    (left.input.phoenixCanonicalEvent33 || right.input.phoenixCanonicalEvent33
      ? stableContentHash(left.input) === stableContentHash(right.input) &&
        left.result.status !== 'unsupported' &&
        right.result.status !== 'unsupported'
        ? {
            status:
              left.result.status === 'partial' || right.result.status === 'partial'
                ? ('partial' as const)
                : ('supported' as const),
            left: left.result,
            right: right.result,
            fixedEventDelta: right.result.fixedEventValue - left.result.fixedEventValue,
            identity: stableContentHash({
              left: left.result.identity,
              right: right.result.identity,
            }),
            changes: { removed: [] as string[], added: [] as string[] },
            numericalStrengthAdjudication: false as const,
          }
        : {
            status: 'unsupported' as const,
            blockers: ['phoenix_canonical_common_inputs_not_invariant'],
          }
      : compareDeclaredTeamStrengthSupportContribution(left.input, right.input))
  const common = {
    contract: teamSameCoreOutputComparisonPolicy.contract,
    boundary: teamSameCoreOutputComparisonPolicy.boundary,
    numericalStrengthAdjudication: false as const,
    comparison,
  }
  if (comparison.status !== 'supported')
    return {
      ...common,
      status: comparison.status,
      relation: 'incomparable' as const,
      fixedEventDelta: null,
    }
  const difference = comparison.left.fixedEventValue - comparison.right.fixedEventValue
  const scale = Math.max(1, comparison.left.fixedEventValue, comparison.right.fixedEventValue)
  return {
    ...common,
    status: 'supported' as const,
    relation:
      Math.abs(difference) <= scale * teamSameCoreOutputComparisonPolicy.relativeNumericalTolerance
        ? ('tie' as const)
        : difference > 0
          ? ('left' as const)
          : ('right' as const),
    // Positive means left; the underlying comparison exposes right-minus-left.
    fixedEventDelta: difference,
  }
}
