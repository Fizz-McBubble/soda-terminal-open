import nestedDirections from './data/reviewed-team-nested-directions.3.1.json'
import strictBatch from './data/reviewed-team-output-modules.strict.3.1.json'
import strictNextBatch from './data/reviewed-team-output-modules.strict-next.3.1.json'
import strictRound3Batch from './data/reviewed-team-output-modules.strict-round3.3.1.json'
import strictRound4Batch from './data/reviewed-team-output-modules.strict-round4.3.1.json'
import strictRound5Batch from './data/reviewed-team-output-modules.strict-round5.3.1.json'
import type { ReviewedTeamOutputModuleEvidence } from './reviewedTeamOutputModuleEvidence'
import type { TeamOutputModule } from './teamOutputModuleContract'

const sourceById = new Map(nestedDirections.records.map((row) => [row.claimId, row]))

function toEvidence(entry: (typeof strictBatch.entries)[number]): ReviewedTeamOutputModuleEvidence {
  const source = sourceById.get(entry.claimId)
  if (
    !source ||
    [...source.memberIds].sort().join('|') !== [...entry.memberIds].sort().join('|') ||
    source.source.sourceVersion !== entry.sourceVersion ||
    source.nested.locator.opIndex !== entry.evidence.op ||
    source.nested.unitRawSha256 !== entry.evidence.unitRawSha256
  )
    throw new Error(`Reviewed team strict-batch source changed: ${entry.claimId}`)
  return {
    memberIds: entry.memberIds as [string, string, string],
    classification: 'historical_exact_team_review',
    module: {
      contract: 'soda-team-output-module/v1',
      id: entry.module.id,
      primaryOutputKind: entry.module.primaryOutputKind as TeamOutputModule['primaryOutputKind'],
      reactionMechanisms: entry.module.reactionMechanisms as TeamOutputModule['reactionMechanisms'],
      executionChannels: entry.module.executionChannels as TeamOutputModule['executionChannels'],
      teamFunctions: entry.module.teamFunctions as TeamOutputModule['teamFunctions'],
    },
    sourceEvidence: [
      {
        sourceId: entry.claimId,
        sourceVersion: entry.sourceVersion,
        contentHash: entry.evidence.unitRawSha256,
        locator: `${entry.url}#structured_content/op/${entry.evidence.op}/text/${entry.evidence.start}:${entry.evidence.end};offset=UTF-16;archiveSha256=${source.source.archiveSha256}`,
        text: entry.evidence.text,
      },
    ],
  } satisfies ReviewedTeamOutputModuleEvidence
}

const strictBatches = [
  strictBatch,
  strictNextBatch,
  strictRound3Batch,
  strictRound4Batch,
  strictRound5Batch,
]
if (
  strictBatches.some(
    (batch) =>
      batch.schema !== 'soda-reviewed-team-output-modules-strict-batch/v1' ||
      batch.sourceCount !== batch.entries.length,
  )
)
  throw new Error('Reviewed team strict-batch contract mismatch.')

export const reviewedTeamOutputModuleStrictBatch32 = strictBatches.flatMap((batch) =>
  batch.entries.map(toEvidence),
)
