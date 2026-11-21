import nestedDirections from './data/reviewed-team-nested-directions.3.1.json'
import type { ReviewedTeamOutputModuleEvidence } from './reviewedTeamOutputModuleEvidence'
import type { TeamOutputModule } from './teamOutputModuleContract'

type ModuleSpec = readonly [
  TeamOutputModule['primaryOutputKind'],
  TeamOutputModule['reactionMechanisms'],
  TeamOutputModule['executionChannels'],
  TeamOutputModule['teamFunctions'],
]
type Quote = readonly [op: number, start: number, end: number, text: string]
const byClaim = new Map(nestedDirections.records.map((row) => [row.claimId, row]))

export function reviewedNestedTeamModule(
  idPrefix: 'module-coverage-' | 'module-current-semantic-',
  claimId: string,
  memberIds: readonly [string, string, string],
  spec: ModuleSpec,
  quotes: readonly Quote[],
): ReviewedTeamOutputModuleEvidence {
  const source = byClaim.get(claimId)
  if (!source || [...source.memberIds].sort().join('|') !== [...memberIds].sort().join('|'))
    throw new Error(`Reviewed team source membership changed: ${claimId}`)
  return {
    memberIds,
    classification: 'historical_exact_team_review',
    module: {
      contract: 'soda-team-output-module/v1',
      id: `${idPrefix}${claimId.slice('reviewed-nested-'.length)}`,
      primaryOutputKind: spec[0],
      reactionMechanisms: spec[1],
      executionChannels: spec[2],
      teamFunctions: spec[3],
    },
    sourceEvidence: quotes.map(([op, start, end, text]) => ({
      sourceId: claimId,
      sourceVersion: source.source.sourceVersion,
      contentHash: source.nested.unitRawSha256,
      locator: `${source.source.url}#structured_content/op/${op}/text/${start}:${end};offset=UTF-16;archiveSha256=${source.source.archiveSha256}`,
      text,
    })),
  }
}
