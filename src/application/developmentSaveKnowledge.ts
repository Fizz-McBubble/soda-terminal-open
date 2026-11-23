import type { CoreWarehouse } from '../accounts/coreFlow'
import { resolveWEngine } from '../decision/wEngineResolver'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import type { DevelopmentComparisonPanels } from './publicDevelopmentComparisonPanels'

/** Identical source and account-engine evidence used by comparison and saving. */
export function projectDevelopmentSaveKnowledge(
  warehouse: CoreWarehouse,
  agentId: string,
): DevelopmentComparisonPanels['saveKnowledge'] {
  const agent = warehouse.roster.agents.find((item) => item.agentId === agentId)
  const profile = getProjectedBuildKnowledgeProfile(agentId)
  return {
    scenario: profile.scenario,
    profileId: profile.id,
    status: profile.status,
    version: profile.packageVersion,
    source: profile.sources
      .map((source) => source.label ?? '')
      .filter(Boolean)
      .join('、'),
    currentEngineRecorded: Boolean(
      resolveWEngine({ agent, legacyWEngines: warehouse.roster.wEngines }).current,
    ),
  }
}
