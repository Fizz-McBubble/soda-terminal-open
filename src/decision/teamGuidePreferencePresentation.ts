import { reviewedTeamPreferences } from './reviewedTeamPreferences'
import { reviewCurrent31ProductionPairwiseEvidence } from './current31ProductionPairwiseEvidence'
import {
  teamGuidePreferencePresentationSchema,
  type TeamGuidePreferencePresentation,
} from '../domain/teamGuidePreferencePresentation'
import type {
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewFamily,
} from '../pages/teamLoadoutOverviewTypes'
/** Private source/pairwise review; only existing rendered fields cross the query boundary. */
export function projectTeamGuidePreferencePresentation(
  memberIds: readonly string[],
): TeamGuidePreferencePresentation {
  const facts = reviewedTeamPreferences.forTeam(memberIds)
  const cautions = facts.flatMap((fact) =>
    reviewedTeamPreferences.performanceCautions.some((entry) => entry.claimId === fact.claimId)
      ? reviewCurrent31ProductionPairwiseEvidence(
          fact.preferredMemberIds,
          fact.alternativeMemberIds,
        ).comparisons.filter((row) => row.relation === 'opposes_preference')
      : [],
  )
  return teamGuidePreferencePresentationSchema.parse({
    contract: 'soda-team-guide-preference-presentation/v1',
    memberKey: [...memberIds].sort().join('|'),
    facts: facts.map(
      ({ claimId, preferredMemberIds, alternativeMemberIds, sourceVersion, reason }) => ({
        claimId,
        preferredMemberIds: [...preferredMemberIds],
        alternativeMemberIds: [...alternativeMemberIds],
        sourceVersion,
        reason,
      }),
    ),
    cautions: cautions.map(({ sourceUrl, evidenceVersion, phase, partition }) => ({
      sourceUrl,
      evidenceVersion,
      phase,
      partition,
    })),
  })
}
export function withTeamGuidePreferencePresentations(
  groups: readonly TeamLoadoutOverviewGroup[],
): TeamLoadoutOverviewGroup[] {
  const family = (value: TeamLoadoutOverviewFamily): TeamLoadoutOverviewFamily => ({
    ...value,
    variants: value.variants.map((item) => ({
      ...item,
      guidePreference: projectTeamGuidePreferencePresentation(item.agentIds),
    })),
  })
  return groups.map((group) => ({
    ...group,
    items: group.items.map(family),
    ...(group.referenceItems ? { referenceItems: group.referenceItems.map(family) } : {}),
  }))
}
