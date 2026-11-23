import {
  projectCurrentPlanningConditionCatalog32,
  resolveCurrentPlanningConditionDeclarations32,
  type PlanningConditionProjection32,
} from '../calculation/currentPlanningConditionCatalog32'
import {
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from '../calculation/currentAgentPlanningEffectBlueprint'
import { recipientIds } from '../calculation/currentPlanningDamageModifiers'
import { requiredReferences } from '../calculation/currentPlanningEffectExpressions'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import {
  phoenixCanonicalScenario33,
  phoenixOrdinaryScenario33,
} from './teamPhoenixCanonicalAnomaly33'
import {
  currentTeamStrengthReferenceConditions,
  teamStrengthReferenceConditionsIdentity,
} from './teamStrengthReferenceConditions'
import type {
  ResolvedTeamStrengthReferenceConditions,
  TeamStrengthReferenceConditions,
} from './teamStrengthReferenceConditionsTypes'
import {
  comparisonSourceRefs,
  conditionSpecs,
  upstreamConditionKeys,
  phoenixWindowSpecs,
  veilProviderIds,
  blueprintSourceRefs,
} from './teamStrengthStandardConditionSpecs'
import type { ConditionBindingSpec } from './teamStrengthStandardConditionSpecs'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import {
  bindDeclaredTeamStrengthFiniteEventState,
  type DeclaredTeamStrengthFiniteEventState,
} from './teamStrengthDeclaredFiniteEventState'

export const teamStrengthStandardFiniteEventConditionsContract =
  'soda-team-strength-standard-finite-event-conditions/v1' as const
export const teamStrengthStandardFiniteEventConditionsScenario =
  'declared-single-event-source-window' as const

export type TeamStrengthStandardConditionBinding = ConditionBindingSpec & {
  recipientAgentIds: readonly string[]
  eventIds: readonly string[]
  valueKind: 'boolean' | 'number'
  minimum?: number
  maximum?: number
  integerOnly: boolean
  sourceRefs: readonly string[]
}

export type TeamStrengthStandardFiniteEventConditionsResult =
  | {
      status: 'supported'
      contract: typeof teamStrengthStandardFiniteEventConditionsContract
      scenario: typeof teamStrengthStandardFiniteEventConditionsScenario
      memberIds: readonly [string, string, string]
      subjectAgentId: string
      referenceConditions: ResolvedTeamStrengthReferenceConditions &
        Pick<
          TeamStrengthReferenceConditions,
          'conditionBindingIdentity' | 'conditionBindingBoundary' | 'conditionBindingScenario'
        >
      bindings: readonly TeamStrengthStandardConditionBinding[]
      unboundConditionalReferences: Readonly<Record<string, readonly string[]>>
      sourceIdentity: {
        referenceConditions: string
        referenceConditionInstance: string
        planningConditions: PlanningConditionProjection32['sourceIdentity']
        scenario: string
      }
      observationLayer: {
        status: ResolvedTeamStrengthReferenceConditions['status']
        sourceAuthority: ResolvedTeamStrengthReferenceConditions['sourceAuthority']
        evidenceRefs: readonly string[]
      }
      boundary: string
      identity: string
    }
  | {
      status: 'unsupported'
      contract: typeof teamStrengthStandardFiniteEventConditionsContract
      scenario: typeof teamStrengthStandardFiniteEventConditionsScenario
      blockers: readonly string[]
      boundary: string
    }

function resolvedRecipients(
  entry: CurrentAgentPlanningEffectBlueprint,
  memberIds: readonly string[],
) {
  return recipientIds({
    ...entry,
    memberIds,
  })
}

function mergeBindingSourceRefs(
  spec: ConditionBindingSpec,
  catalogSourceRefs: readonly string[],
  valueKind: 'boolean' | 'number',
  minimum: number | undefined,
  maximum: number | undefined,
  integerOnly: boolean,
  memberIds: readonly string[],
) {
  const entries = currentAgentPlanningEffectBlueprints.filter(
    (entry) =>
      entry.providerAgentId === spec.providerAgentId &&
      spec.effectIds.some((effectId) => effectId === entry.effectKey) &&
      requiredReferences(entry.numericExpression.expressionIr).includes(spec.referenceKey),
  )
  const recipients = new Set<string>()
  for (const entry of entries)
    for (const recipient of resolvedRecipients(entry, memberIds)) recipients.add(recipient)
  const eventIds = new Set(
    entries.flatMap(
      (entry) =>
        getCurrentAgentEventContract(spec.providerAgentId)
          ?.eventContract.events.filter((event) =>
            event.eventModifierRefs.includes(entry.effectKey),
          )
          .map((event) => event.eventId) ?? [],
    ),
  )
  return {
    ...spec,
    recipientAgentIds:
      recipients.size > 0
        ? [...recipients].sort()
        : spec.recipientAgentIds.includes('team')
          ? [...memberIds].sort()
          : spec.recipientAgentIds.includes('enemy')
            ? ['enemy:selected-target']
            : [spec.providerAgentId],
    eventIds: [...eventIds].sort(),
    valueKind,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
    integerOnly,
    sourceRefs: [
      ...new Set([
        ...spec.sourceRefs,
        ...blueprintSourceRefs(spec.providerAgentId, spec.referenceKey),
        ...catalogSourceRefs,
      ]),
    ].sort(),
  }
}

function veilBinding(providerAgentId: 'agent-sunna' | 'agent-zhao', subjectAgentId: string) {
  const sourceRefs =
    providerAgentId === 'agent-zhao'
      ? [
          'reviewed-external-support-target31:628b4949def6a5f64b44b3f8a8f46b43b9d89946ef4761bcf9bc38721e841361#passive.level.1341507.desc[1]',
          'https://www.prydwen.gg/zenless/characters/zhao#additional-ability-crystallization',
          ...comparisonSourceRefs,
        ]
      : [
          ...blueprintSourceRefs('agent-sunna', 'sunnaAngelicChordination32'),
          'https://www.prydwen.gg/zenless/characters/sunna',
          ...comparisonSourceRefs,
        ]
  return {
    providerAgentId,
    recipientAgentIds: [subjectAgentId],
    referenceKey: 'inside_any_ether_veil',
    value: true,
    effectIds:
      providerAgentId === 'agent-zhao'
        ? ['reviewed_initial_hp_additional_damage32']
        : ['agent-sunna:reviewed_angelic_chord_attack32'],
    sourceRefs: [...new Set(sourceRefs)].sort(),
    owner: 'reviewed_recipient_window',
    valueKind: 'boolean',
    integerOnly: false,
    eventIds: [],
  } satisfies TeamStrengthStandardConditionBinding
}

export function createTeamStrengthStandardFiniteEventConditions(
  input: {
    memberIds: readonly [string, string, string]
    subjectAgentId: string
  } & DeclaredTeamStrengthFiniteEventState,
): TeamStrengthStandardFiniteEventConditionsResult {
  const boundary =
    'Opt-in declared single-event source-window comparison. Each counted event is evaluated once while the named source condition is declared active; this is not observed uptime, trigger frequency, resource legality, a rotation, complete-team output or DPS. Unknown source observations remain unknown and are not filled from maxima.'
  if (
    new Set(input.memberIds).size !== 3 ||
    !input.memberIds.includes(input.subjectAgentId) ||
    input.memberIds.some((id) => !getCurrentAgentEventContract(id))
  )
    return {
      status: 'unsupported',
      contract: teamStrengthStandardFiniteEventConditionsContract,
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      blockers: ['standard_finite_event_requires_current_exact_trio_and_subject'],
      boundary,
    }

  const base = currentTeamStrengthReferenceConditions(input.memberIds)
  const eventState = bindDeclaredTeamStrengthFiniteEventState(
    input,
    input.memberIds,
    currentNormalizedPlanningBaseline.enemy.id,
  )
  if (eventState.status !== 'supported')
    return {
      status: 'unsupported',
      contract: teamStrengthStandardFiniteEventConditionsContract,
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      blockers: eventState.blockers,
      boundary,
    }
  const projection = projectCurrentPlanningConditionCatalog32({
    subjectAgentId: input.subjectAgentId,
    memberIds: input.memberIds,
  })
  if (projection.status !== 'supported' || projection.blockers.length)
    return {
      status: 'unsupported',
      contract: teamStrengthStandardFiniteEventConditionsContract,
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      blockers: projection.blockers.length
        ? projection.blockers
        : ['standard_finite_event_condition_catalog_unsupported'],
      boundary,
    }

  const phoenixAnomalyWindow =
    input.memberIds.includes('agent-phoenix') &&
    getCurrentAgentEventContract(input.subjectAgentId)?.identity.specialty === 'anomaly'
  const selectedSpecs: ConditionBindingSpec[] = [
    ...conditionSpecs,
    ...(phoenixAnomalyWindow ? phoenixWindowSpecs : []),
  ].filter((spec) => input.memberIds.includes(spec.providerAgentId))
  const upstreamDeclarations = selectedSpecs
    .filter((spec) => upstreamConditionKeys.has(spec.referenceKey))
    .map((spec) => ({
      providerAgentId: spec.providerAgentId,
      referenceKey: spec.referenceKey,
      value: spec.value,
    }))
  const upstreamResolution = resolveCurrentPlanningConditionDeclarations32({
    projection,
    declarations: upstreamDeclarations,
  })
  if (upstreamResolution.status !== 'supported')
    return {
      status: 'unsupported',
      contract: teamStrengthStandardFiniteEventConditionsContract,
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      blockers: upstreamResolution.blockers,
      boundary,
    }

  const blockers: string[] = []
  for (const [agentId, references] of Object.entries(eventState.references))
    for (const [key, value] of Object.entries(references)) {
      const existing = base.supportReferencesByAgentId?.[agentId]?.[key]
      if (existing !== undefined && stableContentHash(existing) !== stableContentHash(value))
        blockers.push(`standard_finite_event_existing_observation_conflict:${agentId}:${key}`)
    }
  const bindings: TeamStrengthStandardConditionBinding[] = selectedSpecs.map((spec) => {
    const evidence = projection.evidence.find(
      (row) =>
        row.providerAgentId === spec.providerAgentId && row.referenceKey === spec.referenceKey,
    )
    const definition = projection.defs.find(
      (row) =>
        row.providerAgentId === spec.providerAgentId && row.referenceKey === spec.referenceKey,
    )
    const declared = upstreamResolution.values.find(
      (row) =>
        row.providerAgentId === spec.providerAgentId && row.referenceKey === spec.referenceKey,
    )
    const hasBlueprintSource =
      blueprintSourceRefs(spec.providerAgentId, spec.referenceKey).length > 0
    if (
      upstreamConditionKeys.has(spec.referenceKey) &&
      (!evidence || declared?.value === undefined)
    )
      blockers.push(
        `standard_finite_event_upstream_condition_unbound:${spec.providerAgentId}:${spec.referenceKey}`,
      )
    if (!upstreamConditionKeys.has(spec.referenceKey) && !hasBlueprintSource)
      blockers.push(
        `standard_finite_event_reviewed_condition_unbound:${spec.providerAgentId}:${spec.referenceKey}`,
      )
    return mergeBindingSourceRefs(
      spec,
      evidence?.sourceRefs ?? [],
      definition?.valueKind === 'number'
        ? 'number'
        : definition?.valueKind === 'boolean'
          ? 'boolean'
          : typeof spec.value === 'boolean'
            ? 'boolean'
            : 'number',
      definition?.minimum,
      definition?.maximum,
      evidence?.integerOnly ?? false,
      input.memberIds,
    )
  })

  const veilProviderAgentId = input.memberIds.find((id) => veilProviderIds.has(id))
  if (
    input.subjectAgentId === 'agent-ye-shunguang' &&
    input.memberIds.includes('agent-ye-shunguang') &&
    veilProviderAgentId
  )
    bindings.push(
      veilBinding(veilProviderAgentId as 'agent-sunna' | 'agent-zhao', input.subjectAgentId),
    )

  const byAgent = Object.fromEntries(
    input.memberIds.map((id) => [id, {} as Record<string, boolean | number>]),
  )
  for (const binding of bindings) {
    const recipientAgentId =
      binding.referenceKey === 'inside_any_ether_veil'
        ? input.subjectAgentId
        : binding.providerAgentId
    if (!Object.hasOwn(byAgent, recipientAgentId)) {
      blockers.push(
        `standard_finite_event_binding_owner_outside_trio:${recipientAgentId}:${binding.referenceKey}`,
      )
      continue
    }
    const existing = base.supportReferencesByAgentId?.[recipientAgentId]?.[binding.referenceKey]
    const declared = eventState.references[recipientAgentId]?.[binding.referenceKey]
    if (
      [existing, declared].some(
        (value) =>
          value !== undefined && stableContentHash(value) !== stableContentHash(binding.value),
      )
    )
      blockers.push(
        `standard_finite_event_existing_observation_conflict:${recipientAgentId}:${binding.referenceKey}`,
      )
    byAgent[recipientAgentId]![binding.referenceKey] = binding.value
  }

  const knownConditionReferences = new Map<string, Set<string>>(
    input.memberIds.map((id) => [id, new Set<string>()]),
  )
  for (const definition of projection.defs)
    knownConditionReferences.get(definition.providerAgentId)?.add(definition.referenceKey)
  for (const blocked of projection.blockedReferences)
    if (!blocked.referenceKey.includes('.') && !blocked.referenceKey.includes('/'))
      knownConditionReferences.get(blocked.providerAgentId)?.add(blocked.referenceKey)
  const unboundConditionalReferences = Object.fromEntries(
    [...knownConditionReferences].map(([agentId, references]) => [
      agentId,
      [...references]
        .filter(
          (referenceKey) =>
            !Object.hasOwn(byAgent[agentId] ?? {}, referenceKey) &&
            !Object.hasOwn(eventState.references[agentId] ?? {}, referenceKey),
        )
        .sort(),
    ]),
  )

  if (blockers.length)
    return {
      status: 'unsupported',
      contract: teamStrengthStandardFiniteEventConditionsContract,
      scenario: teamStrengthStandardFiniteEventConditionsScenario,
      blockers: [...new Set(blockers)],
      boundary,
    }

  const supportReferencesByAgentId = Object.fromEntries(
    input.memberIds.map((agentId) => [
      agentId,
      {
        ...(base.supportReferencesByAgentId?.[agentId] ?? {}),
        ...(eventState.references[agentId] ?? {}),
        ...(byAgent[agentId] ?? {}),
      },
    ]),
  )
  const scenarioSourceRefs = bindings.flatMap((binding) => binding.sourceRefs).sort()
  const phoenixScenario =
    input.memberIds.includes('agent-phoenix') &&
    getCurrentAgentEventContract(input.subjectAgentId)?.identity.specialty === 'anomaly'
      ? input.subjectAgentId === 'agent-phoenix'
        ? phoenixCanonicalScenario33
        : phoenixOrdinaryScenario33
      : null
  const identity = stableContentHash({
    contract: teamStrengthStandardFiniteEventConditionsContract,
    scenario: teamStrengthStandardFiniteEventConditionsScenario,
    referenceConditions: base.identity,
    phoenixScenario,
    ...(input.eventObservation !== undefined || input.baselineReferencesByAgentId !== undefined
      ? { declaredEventState: eventState }
      : {}),
    referenceAuthority: base.sourceAuthority,
    referenceStatus: base.status,
    planningConditions: projection.sourceIdentity,
    bindings: bindings.map((binding) => ({
      providerAgentId: binding.providerAgentId,
      recipientAgentIds: binding.recipientAgentIds,
      referenceKey: binding.referenceKey,
      value: binding.value,
      valueKind: binding.valueKind,
      minimum: binding.minimum ?? null,
      maximum: binding.maximum ?? null,
      integerOnly: binding.integerOnly,
      owner: binding.owner,
      effectIds: binding.effectIds,
      eventIds: binding.eventIds,
      sourceRefs: binding.sourceRefs,
    })),
    unboundConditionalReferences,
    boundary,
  })
  const referenceConditions = {
    ...base,
    ...(eventState.eventObservation ? { eventObservation: eventState.eventObservation } : {}),
    ...(phoenixScenario ? { phoenixCanonicalEvent33: { scenario: phoenixScenario } } : {}),
    evidenceRefs: [...new Set([...base.evidenceRefs, ...scenarioSourceRefs])].sort(),
    supportReferencesByAgentId,
    conditionBindingIdentity: identity,
    conditionBindingBoundary: boundary,
    conditionBindingScenario: teamStrengthStandardFiniteEventConditionsScenario,
  }
  return {
    status: 'supported',
    contract: teamStrengthStandardFiniteEventConditionsContract,
    scenario: teamStrengthStandardFiniteEventConditionsScenario,
    memberIds: input.memberIds,
    subjectAgentId: input.subjectAgentId,
    referenceConditions,
    bindings,
    unboundConditionalReferences,
    sourceIdentity: {
      referenceConditions: teamStrengthReferenceConditionsIdentity,
      referenceConditionInstance: base.identity,
      planningConditions: projection.sourceIdentity,
      scenario: stableContentHash({
        contract: teamStrengthStandardFiniteEventConditionsContract,
        scenario: teamStrengthStandardFiniteEventConditionsScenario,
        phoenixScenario,
      }),
    },
    observationLayer: {
      status: base.status,
      sourceAuthority: base.sourceAuthority,
      evidenceRefs: base.evidenceRefs,
    },
    boundary,
    identity,
  }
}
