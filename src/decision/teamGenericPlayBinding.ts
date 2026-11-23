import { stableContentHash } from '../gameDataPacks/types'
import { isCompleteFiniteTeamPlay } from './teamFinitePlayContract'
import type { OfflineTeamDetails } from './current31TeamIntrinsicIndex'

export type GenericPlayDetails = Pick<
  OfflineTeamDetails,
  'formedTeamReference' | 'prerequisiteStatus' | 'primaryOutputAgentId' | 'mechanismDirection'
>
export type GenericRankingIntrinsicBinding = {
  status: 'ready' | 'unavailable'
  contentHash: string | null
  lookup: (memberIds: readonly string[], candidateId: string) => GenericPlayDetails | null
}
export function genericPlayClassificationBasis(system: string) {
  return system === 'attribute_anomaly'
    ? ('anomaly_output_capacity' as const)
    : system === 'direct_damage'
      ? ('standard_direct_output' as const)
      : ('primary_special_output_family' as const)
}

/** Bind selected play, all role/recipient/trigger sources and the formed
 * conditions to this exact intrinsic artifact. No score or rating is derived. */
export function genericFinitePlayIdentity(
  intrinsicIndexContentHash: string,
  memberIds: readonly string[],
  details: GenericPlayDetails | null,
) {
  const key = [...memberIds].sort().join('|')
  const direction = details?.mechanismDirection
  if (
    !details ||
    !direction ||
    direction.primaryOutputAgentId !== details.primaryOutputAgentId ||
    !isCompleteFiniteTeamPlay(direction.playability, key) ||
    direction.playability!.primaryOutputAgentId !== details.primaryOutputAgentId
  )
    return null
  return `${key}#${stableContentHash({ intrinsicIndexContentHash, key, formedTeamReference: details.formedTeamReference, prerequisiteStatus: details.prerequisiteStatus, mechanismDirection: direction })}`
}
