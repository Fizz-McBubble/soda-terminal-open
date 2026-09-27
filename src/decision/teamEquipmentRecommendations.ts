import { currentBangbooDirectory } from '../assault/catalog'
import type { AccountRoster } from '../assault/types'
import { stableContentHash } from '../gameDataPacks/types'
import type { BangbooSelection } from '../teamEngine/contracts'
import { defaultWEngineRefinement, resolveWEngine } from './wEngineResolver'
import {
  maxTargetTeamBangbooRecommendations,
  resolveTargetTeamBangbooOption,
  targetTeamBangbooOptions,
} from './targetTeamSourceBangbooOptions'
import { describeBangbooTeamFit } from './bangbooTeamFit'
import { describeBangbooConditions } from './bangbooConditionPresentation'

const bangbooById = new Map(currentBangbooDirectory.map((bangboo) => [bangboo.id, bangboo]))

export function defaultEquipmentRankForRarity(rarity: string | null | undefined) {
  return defaultWEngineRefinement(rarity) as 1 | 5
}

function bangbooOption(
  bangbooId: string,
  sourceRequiredStars?: number,
  activationStatus?: 'active' | 'inactive' | 'unknown',
  recommendationReason?: string,
) {
  const bangboo = bangbooById.get(bangbooId)
  return {
    bangbooId,
    name: bangboo?.name ?? bangbooId,
    rarity: bangboo?.rarity ?? null,
    // A raised value comes from the evaluated exact formation, not from the
    // account. Ordinary recommendations retain the global rarity baseline.
    defaultStars: sourceRequiredStars ?? defaultEquipmentRankForRarity(bangboo?.rarity),
    ...(activationStatus ? { activationStatus } : {}),
    ...(recommendationReason ? { recommendationReason } : {}),
  }
}

function sourceRequiredBangbooStars(selection: BangbooSelection, bangbooId: string) {
  if (
    (selection.status === 'selected' || selection.status === 'compatible_fallback') &&
    selection.bangbooId === bangbooId &&
    selection.bangbooStar !== undefined &&
    selection.bangbooStar >= 1
  )
    return selection.bangbooStar
  return undefined
}

export function projectTeamEquipmentRecommendations(input: {
  memberIds: readonly [string, string, string]
  bangbooSelection: BangbooSelection
  roster: AccountRoster
  includeReviewedSourceOptions?: boolean
}) {
  const wEngines = input.memberIds.map((agentId) => {
    const resolution = resolveWEngine({
      agent: input.roster.agents.find((agent) => agent.agentId === agentId),
      legacyWEngines: input.roster.wEngines,
    })
    return {
      agentId,
      ...resolution,
    }
  })
  const bangbooIds =
    input.bangbooSelection.status === 'selected'
      ? [input.bangbooSelection.bangbooId, ...(input.bangbooSelection.alternativeBangbooIds ?? [])]
      : input.bangbooSelection.status === 'compatible_fallback'
        ? [input.bangbooSelection.bangbooId, ...input.bangbooSelection.bangbooIds]
        : []
  const primaryBangbooId =
    input.bangbooSelection.status === 'compatible_fallback'
      ? input.bangbooSelection.bangbooId
      : (bangbooIds[0] ?? null)
  // Already-selected source alternatives still need their activation rank even when
  // this projection is not responsible for adding further author choices.
  const selectedStars = primaryBangbooId
    ? sourceRequiredBangbooStars(input.bangbooSelection, primaryBangbooId)
    : undefined
  const reviewedOptions = targetTeamBangbooOptions({
    memberIds: input.memberIds,
    ...(primaryBangbooId && selectedStars !== undefined
      ? { bangbooStarsById: { [primaryBangbooId]: selectedStars } }
      : {}),
  })
  const authorOptions = input.includeReviewedSourceOptions ? reviewedOptions : []
  const recommendedBangbooIds = reviewedOptions.map((option) => option.bangbooId)
  const retainedOutsideRecommendations = Boolean(
    primaryBangbooId && !recommendedBangbooIds.includes(primaryBangbooId),
  )
  const allBangbooIds = [
    ...new Set([
      ...(primaryBangbooId ? [primaryBangbooId] : []),
      ...authorOptions.map((option) => option.bangbooId),
      ...bangbooIds,
    ]),
  ].slice(0, maxTargetTeamBangbooRecommendations + Number(retainedOutsideRecommendations))
  const core = {
    contract: 'soda-team-equipment-recommendations/v1' as const,
    wEngines,
    bangboo: {
      status: input.bangbooSelection.status,
      primaryBangbooId,
      recommendedBangbooIds,
      alternativeBangbooIds: allBangbooIds.filter((id) => id !== primaryBangbooId),
      options: [
        ...new Set([primaryBangbooId, ...allBangbooIds].filter((id): id is string => Boolean(id))),
      ].map((bangbooId) => {
        const retainedOption = resolveTargetTeamBangbooOption(
          { memberIds: input.memberIds },
          bangbooId,
        )
        const option = bangbooOption(
          bangbooId,
          bangbooId === primaryBangbooId
            ? (sourceRequiredBangbooStars(input.bangbooSelection, bangbooId) ??
                retainedOption?.defaultStars)
            : retainedOption?.defaultStars,
          retainedOption?.activationStatus,
        )
        const { activationStatus } = describeBangbooConditions({
          memberIds: input.memberIds,
          bangbooId,
          stars: option.defaultStars,
        })
        const fit = describeBangbooTeamFit({
          memberIds: input.memberIds,
          bangbooId,
          stars: option.defaultStars,
          activationStatus,
        })
        return bangbooOption(
          bangbooId,
          option.defaultStars,
          activationStatus,
          fit.recommendationReason,
        )
      }),
    },
    parameterConfirmation: 'required_before_numeric_calculation' as const,
    sideEffect: 'read_only' as const,
    boundary:
      '当前音擎只来自代理人维护；推荐音擎来自当前版本候选池。两者由统一 Resolver 分离解析，不读取或维护账户实体库存。推荐等级固定为 60；S 级默认 P1/1 星，A/B 级默认 P5/5 星。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
