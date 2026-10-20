import { teamOutputModules, type TeamOutputModuleResolution } from './teamOutputModuleContract'

type ReviewedTeamOutputModuleEvidence = {
  memberIds: readonly [string, string, string]
  classification:
    | 'current_exact_team_review'
    | 'current_aggregate_exact_team_observation'
    | 'historical_exact_team_review'
    | 'author_comparison_only'
  module: (typeof teamOutputModules)[keyof typeof teamOutputModules]
}

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

/**
 * Exact-team classifications use reviewed source conditions rather than a
 * character specialty lookup. A team that is not listed remains unknown until
 * its own membership, role and execution evidence has been reviewed.
 */
export const reviewedTeamOutputModuleEvidence = [
  {
    memberIds: ['agent-miyabi', 'agent-remielle', 'agent-velina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.anomalyDisorder,
  },
  {
    memberIds: ['agent-claret', 'agent-norma', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.sharpStun,
  },
  {
    memberIds: ['agent-claret', 'agent-koleda', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.sharpStun,
  },
  {
    memberIds: ['agent-claret', 'agent-roxy', 'agent-rina'],
    classification: 'author_comparison_only',
    module: teamOutputModules.sharpStun,
  },
  {
    memberIds: ['agent-nekomata', 'agent-dialyn', 'agent-sunna'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-nekomata', 'agent-dialyn', 'agent-astra'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-dialyn', 'agent-lucia', 'agent-yixuan'],
    classification: 'current_aggregate_exact_team_observation',
    module: teamOutputModules.ruptureStun,
  },
  {
    memberIds: ['agent-soldier-0-anby', 'agent-trigger', 'agent-orphie-magus'],
    classification: 'current_aggregate_exact_team_observation',
    module: teamOutputModules.aftershockBackground,
  },
  {
    memberIds: ['agent-banyue', 'agent-dialyn', 'agent-lucia'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.ruptureStun,
  },
  {
    memberIds: ['agent-dialyn', 'agent-lucia', 'agent-yidhari'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.ruptureStun,
  },
  {
    memberIds: ['agent-dialyn', 'agent-lucia', 'agent-starlight-billy'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.ruptureUltimate,
  },
  {
    memberIds: ['agent-ju-fufu', 'agent-lucia', 'agent-starlight-billy'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.ruptureStun,
  },
  {
    memberIds: ['agent-aria', 'agent-sunna', 'agent-yuzuha'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.anomalyAbloom,
  },
  {
    memberIds: ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
    classification: 'historical_exact_team_review',
    module: teamOutputModules.anomalyPolarity,
  },
] as const satisfies readonly ReviewedTeamOutputModuleEvidence[]

const evidenceByMemberKey = new Map(
  reviewedTeamOutputModuleEvidence.map((entry) => [memberKey(entry.memberIds), entry]),
)

if (evidenceByMemberKey.size !== reviewedTeamOutputModuleEvidence.length)
  throw new Error('Reviewed team output-module evidence contains duplicate exact teams')

export function resolveReviewedTeamOutputModule(
  memberIds: readonly [string, string, string],
): TeamOutputModuleResolution | undefined {
  const evidence = evidenceByMemberKey.get(memberKey(memberIds))
  if (!evidence) return undefined
  return {
    status: 'classified',
    classification: evidence.classification,
    module: evidence.module,
  }
}
