import { normalizeTargetTeamEquipmentParameters } from '../application/publicTargetTeamEquipmentFingerprint'
import { currentBangbooDirectory } from '../assault/catalog'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { BangbooSelection, BangbooRule } from '../teamEngine/contracts'
import {
  effectiveBangbooActivationPredicate,
  evaluateTeamMethodFormation,
  evaluateTeamPredicate,
} from '../teamEngine/teamMethodR1'
import type { TargetTeamEquipmentParameterSelection } from './targetTeamAccountBoundBenchmark'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import {
  type SourceSupportedTargetBangbooInput,
  maxTargetTeamBangbooRecommendations,
  reviewedSourceBangbooOptions,
  resolveTargetTeamBangbooOption,
  targetTeamBangbooOptions,
  sourceBangbooStarsById,
  sourceBangbooCandidateIds,
} from './targetTeamSourceBangbooOptions'
export {
  type SourceSupportedTargetBangbooInput,
  reviewedSourceBangbooOptions,
  resolveTargetTeamBangbooOption,
  targetTeamBangbooOptions,
  recommendedTargetBangbooDefault,
  withReviewedSourceBangbooAlternatives,
  sourceBangbooId,
  sourceBangbooStar,
  sourceBangbooCandidateIds,
} from './targetTeamSourceBangbooOptions'

import { defaultEquipmentRankForRarity } from './targetTeamSourceBangbooOptions'

export type EffectiveTargetTeamEquipmentParameters = TargetTeamEquipmentParameterSelection & {
  source: 'source_defaults' | 'player_confirmed'
}

type PlayerConfirmableBangbooSelection = Extract<
  BangbooSelection,
  { status: 'selected' | 'compatible_fallback' }
>

function sourceDeclaredBangbooSelection(
  input: SourceSupportedTargetBangbooInput,
): BangbooSelection {
  if (!input.primaryBangbooId) return { status: 'no_authoritative_recommendation', bangbooIds: [] }
  const bangboo = current31TeamEngineD1Pack.bangbooRules.find(
    (rule) => rule.bangbooId === input.primaryBangbooId,
  )
  const agents = input.memberIds.map((agentId) =>
    current31TeamEngineD1Pack.agentRules.find((agent) => agent.agentId === agentId),
  )
  // A source-backed exact identity remains usable when its activation has not
  // been modeled here. Do not call that an activation verification.
  if (
    !bangboo ||
    bangboo.activation.status !== 'modeled' ||
    !agents.every((agent): agent is NonNullable<typeof agent> => Boolean(agent))
  )
    return { status: 'selected', bangbooId: input.primaryBangbooId }

  const modeledBangboo = bangboo as BangbooRule & {
    activation: Extract<BangbooRule['activation'], { status: 'modeled' }>
  }
  const defaultStar = defaultEquipmentRankForRarity(
    currentBangbooDirectory.find((item) => item.id === input.primaryBangbooId)?.rarity,
  )
  const explicitStar = input.bangbooStarsById?.[input.primaryBangbooId]
  const candidateStars = explicitStar
    ? [explicitStar]
    : ([1, 2, 3, 4, 5] as const).filter((star) => star >= defaultStar)
  const context = {
    agents,
    producedTags: new Set(agents.flatMap((agent) => agent.produces)),
    agentStateById: Object.fromEntries(
      input.roster.agents.map((agent) => [
        agent.agentId,
        { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
      ]),
    ),
  }
  const activatedStar = candidateStars.find((star) =>
    evaluateTeamPredicate(
      effectiveBangbooActivationPredicate(
        modeledBangboo.bangbooId,
        modeledBangboo.activation,
        star,
      ),
      context,
    ),
  )
  return activatedStar
    ? { status: 'selected', bangbooId: input.primaryBangbooId, bangbooStar: activatedStar }
    : { status: 'no_activation_match', bangbooIds: [input.primaryBangbooId] }
}

function exactReleasedMemberRules(memberIds: readonly string[]) {
  if (memberIds.length !== 3) return null
  const agents = memberIds.map((agentId) =>
    current31TeamEngineD1Pack.agentRules.find((agent) => agent.agentId === agentId),
  )
  return agents.every((agent): agent is NonNullable<typeof agent> => Boolean(agent)) ? agents : null
}

/**
 * Authority directions without a source default may still let the player choose
 * a Bangboo whose released, modeled activation predicate closes for the exact
 * three members. This deliberately does not use suitability or damage evidence
 * as a substitute recommendation.
 */
function activationOnlyPlayerConfirmableBangbooIds(
  input: SourceSupportedTargetBangbooInput,
): readonly string[] {
  if (!exactReleasedMemberRules(input.memberIds)) return []
  return current31TeamEngineD1Pack.bangbooRules.flatMap((rule) => {
    if (rule.releaseState !== 'released' || rule.activation.status !== 'modeled') return []
    const selection = sourceDeclaredBangbooSelection({ ...input, primaryBangbooId: rule.bangbooId })
    return selection.status === 'selected' ? [rule.bangbooId] : []
  })
}

/**
 * Derives the source-supported Bangboo set from the same released-rule formation gate used by
 * target queries. The account roster contributes only required agent state, never an arbitrary
 * catalog fallback.
 */
export function sourceSupportedTargetBangbooSelection(
  input: SourceSupportedTargetBangbooInput,
): BangbooSelection {
  if (!input.engineCandidate) return sourceDeclaredBangbooSelection(input)
  const kernel = current31TeamEngineD1Pack.kernels.find(
    (item) => item.kernelId === input.engineCandidate?.kernelId,
  )
  const agentRules = input.memberIds.map((agentId) =>
    current31TeamEngineD1Pack.agentRules.find((item) => item.agentId === agentId),
  )
  if (kernel && agentRules.every((agent): agent is NonNullable<typeof agent> => Boolean(agent)))
    return evaluateTeamMethodFormation({
      kernel,
      agents: agentRules as [
        (typeof current31TeamEngineD1Pack.agentRules)[number],
        (typeof current31TeamEngineD1Pack.agentRules)[number],
        (typeof current31TeamEngineD1Pack.agentRules)[number],
      ],
      bangbooRules: current31TeamEngineD1Pack.bangbooRules,
      bangbooCandidateIds: sourceBangbooCandidateIds(input),
      bangbooStarsById: sourceBangbooStarsById(input),
      fieldTimeBudget: 1.35,
      agentStateById: Object.fromEntries(
        input.roster.agents.map((agent) => [
          agent.agentId,
          { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
        ]),
      ),
    }).bangbooSelection
  return (
    input.engineCandidate?.bangbooSelection ??
    ({ status: 'selected', bangbooId: input.primaryBangbooId } as const)
  )
}

/**
 * Re-runs only the exact Engine-declared Bangboo identities for a player confirmation. This is
 * never a catalog fallback: a selected/compatible Engine identity may be confirmed when an
 * Authority direction intentionally has no default, while an unbound diagnostic selection keeps
 * its stricter unknown-suitability boundary.
 */
export function playerConfirmableTargetBangbooIds(
  input: SourceSupportedTargetBangbooInput,
): readonly string[] {
  return shortlistedPlayerConfirmableTargetBangbooIds(input)
}

function shortlistedPlayerConfirmableTargetBangbooIds(
  input: SourceSupportedTargetBangbooInput,
  retainedBangbooId?: string,
) {
  const legacyIds = legacyPlayerConfirmableTargetBangbooIds(input)
  const recommendedIds = targetTeamBangbooOptions(input).map((option) => option.bangbooId)
  const reviewedIds = reviewedSourceBangbooOptions(input).map((option) => option.bangbooId)
  const validIds = new Set([
    ...legacyIds,
    ...recommendedIds,
    ...reviewedIds,
    ...[retainedBangbooId, input.primaryBangbooId].filter((id): id is string =>
      Boolean(id && resolveTargetTeamBangbooOption(input, id)),
    ),
  ])
  return [
    ...new Set([
      ...(retainedBangbooId && validIds.has(retainedBangbooId) ? [retainedBangbooId] : []),
      ...(input.primaryBangbooId && validIds.has(input.primaryBangbooId)
        ? [input.primaryBangbooId]
        : []),
      ...recommendedIds,
      ...legacyIds,
    ]),
  ].slice(
    0,
    maxTargetTeamBangbooRecommendations +
      Number(
        Boolean(
          retainedBangbooId &&
          validIds.has(retainedBangbooId) &&
          !recommendedIds.includes(retainedBangbooId),
        ),
      ),
  )
}

function legacyPlayerConfirmableTargetBangbooIds(
  input: SourceSupportedTargetBangbooInput,
): readonly string[] {
  const kernel = current31TeamEngineD1Pack.kernels.find(
    (item) => item.kernelId === input.engineCandidate?.kernelId,
  )
  // No Engine kernel/default is not a verdict that the exact three cannot
  // activate a released Bangboo. Keep this manual route activation-only and
  // require the same predicate again when the player submits a choice.
  if (!input.engineCandidate || !kernel)
    return [
      ...new Set([
        ...targetTeamBangbooOptions(input).map((option) => option.bangbooId),
        ...activationOnlyPlayerConfirmableBangbooIds(input),
      ]),
    ]

  const sourceSelection = sourceSupportedTargetBangbooSelection(input)
  const engineSelection = input.engineCandidate?.bangbooSelection ?? sourceSelection
  const agents = exactReleasedMemberRules(input.memberIds)
  if (!agents) return []
  const agentStateById = Object.fromEntries(
    input.roster.agents.map((agent) => [
      agent.agentId,
      { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
    ]),
  )
  const sourceCandidateIds = new Set(
    engineSelection.status === 'selected'
      ? [engineSelection.bangbooId, ...(engineSelection.alternativeBangbooIds ?? [])]
      : engineSelection.status === 'compatible_fallback'
        ? [engineSelection.bangbooId, ...engineSelection.bangbooIds]
        : engineSelection.status === 'no_authoritative_recommendation'
          ? engineSelection.bangbooIds
          : [],
  )
  if (!sourceCandidateIds.size) return []
  const requiresUnknownSuitability =
    sourceSelection.status === 'no_authoritative_recommendation' &&
    engineSelection.status === 'no_authoritative_recommendation'

  return current31TeamEngineD1Pack.bangbooRules.flatMap((rule) => {
    if (
      rule.releaseState !== 'released' ||
      (requiresUnknownSuitability && rule.suitability.status !== 'unknown') ||
      !sourceCandidateIds.has(rule.bangbooId)
    )
      return []
    const formation = evaluateTeamMethodFormation({
      kernel,
      agents: agents as Parameters<typeof evaluateTeamMethodFormation>[0]['agents'],
      bangbooRules: current31TeamEngineD1Pack.bangbooRules,
      bangbooCandidateIds: new Set([rule.bangbooId]),
      bangbooStarsById: sourceBangbooStarsById(input),
      fieldTimeBudget: 1.35,
      agentStateById,
    })
    const selection = formation.bangbooSelection
    return formation.status !== 'blocked' &&
      (selection.status === 'selected' || selection.status === 'compatible_fallback') &&
      selection.bangbooId === rule.bangbooId
      ? [rule.bangbooId]
      : []
  })
}

/**
 * Validates a player's explicit Bangboo choice against the current exact formation. It returns
 * the re-evaluated compatibility result, never a source-backed primary recommendation.
 */
export function selectPlayerConfirmableTargetBangbooSelection(
  input: SourceSupportedTargetBangbooInput & { bangbooId: string },
): PlayerConfirmableBangbooSelection {
  const confirmableIds = [...legacyPlayerConfirmableTargetBangbooIds(input)]
  const authorOption = resolveTargetTeamBangbooOption(input, input.bangbooId)
  const displayedIds = shortlistedPlayerConfirmableTargetBangbooIds(input, input.bangbooId)
  if (
    authorOption &&
    (authorOption.activationStatus !== 'active' ||
      !input.engineCandidate ||
      !confirmableIds.includes(input.bangbooId))
  )
    return {
      status: 'selected',
      bangbooId: input.bangbooId,
      bangbooStar: input.bangbooStarsById?.[input.bangbooId] ?? authorOption.defaultStars,
      alternativeBangbooIds: [...new Set(displayedIds)].filter((id) => id !== input.bangbooId),
    }
  if (!confirmableIds.includes(input.bangbooId))
    throw new Error('这只邦布暂不能用于当前队伍，请重新选择。')

  const kernel = current31TeamEngineD1Pack.kernels.find(
    (item) => item.kernelId === input.engineCandidate?.kernelId,
  )
  if (!kernel) {
    const selection = sourceDeclaredBangbooSelection({
      ...input,
      primaryBangbooId: input.bangbooId,
    })
    if (selection.status !== 'selected') throw new Error('当前队伍或星级不满足这只邦布的条件。')
    const alternatives = displayedIds.filter((id) => id !== input.bangbooId)
    return alternatives.length ? { ...selection, alternativeBangbooIds: alternatives } : selection
  }
  const agents = exactReleasedMemberRules(input.memberIds)
  if (!agents) throw new Error('当前队伍或星级不满足这只邦布的条件。')
  const formation = evaluateTeamMethodFormation({
    kernel,
    agents: agents as Parameters<typeof evaluateTeamMethodFormation>[0]['agents'],
    bangbooRules: current31TeamEngineD1Pack.bangbooRules,
    bangbooCandidateIds: new Set([input.bangbooId]),
    bangbooStarsById: sourceBangbooStarsById(input),
    fieldTimeBudget: 1.35,
    agentStateById: Object.fromEntries(
      input.roster.agents.map((agent) => [
        agent.agentId,
        { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
      ]),
    ),
  })
  if (
    formation.status === 'blocked' ||
    (formation.bangbooSelection.status !== 'selected' &&
      formation.bangbooSelection.status !== 'compatible_fallback')
  )
    throw new Error('当前队伍或星级不满足这只邦布的条件。')
  const selection = formation.bangbooSelection
  // Keep the same revalidated choice set available after confirmation. Choosing
  // one item does not turn the other activated choices into missing evidence.
  if (selection.status === 'compatible_fallback') return { ...selection, bangbooIds: displayedIds }
  const alternatives = displayedIds.filter((id) => id !== input.bangbooId)
  return alternatives.length ? { ...selection, alternativeBangbooIds: alternatives } : selection
}

function availableBangbooIds(selection: BangbooSelection) {
  if (selection.status === 'selected')
    return [...new Set([selection.bangbooId, ...(selection.alternativeBangbooIds ?? [])])]
  if (selection.status === 'compatible_fallback')
    return [...new Set([selection.bangbooId, ...selection.bangbooIds])]
  return []
}

/** Keeps a player choice inside the exact team's source-supported Bangboo set. */
export function selectSupportedTargetBangbooSelection(input: {
  selection: BangbooSelection
  bangbooId: string
}): BangbooSelection {
  const supportedBangbooIds = availableBangbooIds(input.selection)
  if (!supportedBangbooIds.includes(input.bangbooId)) {
    if (input.selection.status === 'no_activation_match')
      throw new Error('当前队伍或星级不满足这只邦布的条件。')
    throw new Error('请选择此队伍提供的邦布。')
  }
  if (input.selection.status === 'selected')
    return {
      status: 'selected',
      bangbooId: input.bangbooId,
      ...(input.selection.bangbooStar !== undefined
        ? { bangbooStar: input.selection.bangbooStar }
        : {}),
      alternativeBangbooIds: supportedBangbooIds.filter((id) => id !== input.bangbooId),
    }
  if (input.selection.status === 'compatible_fallback')
    return {
      status: 'compatible_fallback',
      bangbooId: input.bangbooId,
      ...(input.selection.bangbooStar !== undefined
        ? { bangbooStar: input.selection.bangbooStar }
        : {}),
      bangbooIds: supportedBangbooIds.filter((id) => id !== input.bangbooId),
    }
  return input.selection
}

export {
  normalizeTargetTeamEquipmentParameters,
  targetTeamEquipmentParametersFingerprint,
} from '../application/publicTargetTeamEquipmentFingerprint'

/**
 * Default recommendations are explicit calculation inputs, but remain distinguished from a
 * player-confirmed override. A missing complete default remains fail-closed.
 */
export function defaultTargetTeamEquipmentParameters(
  fit: Pick<TargetTeamWarehouseFit, 'memberIds' | 'equipmentRecommendations'>,
): EffectiveTargetTeamEquipmentParameters | undefined {
  const wEngines = fit.memberIds.flatMap((agentId) => {
    const recommendation = fit.equipmentRecommendations.wEngines.find(
      (item) => item.agentId === agentId,
    )
    const primary = recommendation?.recommendedPrimary
    if (!primary) return []
    const recordedRefinement =
      recommendation.current?.engineId === primary.engineId
        ? recommendation.current.refinement
        : undefined
    return [
      {
        agentId,
        engineId: primary.engineId,
        refinement: recordedRefinement ?? primary.refinement,
      },
    ]
  })
  const bangbooId = fit.equipmentRecommendations.bangboo.primaryBangbooId
  const bangboo = fit.equipmentRecommendations.bangboo.options.find(
    (item) => item.bangbooId === bangbooId,
  )
  if (wEngines.length !== fit.memberIds.length || !bangbooId || !bangboo) return undefined
  return {
    ...normalizeTargetTeamEquipmentParameters({
      wEngines,
      bangbooId,
      bangbooStars: bangboo.defaultStars,
    }),
    source: 'source_defaults',
  }
}

export function confirmedTargetTeamEquipmentParameters(
  parameters: TargetTeamEquipmentParameterSelection,
): EffectiveTargetTeamEquipmentParameters {
  return { ...normalizeTargetTeamEquipmentParameters(parameters), source: 'player_confirmed' }
}
