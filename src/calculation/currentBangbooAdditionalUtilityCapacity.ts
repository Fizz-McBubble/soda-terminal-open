import {
  getCurrentBangbooNumericData,
  projectCurrentBangbooStats,
} from '../gameDataPacks/currentBangbooNumericCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { parseBangbooParameterToken } from './currentBangbooBaseUtilityContracts'
import { definitionsByGameId } from './currentBangbooMechanicDefinitions'
import type { BangbooUtilityPurpose } from './currentBangbooUtilityProjectionTypes'

export interface BangbooAdditionalUtilityCapacity {
  readonly purpose: BangbooUtilityPurpose
  readonly mechanic: string
  readonly value: number
  readonly unit: 'attack_point' | 'shield_point' | 'hp_ratio_target_hp' | 'energy_point'
  readonly receiver: 'team_agents' | 'pickup_agent' | 'triggering_agent'
  readonly recipientIds: readonly string[]
  readonly trigger: string
  readonly targetAction: string
  readonly durationSeconds?: number
  readonly intervalSeconds?: number
  readonly enemiesHit?: number
  readonly applicationStatus: 'conditional_capacity' | 'declared_capacity'
  readonly capacityOnly: true
  readonly source: {
    readonly url: string
    readonly sha256: string
    readonly semanticSha256: string
    readonly parameterPointer: string
  }
}

/** Other sourced resource/buff capacities that have no base-utility row.
 * A per-trigger capacity is not actual healing, energy spent or battle uptime. */
export function resolveBangbooAdditionalUtilityCapacities(input: {
  stableId: string
  stars: number
  memberIds: readonly string[]
  active: boolean
  eventFlags?: Readonly<Record<string, boolean>>
  /** Actual targets hit by Paperboo's chain, independent of enemyCount. */
  chainEnemiesHit?: number
}): BangbooAdditionalUtilityCapacity[] {
  if (!input.active || !Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
    return []
  const item = getCurrentBangbooNumericData(input.stableId)
  const definition = item && definitionsByGameId[item.gameId]
  const skill = item?.skills.find((row) => row.role === 'additional_ability')
  const param = skill?.levelParams[input.stars - 1]
  if (!item || !skill || !definition || !param) return []
  const values = param.split('|').map((token) => parseBangbooParameterToken(token, 60))
  const stats = projectCurrentBangbooStats({
    stableId: input.stableId,
    level: 60,
    ascensionLevelCap: 60,
  })
  const ordinaryRecipients = input.memberIds.filter((id) => {
    const identity = getCurrentAgentEventContract(id)?.identity
    return identity && identity.specialty !== 'rupture'
  })
  const source = {
    url: item.source.url,
    sha256: item.source.sha256,
    semanticSha256: skill.semanticSha256,
    parameterPointer: `/skill/b/level/${input.stars}/param`,
  }
  const read = (index: number | undefined) =>
    index === undefined ? undefined : (values[index] ?? undefined)
  const duration = (target: string) => {
    const effect = definition.effects.find(
      (row) => row.operator === 'duration_delta' && row.targetAction === target,
    )
    return effect?.constantValues?.[0] ?? read(effect?.valueIndices?.[0])
  }
  return definition.effects.flatMap((effect): BangbooAdditionalUtilityCapacity[] => {
    const value = read(effect.valueIndices?.[0])
    if (value === undefined || !Number.isFinite(value)) return []
    const shared = {
      mechanic: effect.operator,
      targetAction: effect.targetAction,
      source,
      capacityOnly: true as const,
    }
    if (effect.operator === 'attack_flat_formula') {
      const pickup = effect.targetAction === 'team:knights_stars'
      return [
        {
          ...shared,
          purpose: 'attack_buff',
          value,
          unit: 'attack_point',
          receiver: pickup ? 'pickup_agent' : 'team_agents',
          recipientIds: input.memberIds,
          trigger: pickup ? 'contact_knights_star' : 'active_skill_used',
          durationSeconds: duration(effect.targetAction),
          applicationStatus: 'conditional_capacity',
        },
      ]
    }
    if (effect.operator === 'hp_restore_percent_target_hp')
      return [
        {
          ...shared,
          purpose: 'sustain',
          value,
          unit: 'hp_ratio_target_hp',
          receiver: 'triggering_agent',
          recipientIds: input.memberIds,
          trigger: 'superstar_applied',
          applicationStatus: 'conditional_capacity',
        },
      ]
    if (effect.operator === 'energy_flat') {
      if (effect.requiresFlag && input.eventFlags?.[effect.requiresFlag] === false) return []
      return [
        {
          ...shared,
          purpose: 'energy',
          value,
          unit: 'energy_point',
          receiver: 'team_agents',
          recipientIds: ordinaryRecipients,
          trigger: 'agent_vortex_or_chain_triggered',
          intervalSeconds: effect.intervalSeconds,
          applicationStatus:
            input.eventFlags?.[effect.requiresFlag ?? ''] === true
              ? 'declared_capacity'
              : 'conditional_capacity',
        },
      ]
    }
    if (effect.operator === 'shield_percent_bangboo_hp' && stats.status === 'supported') {
      const hits = input.chainEnemiesHit
      if (hits !== undefined && (!Number.isInteger(hits) || hits < 0)) return []
      if (hits === 0) return []
      const indices = hits === undefined ? [0, 1, 2] : [Math.min(hits, 3) - 1]
      return indices.flatMap((index) => {
        const ratio = read(effect.valueIndices?.[index])
        return ratio === undefined
          ? []
          : [
              {
                ...shared,
                purpose: 'sustain' as const,
                value: Math.round(stats.hp * ratio * 1e6) / 1e6,
                unit: 'shield_point' as const,
                receiver: 'team_agents' as const,
                recipientIds: input.memberIds,
                trigger: 'chain_attack_hits_enemies',
                enemiesHit: index + 1,
                durationSeconds: duration('chain:shield'),
                applicationStatus:
                  hits === undefined
                    ? ('conditional_capacity' as const)
                    : ('declared_capacity' as const),
              },
            ]
      })
    }
    return []
  })
}
