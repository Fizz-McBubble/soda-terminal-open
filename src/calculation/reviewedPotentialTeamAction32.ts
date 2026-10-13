import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import {
  bindReviewedPotentialApplications,
  type PotentialApplicationEvent,
  type PotentialApplicationBinding,
} from './potentialApplicationBinding'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'

/** Team potential is evaluated from its provider, with recipient event/target evidence. */
export function bindReviewedPotentialTeamAction32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  recipientAgentId: string
  eventId: string
  aftershock: boolean | null
  observation?: PotentialApplicationEvent
}): { buckets: SourceBackedPlanningEffectBucket[]; applications: PotentialApplicationBinding[] } {
  const provider = input.members.find((member) => member.agentId === 'agent-soldier-0-anby')
  if (!provider || !input.members.some((member) => member.agentId === input.recipientAgentId))
    return { buckets: [], applications: [] }
  const observed = input.observation?.eventId === input.eventId ? input.observation : undefined
  const recipientSource = getCurrentAgentEventContract(input.recipientAgentId)?.source
  const applications = [
    ...bindReviewedPotentialApplications({
      member: {
        agentId: provider.agentId,
        potential: provider.potential,
        initialStats: provider.initialStats,
        provenance: 'calculation_context',
      },
      event: {
        eventId: input.eventId,
        actionFamilies: input.aftershock === true ? ['aftershock'] : [],
        providerStateKeys: [],
        targetStateKeys: observed?.targetStateKeys ?? [],
        sourceRefs:
          observed?.sourceRefs.length && recipientSource
            ? [
                ...observed.sourceRefs,
                `${recipientSource.formulaPath}#sha256:${recipientSource.formulaSha256}#event:${input.eventId}`,
              ]
            : [],
      },
    }),
  ].filter((effect) => effect.bucket === 'team_action_damage')
  const buckets = applications
    .filter((effect) => effect.status === 'applied')
    .map(
      (effect): SourceBackedPlanningEffectBucket => ({
        bucketId: `${effect.effectKey}:recipient:${input.recipientAgentId}:event:${input.eventId}`,
        effectKey: effect.effectKey,
        effectId: effect.effectId,
        providerAgentId: provider.agentId,
        recipientAgentIds: [input.recipientAgentId],
        receiverPath: 'teamBuff.combat.dmg_',
        applicationScope: 'generic',
        action: null,
        attribute: null,
        damageType: null,
        application: 'damage_bonus',
        value: effect.value,
        sourceRefs: [...effect.sourceRefs],
      }),
    )
  return { buckets, applications }
}
