import { canonicalJson, sha256 } from '../application/contentHash'
import parameters from './phoenixDecisionMechanic33.data.json'
import reviewedCrit from '../gameDataPacks/data/reviewed-phoenix-anomaly-crit.3.3.json'
import {
  currentAgentEventContracts,
  evaluateCurrentAgentTeamActivation,
} from './currentAgentMechanicContracts'
import {
  calculatePhoenixAnomalyCrit33,
  type PhoenixAnomalyCritInput,
} from './reviewedPhoenixAnomalyCrit33'
import { calculateAnomalyDamageCore, type AnomalyDamageCoreInput } from './anomalyDamageCore'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'

const ref = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })
export const phoenixDecisionSourceRefs33 = reviewedCrit.sources.flatMap((source) => [
  `${source.url}#sha256=${source.sha256}`,
  ...source.locators.map((locator) => `${source.url}#${locator}`),
])

function effect(
  effectId: string,
  receiver: string,
  value: UpstreamExpressionIR,
  eventOnly: boolean,
) {
  const expressionIr: UpstreamExpressionIR = {
    kind: 'call',
    operator: 'add',
    receiver: ref(receiver),
    arguments: [value],
  }
  return {
    effectId,
    applicationScope: eventOnly ? 'event_only' : 'generic',
    recipients: [eventOnly ? 'team' : 'self'],
    locator: eventOnly
      ? 'reviewed-phoenix-anomaly-crit.3.3.json#parameters; bound anomaly snapshot only'
      : parameters.sourceLocator,
    numericExpression: {
      // The self table is executable source-text IR. Snapshot values instead
      // require the typed consumer below; generic observations cannot certify it.
      classification: eventOnly ? 'declarative_baseline_input' : 'upstream_expression_available',
      operators: eventOnly ? ['add'] : ['add', 'subscript'],
      dependencyKinds: eventOnly ? ['bound_anomaly_snapshot'] : ['character_state', 'literal'],
      genericConditionalIdentifiers: [] as string[],
      todoFlagged: eventOnly,
      todoBoundary: eventOnly ? 'requires_phoenix_decision_bound_anomaly_snapshot33' : null,
      expressionSha256: sha256(canonicalJson(expressionIr)),
      expressionIr,
      expressionIrReady: true,
    },
  }
}

export const phoenixDecisionEffects33 = [
  effect(
    'core_anomProf',
    'ownBuff.combat.anomProf',
    {
      kind: 'call',
      operator: 'subscript',
      arguments: [
        ref('char.core'),
        {
          kind: 'array',
          items: parameters.anomalyProficiencyByCoreLevel.map((value) => ({
            kind: 'literal',
            value,
          })),
        },
      ],
    },
    false,
  ),
  // "team" expresses whose anomaly may qualify. The receiver remains a named
  // anomaly snapshot, never teamBuff crit/damage or a persistent team window.
  effect(
    'scorch_anomaly_crit_rate',
    'anomalySnapshot.anomalyCritRate',
    ref('phoenix.boundSnapshot.critRate'),
    true,
  ),
  effect(
    'scorch_anomaly_crit_damage',
    'anomalySnapshot.anomalyCritDamage',
    ref('phoenix.boundSnapshot.critDamage'),
    true,
  ),
]

export const phoenixDecisionFunctionalInputs33 = phoenixDecisionEffects33.map((entry) => ({
  inputId: entry.effectId,
  kind:
    entry.applicationScope === 'event_only' ? 'bound_anomaly_snapshot' : 'self_anomaly_proficiency',
  locator: entry.locator,
  numericExpression: {
    classification: entry.numericExpression.classification,
    expressionSha256: entry.numericExpression.expressionSha256,
    expressionIr: entry.numericExpression.expressionIr,
    expressionIrReady: true,
    todoFlagged: entry.numericExpression.todoFlagged,
  },
}))

// Reuse the registered activation evaluator, not a parallel faction/role list.
// A singleton seed asserts activation eligibility, not an observed pair/trio,
// recommendation, strength, exhaustive synergy universe or reciprocal benefit.
export const phoenixDecisionSynergy33 = {
  agentId: 'agent-phoenix',
  seeds: currentAgentEventContracts
    .filter((partner) => partner.stableId !== 'agent-phoenix')
    .filter((partner) => {
      const result = evaluateCurrentAgentTeamActivation({
        stableId: 'agent-phoenix',
        memberIds: ['agent-phoenix', partner.stableId],
      })
      return result.status === 'supported' && result.active
    })
    .map((partner) => ({
      seedId: `phoenix-33-static-activation:${partner.stableId}`,
      partnerIds: [partner.stableId],
      system: 'additional_ability_static_activation_only',
      primaryOutputSource: 'bound_anomaly_snapshot_not_team_dps',
      sourceMapIds: [...phoenixDecisionSourceRefs33],
      sourceConfidence: 'registered_static_activation_fact_only',
      applicability: 'current_3_3_activation_only_not_observed_team',
    })),
}

export type PhoenixDecisionSnapshotInput33 = {
  memberIds: readonly string[]
  recipient: {
    kind: 'anomaly_snapshot'
    ownerAgentId: string
    targetId: string
    eventId: string
    atSeconds: number
  }
  crit: PhoenixAnomalyCritInput
}

const unsupported = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })

/** Resolve exactly one named anomaly event using the existing reviewed math. */
export function bindPhoenixDecisionAnomalySnapshot33(input: PhoenixDecisionSnapshotInput33) {
  const { recipient, crit, memberIds } = input
  if (
    memberIds.length !== 3 ||
    new Set(memberIds).size !== 3 ||
    !memberIds.includes('agent-phoenix') ||
    !memberIds.includes(recipient.ownerAgentId)
  )
    return unsupported('phoenix_snapshot_requires_three_unique_known_members_and_recipient')
  if (
    recipient.kind !== 'anomaly_snapshot' ||
    !recipient.ownerAgentId ||
    recipient.targetId !== crit.targetId ||
    recipient.eventId !== crit.eventId ||
    !Number.isFinite(recipient.atSeconds) ||
    recipient.atSeconds < 0
  )
    return unsupported('phoenix_snapshot_recipient_event_binding_mismatch')
  // Require an actual timeline here; a formation-wide same-event boolean cannot
  // prove the timestamp of this recipient's anomaly snapshot.
  if (crit.scorchState.currentAtSeconds !== recipient.atSeconds)
    return unsupported('phoenix_snapshot_requires_matching_event_time')
  if (
    (crit.damageKind === 'phoenix_abloom' && recipient.ownerAgentId !== 'agent-phoenix') ||
    (crit.damageKind === 'other_agent_abloom' && recipient.ownerAgentId === 'agent-phoenix')
  )
    return unsupported('phoenix_snapshot_damage_owner_mismatch')
  const activation = evaluateCurrentAgentTeamActivation({ stableId: 'agent-phoenix', memberIds })
  if (activation.status !== 'supported') return activation
  if (crit.phoenix.additionalAbilityActive !== activation.active)
    return unsupported('phoenix_snapshot_additional_ability_disagrees_with_registered_team')
  const result = calculatePhoenixAnomalyCrit33(crit)
  if (result.status === 'unsupported') return result
  return {
    status: 'supported' as const,
    applicability: result.status,
    recipient: { ...recipient },
    unit: 'ratio' as const,
    anomalyCritRate: result.anomalyCritRate,
    anomalyCritDamage: result.anomalyCritDamage,
    sourceRefs: [...phoenixDecisionSourceRefs33],
    effects: [
      { effectKey: 'agent-phoenix:scorch_anomaly_crit_rate', value: result.anomalyCritRate },
      { effectKey: 'agent-phoenix:scorch_anomaly_crit_damage', value: result.anomalyCritDamage },
    ],
    boundary: 'one_bound_anomaly_snapshot_no_uptime_rotation_or_team_dps' as const,
  }
}

/** Actual ordinary-anomaly consumer; Abloom stays in phoenixEventSnapshot33. */
export function calculatePhoenixDecisionOrdinaryAnomaly33(
  input: PhoenixDecisionSnapshotInput33 & { snapshot: AnomalyDamageCoreInput },
) {
  if (input.crit.damageKind !== 'ordinary_anomaly')
    return unsupported('phoenix_abloom_requires_existing_phoenix_event_snapshot33_consumer')
  if (input.snapshot.anomalyCritRate !== 0 || input.snapshot.anomalyCritDamage !== 0)
    return unsupported('phoenix_snapshot_existing_crit_not_declared_none')
  const binding = bindPhoenixDecisionAnomalySnapshot33(input)
  if (binding.status !== 'supported') return binding
  try {
    return {
      ...binding,
      damage: calculateAnomalyDamageCore({
        ...input.snapshot,
        anomalyCritRate: binding.anomalyCritRate,
        anomalyCritDamage: binding.anomalyCritDamage,
      }),
    }
  } catch (error) {
    return unsupported(`phoenix_snapshot_formula_input_invalid:${String(error)}`)
  }
}
