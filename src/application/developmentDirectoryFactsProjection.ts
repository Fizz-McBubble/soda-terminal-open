import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { projectDevelopmentDirectorySourceTargets } from './developmentDirectorySourceTargets'
import {
  developmentDirectoryFactsFingerprint,
  type DevelopmentDirectoryFacts,
  type DevelopmentDirectoryFactsRequest,
} from './publicDevelopmentDirectoryFacts'

/** Read only source-backed targets; account-wide authority has not been evaluated. */
export function projectDevelopmentDirectoryFacts(
  request: DevelopmentDirectoryFactsRequest,
): DevelopmentDirectoryFacts {
  const eligible = new Set(
    publicDevelopmentDirectoryCatalog
      .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
      .map((entry) => entry.stableId),
  )
  return {
    contract: 'soda-development-directory-facts/v1',
    authority: 'not_evaluated',
    accountId: request.input.warehouse.accountId ?? '',
    inputFingerprint: developmentDirectoryFactsFingerprint(request),
    decisions: request.input.warehouse.roster.agents
      .filter((agent) => agent.owned && eligible.has(agent.agentId))
      .map(projectDevelopmentDirectorySourceTargets),
  }
}
