import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import type {
  RetentionUtilityEvidence,
  RetentionUtilityState,
} from './absoluteDiscRetentionUseFacts'
export function resolveActionUtility(
  action: 'basic' | 'dash' | 'aftershock',
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  eventContract: ReturnType<typeof getCurrentAgentEventContract>,
  evidenceIds: string[],
): RetentionUtilityEvidence {
  const ev = (
    state: RetentionUtilityState,
    predicateId: string,
    detail: string,
  ): RetentionUtilityEvidence => ({
    state,
    predicateId,
    evidenceIds,
    detail,
  })

  if (constraint.status === 'missing' || constraint.sources.length === 0) {
    return ev(
      'missing_fact',
      'missing_build_source',
      `Verified action build source facts missing for ${agentId}.`,
    )
  }

  const setIds = [
    ...(constraint.setIds ?? []),
    ...(constraint.setPlans ?? []).flatMap((p) => [...p.primarySetIds, ...p.secondarySetIds]),
  ]
  const progText = (constraint.progressionDirection ?? []).join(' ')
  const teamText = (constraint.teamAndBangbooPreconditions ?? []).join(' ')
  const released = resolveCurrentReleasedIdentity(agentId)

  if (action === 'aftershock') {
    const hasAftershock =
      released === 'agent-soldier-0-anby' ||
      released === 'agent-orphie-magus' ||
      released === 'agent-trigger' ||
      released === 'agent-seed' ||
      /aftershock|追加/i.test(progText) ||
      /aftershock|追加/i.test(teamText) ||
      (eventContract?.eventContract?.events?.some(
        (e) => /aftershock|abloom/i.test(e.actionId) || /aftershock/i.test(e.skill),
      ) ??
        false)

    if (!hasAftershock) {
      return ev(
        'incompatible',
        'no_aftershock_mechanic_in_kit',
        'Agent possesses no aftershock abilities or damage channels; aftershock bonuses provide zero benefit.',
      )
    }
    if (setIds.includes('set-shadow-harmony') || /aftershock/i.test(progText)) {
      return ev(
        'valid',
        'aftershock_primary_damage_focus',
        'Recommended set Shadow Harmony and reviewed rotation confirm aftershock as primary damage source.',
      )
    }
    return ev(
      'conditional',
      'aftershock_conditional_activation',
      'Agent possesses aftershock mechanics, active under team coordination or specific rotation window.',
    )
  }

  if (action === 'basic') {
    const usesDawnsBloom = setIds.includes('set-dawns-bloom')
    const knownBasic = ['agent-ellen', 'agent-soldier-11', 'agent-zhu-yuan', 'agent-billy']
    if (usesDawnsBloom || knownBasic.includes(released) || /普攻|basic attack/i.test(progText)) {
      return ev(
        'valid',
        'basic_attack_primary_damage',
        'Adopted build directions or primary rotation confirm basic attack as core damage channel.',
      )
    }
    return ev(
      'incidental',
      'generic_basic_attack_action',
      'Agent possesses basic attack inputs, but generic button existence is not primary damage use.',
    )
  }

  if (action === 'dash') {
    const usesShadowHarmony = setIds.includes('set-shadow-harmony')
    const knownDash = ['agent-harumasa', 'agent-nekomata']
    if (
      (usesShadowHarmony && knownDash.includes(released)) ||
      /强化冲刺|dash attack/i.test(progText)
    ) {
      return ev(
        'valid',
        'dash_attack_primary_damage',
        'Adopted build directions and enhanced dash mechanics confirm dash attack as core damage channel.',
      )
    }
    return ev(
      'incidental',
      'generic_dash_attack_action',
      'Agent possesses dash attack inputs, but dash attack is not primary damage focus.',
    )
  }

  return ev(
    'incidental',
    'generic_action_utility',
    'Action utility is incidental to primary rotation.',
  )
}
