import { currentBangbooDirectory } from '../assault/catalog'
import type { AccountRoster } from '../assault/types'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type {
  BangbooSelection,
  BangbooStarsById,
  TeamEngineCandidate,
} from '../teamEngine/contracts'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'
import {
  getCurrentBangbooContractRequirements,
  prepareCurrentBangbooAdditionalActivation,
} from '../calculation/currentBangbooMechanicContracts'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { createBangbooUtilityProjector } from '../calculation/currentBangbooUtilityProjection'
import { projectCurrentBangbooComposition } from './exhaustiveBangbooScoring'

import { defaultWEngineRefinement } from './wEngineResolver'
import { compareBangbooTeamOptions } from './bangbooTeamFit'
import { selectTargetTeamBangbooShortlist } from './targetTeamBangbooShortlist'

export const defaultEquipmentRankForRarity = (rarity: string | null | undefined) =>
  defaultWEngineRefinement(rarity) as 1 | 5

export const maxTargetTeamBangbooRecommendations = 3

export type SourceSupportedTargetBangbooInput = {
  memberIds: readonly string[]
  primaryBangbooId: string
  engineCandidate?: TeamEngineCandidate
  roster: AccountRoster
  /** Explicit scheme stars for this calculation, never account ownership. */
  bangbooStarsById?: BangbooStarsById
}

/** Existing exact-trio author options; never a default or an account ownership claim. */
let reviewedBangbooIdsByTrio: Map<string, readonly string[]> | undefined
const optionCache = new Map<string, ReturnType<typeof computeTargetBangbooOptions>>()

export function reviewedSourceBangbooOptions(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
) {
  if (input.memberIds.length !== 3 || new Set(input.memberIds).size !== 3) return []
  const key = [...input.memberIds].sort().join('|')
  reviewedBangbooIdsByTrio ??= new Map(
    currentReviewedTeamSourceDirections().map((direction) => [
      [...direction.memberIds].sort().join('|'),
      [...new Set(direction.sourceBangbooOptionIds ?? [])],
    ]),
  )
  const ids = reviewedBangbooIdsByTrio.get(key) ?? []
  return evaluateTargetBangbooOptions(input, ids).map((option) => ({
    ...option,
    recommendationReason: `资料推荐；${option.recommendationReason}`,
  }))
}

/** Reuse the full current mechanic catalog; the older Team Engine rule pack is
 * a partial model, not the released Bangboo universe. Source options validate
 * a pairing but their absence must not prevent mechanic-based alternatives. */
export function targetTeamBangbooOptions(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
) {
  const reviewed = reviewedSourceBangbooOptions(input)
  const activeReviewed = reviewed.filter((option) => option.activationStatus === 'active')
  const reviewedIds = new Set(reviewed.map((option) => option.bangbooId))
  const alternatives = evaluateTargetBangbooOptions(
    input,
    currentBangbooDirectory
      .filter((entry) => entry.releaseState === 'released')
      .map((entry) => entry.id),
  )
  const activeAlternatives = alternatives
    .filter((option) => option.activationStatus === 'active' && !reviewedIds.has(option.bangbooId))
    .map((option) => ({
      ...option,
      recommendationReason: `条件适配；${option.recommendationReason}`,
    }))

  const hasOrdinaryEnergyRecipient = input.memberIds.some((id) => {
    const identity = getCurrentAgentEventContract(id)?.identity
    return identity !== undefined && identity.specialty !== 'rupture'
  })
  return selectTargetTeamBangbooShortlist({
    reviewed: activeReviewed,
    alternatives: activeAlternatives,
    hasOrdinaryEnergyRecipient,
    limit: maxTargetTeamBangbooRecommendations,
  })
}

function evaluateTargetBangbooOptions(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
  ids: readonly string[],
) {
  if (input.memberIds.length !== 3 || new Set(input.memberIds).size !== 3) return []
  const key = JSON.stringify([
    [...input.memberIds].sort(),
    ids,
    Object.entries(input.bangbooStarsById ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ])
  const cached = optionCache.get(key)
  if (cached) return [...cached]
  const options = computeTargetBangbooOptions(input, ids)
  if (optionCache.size >= 4096) optionCache.delete(optionCache.keys().next().value!)
  optionCache.set(key, options)
  return [...options]
}

/** Resolve one retained/player-selected option without expanding the visible
 * recommendation shortlist. Extra-ability activation is not equipability:
 * a player's retained choice can still supply its base skills. */
export function resolveTargetTeamBangbooOption(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
  bangbooId: string,
) {
  const reviewed = reviewedSourceBangbooOptions(input).find(
    (option) => option.bangbooId === bangbooId,
  )
  if (reviewed) return reviewed
  const mechanic = evaluateTargetBangbooOptions(input, [bangbooId])[0]
  return mechanic ?? null
}

function computeTargetBangbooOptions(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
  ids: readonly string[],
) {
  const composition = projectCurrentBangbooComposition(input.memberIds)
  if (!composition) return []
  const resolveActivation = prepareCurrentBangbooAdditionalActivation(composition)
  const projectUtility = createBangbooUtilityProjector(input.memberIds)
  return [...new Set(ids)]
    .flatMap((bangbooId) => {
      const entry = currentBangbooDirectory.find(
        (item) => item.id === bangbooId && item.releaseState === 'released',
      )
      if (!entry) return []
      const defaultStars = defaultEquipmentRankForRarity(entry.rarity)
      const explicitStars = input.bangbooStarsById?.[bangbooId]
      if (
        explicitStars !== undefined &&
        (!Number.isInteger(explicitStars) || explicitStars < 1 || explicitStars > 5)
      )
        return []
      const stars = explicitStars
        ? [explicitStars]
        : ([1, 2, 3, 4, 5] as const).filter((star) => star >= defaultStars)
      const results = []
      for (const star of stars) {
        const activation = composition
          ? resolveActivation({
              stableId: bangbooId,
              additionalAbilityLevel: star,
            })
          : { status: 'unsupported' as const }
        results.push({ star, activation })
        // Only the first active rank is selected; later ranks cannot change this choice.
        if (activation.status === 'supported' && activation.active) break
      }
      const active = results.find(
        (result) => result.activation.status === 'supported' && result.activation.active,
      )
      const inactive =
        !active && results.every((result) => result.activation.status === 'supported')
      const defaultStar = active?.star ?? explicitStars ?? defaultStars
      // Only source-backed composition categories may establish activation.
      const knownCompositionFields = getCurrentBangbooContractRequirements(
        bangbooId,
      )?.compositionKeys.every((key) =>
        /^(agent|attribute|specialty|faction|attack_type):/.test(key),
      )
      const activationStatus = !knownCompositionFields
        ? 'unknown'
        : active
          ? 'active'
          : inactive
            ? 'inactive'
            : 'unknown'
      const projection = projectUtility({
        bangbooId,
        stars: defaultStar,
        activationStatus,
      })
      return [
        {
          bangbooId,
          name: entry.name,
          defaultStars: defaultStar,
          activationStatus: activationStatus as 'active' | 'inactive' | 'unknown',
          requiresRaisedStars: defaultStar > defaultStars,
          primaryPurpose: projection.primaryPurpose,
          secondaryPurposes: projection.secondaryPurposes,
          comparableSlice: projection.comparableSlice,
          additionalUtilityCapacities: projection.additionalUtilityCapacities,
          recipientFit: projection.recipientFit,
          recommendationReason: projection.recommendationReason,
        },
      ]
    })
    .sort(compareBangbooTeamOptions)
}

/** Reuse reviewed defaults; fill source gaps from conditional mechanic fits.
 * This is a usable starting point, not a claim of unique combat optimality.
 * Unknown activation never becomes an automatic choice. */
export function recommendedTargetBangbooDefault(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
) {
  const reviewed = reviewedSourceBangbooOptions(input)
  const selected = targetTeamBangbooOptions(input)[0] ?? null
  return selected
    ? {
        ...selected,
        recommendationBasis: reviewed.some((option) => option.bangbooId === selected.bangbooId)
          ? ('reviewed' as const)
          : ('mechanic' as const),
      }
    : null
}

/** Add validated author alternatives without assigning or changing the selected primary. */
export function withReviewedSourceBangbooAlternatives(
  input: Pick<SourceSupportedTargetBangbooInput, 'memberIds' | 'bangbooStarsById'>,
  selection: BangbooSelection,
): BangbooSelection {
  const ids = targetTeamBangbooOptions(input).map((option) => option.bangbooId)
  if (selection.status === 'selected')
    return {
      ...selection,
      alternativeBangbooIds: [...new Set([...(selection.alternativeBangbooIds ?? []), ...ids])]
        .filter((id) => id !== selection.bangbooId)
        .slice(0, maxTargetTeamBangbooRecommendations - 1),
    }
  if (selection.status === 'compatible_fallback')
    return {
      ...selection,
      bangbooIds: [...new Set([selection.bangbooId, ...selection.bangbooIds, ...ids])].slice(
        0,
        maxTargetTeamBangbooRecommendations,
      ),
    }
  return selection
}

export function sourceBangbooId(candidate: TeamEngineCandidate) {
  if (candidate.bangbooId) return candidate.bangbooId
  const selection = candidate.bangbooSelection
  if (selection.status === 'selected' || selection.status === 'compatible_fallback')
    return selection.bangbooId
  return null
}

/**
 * A source candidate may carry a minimum star discovered by the Team Engine.
 * Only a raised requirement overrides generic scheme defaults; ordinary S1
 * remains the Engine's baseline and must not be interpreted as ownership.
 */
export function sourceBangbooStar(candidate: TeamEngineCandidate | undefined, bangbooId: string) {
  const selection = candidate?.bangbooSelection
  if (
    !selection ||
    (selection.status !== 'selected' && selection.status !== 'compatible_fallback') ||
    selection.bangbooId !== bangbooId
  )
    return undefined
  return selection.bangbooStar && selection.bangbooStar > 1 ? selection.bangbooStar : undefined
}

export function sourceBangbooStarsById(input: SourceSupportedTargetBangbooInput) {
  const sourceStar = sourceBangbooStar(input.engineCandidate, input.primaryBangbooId)
  return {
    ...(sourceStar ? { [input.primaryBangbooId]: sourceStar } : {}),
    ...input.bangbooStarsById,
  } as BangbooStarsById
}

/** Source-declared alternatives remain in the exact revalidation pool for their primary. */
export function sourceBangbooCandidateIds(input: SourceSupportedTargetBangbooInput) {
  const selection = input.engineCandidate?.bangbooSelection
  if (selection?.status === 'selected' && selection.bangbooId === input.primaryBangbooId)
    return new Set([selection.bangbooId, ...(selection.alternativeBangbooIds ?? [])])
  if (
    selection &&
    (selection.status === 'compatible_fallback' ||
      (selection.status === 'selected' &&
        selection.alternativeBangbooIds?.includes(input.primaryBangbooId)))
  )
    return new Set([input.primaryBangbooId])
  return new Set(
    current31TeamEngineD1Pack.bangbooRules
      .filter((bangboo) => bangboo.releaseState === 'released')
      .map((bangboo) => bangboo.bangbooId),
  )
}
