import { teamOutputModules, type TeamOutputModuleResolution } from './teamOutputModuleContract'
import { reviewedTeamOutputModuleBatch32 } from './reviewedTeamOutputModuleBatch32'
import { reviewedTeamOutputModuleCoverageExpansion32 } from './reviewedTeamOutputModuleCoverageExpansion32'
import { reviewedTeamOutputModuleCurrentSemanticBatch32 } from './reviewedTeamOutputModuleCurrentSemanticBatch32'
import { reviewedTeamOutputModuleStrictBatch32 } from './reviewedTeamOutputModuleStrictBatch32'
import { reviewedHoyoBuildCurrentOutputModules32 } from './reviewedHoyoBuildCurrentOutputModules32'

export type ReviewedTeamOutputModuleEvidence = {
  memberIds: readonly [string, string, string]
  classification:
    | 'current_exact_team_review'
    | 'current_aggregate_exact_team_observation'
    | 'historical_exact_team_review'
    | 'author_comparison_only'
  module: import('./teamOutputModuleContract').TeamOutputModule
  sourceEvidence?: readonly import('./teamOutputModuleContract').TeamOutputModuleSourceEvidence[]
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
  ...reviewedTeamOutputModuleBatch32,
  ...reviewedTeamOutputModuleCoverageExpansion32,
  ...reviewedTeamOutputModuleCurrentSemanticBatch32,
  ...reviewedTeamOutputModuleStrictBatch32,
  ...reviewedHoyoBuildCurrentOutputModules32,
  {
    memberIds: ['agent-koleda', 'agent-yixuan', 'agent-lucia'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.ruptureStun,
  },
  {
    memberIds: ['agent-koleda', 'agent-soldier-11', 'agent-lucy'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-sigrid', 'agent-norma', 'agent-astra'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-sigrid', 'agent-dialyn', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-sigrid', 'agent-lycaon', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.directStun,
  },
  {
    memberIds: ['agent-miyabi', 'agent-remielle', 'agent-velina'],
    classification: 'current_exact_team_review',
    module: teamOutputModules.anomalyLuminize,
  },
  {
    memberIds: ['agent-claret', 'agent-norma', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.sharpStun,
      id: 'module-claret-norma-rina-sharp-stun',
      teamFunctions: ['stun', 'support'],
    },
  },
  {
    memberIds: ['agent-claret', 'agent-koleda', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.sharpStun,
      id: 'module-claret-koleda-rina-sharp-stun',
      teamFunctions: ['stun', 'support'],
    },
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
  {
    memberIds: ['agent-claret', 'agent-lycaon', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.sharpStun,
      id: 'module-claret-lycaon-rina-sharp-stun',
      teamFunctions: ['stun', 'support'],
    },
    sourceEvidence: [
      {
        sourceId: 'prydwen-claret-3.2-lycaon-rina',
        sourceVersion: '3.2',
        contentHash: '7D89817F698377C78EE82FF059DF11CAD469553E755AF3CE78A877F92ACF9CF3',
        locator: 'https://www.prydwen.gg/zenless/characters/claret#teams-synergy;lineno=696',
        text: "Lycaon's Potential Unlock makes him a decent pick for Claret too.",
      },
    ],
  },
  {
    memberIds: ['agent-claret', 'agent-trigger', 'agent-nicole'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.sharpStun,
      id: 'module-claret-trigger-nicole-sharp-stun',
      teamFunctions: ['stun', 'support'],
    },
    sourceEvidence: [
      {
        sourceId: 'prydwen-claret-3.2-trigger-nicole',
        sourceVersion: '3.2',
        contentHash: '7D89817F698377C78EE82FF059DF11CAD469553E755AF3CE78A877F92ACF9CF3',
        locator: 'https://www.prydwen.gg/zenless/characters/claret#teams-synergy;lineno=699',
        text: 'The synergy here does ride on Trigger having her Signature for DEF Shred, but if field-time and buff/debuff upkeep is well managed, they make for good picks.',
      },
    ],
  },
] as const satisfies readonly ReviewedTeamOutputModuleEvidence[]

const evidenceByMemberKey = new Map<string, ReviewedTeamOutputModuleEvidence>(
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
    ...(evidence.sourceEvidence ? { sourceEvidence: evidence.sourceEvidence } : {}),
  }
}
