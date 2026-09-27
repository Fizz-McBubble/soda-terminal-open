import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import { getAgentName } from '../application/publicRosterNames'
import { localizedAgentNames } from '../application/savedPlanDisplayName'
import type { TeamExecution } from '../decision/teamExecutionProjection'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { resolveCurrent31TeamFamily } from '../decision/current31TeamCoreAggregation'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { currentReviewedTeamSourceSlotSiblings } from '../gameDataPacks/reviewedTeamSourceDirections'
import { resolveTeamPresentationFamily } from './teamSourceFamilyProjection'

type TeamRecommendation = AccountDecisionSnapshot['teamEngine']['recommendations'][number]

export function defaultSchemeBangbooId(recommendation: TeamRecommendation) {
  if (recommendation.bangbooId) return recommendation.bangbooId
  const selection = recommendation.bangbooSelection
  if (!selection) return null
  if (selection.status === 'selected' || selection.status === 'compatible_fallback')
    return selection.bangbooId
  return null
}

const familyIdByKernelId = new Map(
  current31TeamEngineD1Pack.kernels.map((kernel) => [kernel.kernelId, kernel.familyId]),
)

/**
 * Presentation identity is sourced from the evaluated candidate or the active
 * pack. It deliberately never falls back to a display label.
 */
export function teamRecommendationFamilyId(recommendation: TeamRecommendation) {
  const projectedFamilyId = (recommendation as TeamRecommendation & { familyId?: string }).familyId
  return (
    projectedFamilyId ??
    (recommendation.kernelId ? familyIdByKernelId.get(recommendation.kernelId) : undefined) ??
    `kernel:${recommendation.kernelId ?? recommendation.candidateId}`
  )
}

export function teamRecommendationFamilyKey(recommendation: TeamRecommendation) {
  return resolveTeamPresentationFamily(recommendation.memberIds).familyId
}

export type DecisionTeamViewModel = {
  id: string
  templateId: string
  agentIds: string[]
  title: string
  coreAgentId: string
  familyId: string
  familyKey: string
  bangbooId: string | null
  scenario: string | null
  members: Array<{
    agentId: string
    role: string
    requiredAgentId: string
    substitution: 'none' | 'whitelist'
    currentPlan: {
      status: 'saved_plan' | 'decision_allocation' | 'unavailable'
      planId: string | null
    }
  }>
  strengthStatus: 'candidate' | 'limited'
  availability: 'direct' | 'needs_build'
  execution: TeamExecution | null
}

function isDirectExecution(execution: TeamExecution | null) {
  const discIds = execution?.members.flatMap((member) => member.suggested.discIds) ?? []
  return execution?.status === 'ready' && discIds.length === 18 && new Set(discIds).size === 18
}

export function decisionTeamViewModel(
  decision: AccountDecisionSnapshot,
  candidateId: string,
): DecisionTeamViewModel | null {
  if (!decision.teamEngine?.recommendations) return null
  const directCandidate = decision.teamEngine.recommendations.find(
    (item) => item.candidateId === candidateId,
  )
  const authority =
    decision.decisionAuthority?.status === 'ready'
      ? authorityConsumerRecommendations(decision.decisionAuthority).find(
          (item) => item.candidateId === candidateId,
        )
      : null
  const candidate =
    directCandidate ??
    (authority
      ? decision.teamEngine.recommendations.find(
          (item) =>
            [...item.memberIds].toSorted().join('|') ===
              [...authority.memberIds].toSorted().join('|') &&
            defaultSchemeBangbooId(item) === authority.bangbooId,
        )
      : null)
  if (!candidate && !authority) return null
  const memberIds = authority?.memberIds ?? candidate!.memberIds
  const unboundAuthorityForDirectCandidate =
    !authority && directCandidate && decision.decisionAuthority?.status === 'ready'
      ? authorityConsumerRecommendations(decision.decisionAuthority).find(
          (item) =>
            item.bangbooId === null &&
            [...item.memberIds].toSorted().join('|') ===
              [...directCandidate.memberIds].toSorted().join('|'),
        )
      : null
  // A bound Engine can provide its own captured presentation metadata. An
  // Authority-only Variant must never dereference a missing Engine or invent
  // an unbound Bangboo identity.
  const bangbooId = authority
    ? authority.bangbooId
    : unboundAuthorityForDirectCandidate
      ? null
      : candidate
        ? defaultSchemeBangbooId(candidate)
        : null
  // A modeled Engine formation without a source default remains reachable for
  // an explicit player choice. An Authority-only exact direction is likewise
  // inspectable with Bangboo left null; the detail route must ask the player
  // to choose rather than manufacture a Bangboo or discard the source fact.
  if (
    !authority &&
    !bangbooId &&
    (!directCandidate ||
      (directCandidate.bangbooSelection.status !== 'selected' &&
        directCandidate.bangbooSelection.status !== 'no_authoritative_recommendation' &&
        directCandidate.bangbooSelection.status !== 'compatible_fallback'))
  )
    return null
  const coordinated = decision.coordinationByTeamCount[1].teams.find(
    (team) => team.template.templateId === (candidate?.candidateId ?? candidateId),
  )
  const execution =
    decision.teamExecutions.find((item) => item.candidateId === candidateId) ??
    decision.teamExecutions.find((item) => item.candidateId === candidate?.candidateId) ??
    null
  const family = resolveTeamPresentationFamily(memberIds)
  return {
    id: candidateId,
    templateId: candidateId,
    agentIds: [...memberIds],
    title: localizedAgentNames(
      candidate?.label ??
        ('label' in family && family.status === 'aggregated'
          ? family.label
          : memberIds.map(getAgentName).join(' · ')),
      memberIds,
    ),
    coreAgentId: memberIds[0]!,
    familyId: candidate ? teamRecommendationFamilyId(candidate) : family.familyId,
    familyKey: candidate ? teamRecommendationFamilyKey(candidate) : family.familyId,
    bangbooId,
    scenario:
      candidate && candidate.scenarioTags.length
        ? `scenario:${[...candidate.scenarioTags].sort().join('+')}`
        : execution?.scenario?.tags.length
          ? execution.scenario.identity
          : null,
    members: memberIds.map((agentId) => ({
      agentId,
      role: '机制闭环成员',
      requiredAgentId: agentId,
      substitution: 'none',
      currentPlan: coordinated?.planIdsByAgent[agentId]
        ? { status: 'saved_plan', planId: coordinated.planIdsByAgent[agentId] }
        : decision.allocation.global.some((loadout) => loadout.agentId === agentId)
          ? { status: 'decision_allocation', planId: null }
          : { status: 'unavailable', planId: null },
    })),
    strengthStatus: decision.claims.overall.status === 'candidate' ? 'candidate' : 'limited',
    availability: bangbooId && isDirectExecution(execution) ? 'direct' : 'needs_build',
    execution,
  }
}

/**
 * Same-core variants come from the complete calibrated Authority workset, with
 * captured Engine variants retained for their presentation metadata. This only
 * projects the current Run; it neither solves nor promotes a candidate.
 */
export function decisionTeamAlternativeVariants(
  decision: AccountDecisionSnapshot,
  candidateId: string,
): DecisionTeamViewModel[] {
  const selectedEngine = decision.teamEngine.recommendations.find(
    (item) => item.candidateId === candidateId,
  )
  const selectedAuthority = authorityConsumerRecommendations(decision.decisionAuthority).find(
    (item) => item.candidateId === candidateId,
  )
  const selectedMemberIds = selectedAuthority?.memberIds ?? selectedEngine?.memberIds
  if (!selectedMemberIds) return []
  const authorityFamilyId = resolveCurrent31TeamFamily(selectedMemberIds).familyId
  const sameAuthorityFamily = authorityConsumerRecommendations(decision.decisionAuthority).filter(
    (candidate) => resolveCurrent31TeamFamily(candidate.memberIds).familyId === authorityFamilyId,
  )
  const sourceSlotSiblingKeys = new Set(
    currentReviewedTeamSourceSlotSiblings(selectedMemberIds).map((memberIds) =>
      [...memberIds].toSorted().join('|'),
    ),
  )
  const sameSourceSlotAuthority = authorityConsumerRecommendations(
    decision.decisionAuthority,
  ).filter((candidate) => sourceSlotSiblingKeys.has([...candidate.memberIds].toSorted().join('|')))
  const sameEngineFamily = selectedEngine
    ? decision.teamEngine.recommendations.filter(
        (candidate) =>
          teamRecommendationFamilyKey(candidate) === teamRecommendationFamilyKey(selectedEngine),
      )
    : []
  const seen = new Set<string>()
  const candidateIds = [
    candidateId,
    ...sameAuthorityFamily.map((candidate) => candidate.candidateId),
    ...sameSourceSlotAuthority.map((candidate) => candidate.candidateId),
    ...sameEngineFamily.map((candidate) => candidate.candidateId),
  ]
  return candidateIds
    .map((id) => decisionTeamViewModel(decision, id))
    .filter((candidate): candidate is DecisionTeamViewModel => Boolean(candidate))
    .filter((candidate) => {
      const identity = `${[...candidate.agentIds].sort().join('+')}|${candidate.bangbooId}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
}

/**
 * The current detail surface switches immediately, so it may expose only
 * variants that are fully executable. Callers needing build directions use
 * decisionTeamAlternativeVariants and must label them as needs_build.
 */
export function decisionTeamAlternatives(
  decision: AccountDecisionSnapshot,
  candidateId: string,
): DecisionTeamViewModel[] {
  return decisionTeamAlternativeVariants(decision, candidateId).filter(
    (candidate) => candidate.availability === 'direct',
  )
}
export function teamRatingSummary(ratingBand: string | null | undefined) {
  return !ratingBand || ratingBand === 'Experimental'
    ? '暂时无法判断这队的强弱'
    : `评级 ${ratingBand}`
}
