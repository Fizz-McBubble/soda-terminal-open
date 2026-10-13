import { getReviewedPotentialDefinition } from '../gameDataPacks/reviewedPotentialDefinitions'
import { stableContentHash } from '../gameDataPacks/types'
import { actualPlanningPotentialActionFamilies32 } from './currentPotentialEventActions32'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'

/** A comparison preparation, never an observation of the player's current combat.
 * Reuse the locked source events and state names. Timers, off-field actions and
 * new resource routes require their own action model and are not invented here. */
export function prepareReviewedPotentialEvents32(input: {
  member: PlanningEffectRuntimeMember
  eventUsages: readonly PlanningEventUsage[]
  /** Real selected squad identities; the actor alone cannot activate Fields of Fire. */
  memberIds?: readonly string[]
}) {
  const definition = getReviewedPotentialDefinition(input.member.agentId)
  if (!definition) return null
  const stateByAgent: Record<string, string[]> = {
    'agent-ellen': ['ellen_flash_freeze_charge', 'ellen_ice_damage_stack'],
    'agent-grace': ['grace_electric_enhancement'],
    'agent-harumasa': ['harumasa_focus'],
    'agent-nekomata': ['nekomata_pawpad_ambush'],
    'agent-soldier-11': [],
    'agent-rina': ['rina_core_penetration_buff'],
    'agent-lycaon': ['lycaon_encircle_prey', 'provider_non_active'],
    'agent-burnice':
      input.member.initialStats.enerRegen >= 1.8 ? ['burnice_energy_regen_threshold_met'] : [],
  }
  const states = stateByAgent[input.member.agentId]
  if (!states) return null
  const ownerIdentity = getCurrentAgentEventContract(input.member.agentId)?.identity
  if (
    input.member.agentId === 'agent-soldier-11' &&
    ownerIdentity &&
    input.memberIds?.some((id) => {
      if (id === input.member.agentId) return false
      const other = getCurrentAgentEventContract(id)?.identity
      return (
        other &&
        (other.attribute === ownerIdentity.attribute || other.faction === ownerIdentity.faction)
      )
    })
  )
    states.push('soldier11_fields_of_fire_active')
  const sourceRefs = [
    `upstream-sha256:${definition.source.upstreamRawSha256}`,
    `${definition.source.url}#sourceVersion=${definition.source.sourceVersion}`,
    'declared-comparison-prepared-state-not-current-battle-observation',
  ]
  const potentialEvents: Record<string, PotentialApplicationEvent> = {}
  for (const usage of input.eventUsages) {
    if (usage.ownerAgentId !== input.member.agentId) continue
    const resolved = resolveCurrentAgentEvent({
      stableId: usage.ownerAgentId,
      eventId: usage.eventId,
      skillLevel: usage.skillLevel,
    })
    if (resolved.status !== 'supported') continue
    potentialEvents[`${usage.ownerAgentId}:${usage.eventId}`] = {
      eventId: usage.eventId,
      actionFamilies: actualPlanningPotentialActionFamilies32({
        actionId: usage.eventId.split('.')[1]!,
        skill: usage.eventId.split('.')[0]!,
        attribute: resolved.attribute,
      }),
      providerStateKeys: states,
      providerStateStacks:
        input.member.agentId === 'agent-ellen' ? { ellen_ice_damage_stack: 10 } : {},
      targetStateKeys: [],
      sourceRefs,
    }
  }
  const policyId = 'reviewed-potential-prepared-fixed-events-r1'
  return {
    potentialEvents,
    // Source states are the same preparation on both sides. The Burnice threshold
    // is evaluated from each real initial panel, not part of the common policy.
    identity: stableContentHash({
      policyId,
      agentId: input.member.agentId,
      sourceRefs,
      ...(input.member.agentId === 'agent-soldier-11' ? { memberIds: input.memberIds ?? [] } : {}),
    }),
    policyId,
    baselineReferences:
      input.member.agentId === 'agent-rina' ? { within_10m: false, minions_onField: true } : {},
    boundary:
      '潜能数值比较声明已进入来源限定准备态（艾莲为10层，丽娜为远距核心增益，莱卡恩为非活跃包围猎物）；非当前实战观测。动作沿锁定来源事件，未声明触发成本、计时覆盖或完整轮转。',
  }
}
