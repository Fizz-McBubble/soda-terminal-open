import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import {
  resolveRetentionActionFact,
  type RetentionActionTag,
} from './absoluteDiscRetentionActionFacts'
import type {
  RetentionUtilityEvidence,
  RetentionUtilityState,
} from './absoluteDiscRetentionUseFacts'

export function resolveActionUtility(
  action: RetentionActionTag,
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  eventContract: CurrentAgentEventContract | null,
  evidenceIds: string[],
): RetentionUtilityEvidence {
  const fact = resolveRetentionActionFact(
    action,
    resolveCurrentReleasedIdentity(agentId),
    constraint,
    eventContract,
  )
  const ev = (
    state: RetentionUtilityState,
    predicateId: string,
    detail: string,
  ): RetentionUtilityEvidence => ({
    state,
    predicateId,
    evidenceIds: [...new Set([...evidenceIds, ...fact.sourceIds])],
    detail,
  })
  if (constraint.status === 'missing' || !constraint.sources.some((source) => source.verified))
    return ev(
      'missing_fact',
      'missing_build_source',
      `Verified action build source facts missing for ${agentId}.`,
    )
  if (fact.presence === 'unresolved')
    return ev(
      'missing_fact',
      `${action}_actor_action_contract_missing`,
      `Missing reviewed self ${action} classification; guide text and teammate descriptions cannot prove this action.`,
    )
  if (fact.presence === 'absent')
    return ev(
      'incompatible',
      `no_${action}_mechanic_in_kit`,
      `Reviewed source kit classifies no self ${action} damage events; this is a source-bound negative fact.`,
    )
  if (fact.currentBuildBenefit === 'primary' && fact.condition?.binding === 'reviewed_build')
    return ev(
      'valid',
      action === 'aftershock'
        ? 'aftershock_primary_damage_focus'
        : `${action}_attack_primary_damage`,
      `Reviewed Candidate build uses self ${action} damage under ${fact.condition.predicateId}; not a Formal damage claim.`,
    )
  if (action === 'aftershock')
    return ev(
      'conditional',
      'aftershock_current_build_benefit_unverified',
      'Source-classified self aftershock events exist; verify their activation and benefit in this build before claiming a primary damage use.',
    )
  return ev(
    'incidental',
    `generic_${action === 'basic' ? 'basic_attack' : 'dash_attack'}_action`,
    `Generic self ${action} inputs exist, but no source-bound primary damage focus is established for this build.`,
  )
}
