import { getPlayerBuildKnowledgeProfile } from '../gameDataPacks/currentPlayerDevelopmentGuidance33'
import { severianSignatureCritCondition } from '../gameDataPacks/severianPlayerConditions33'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { resolveWEngine } from '../decision/wEngineResolver'
import type { DevelopmentComparisonPanels } from './publicDevelopmentComparisonPanels'

/** Identical source and account-engine evidence used by comparison and saving. */
export function projectDevelopmentSaveKnowledge(
  warehouse: CoreWarehouse,
  agentId: string,
): DevelopmentComparisonPanels['saveKnowledge'] {
  const agent = warehouse.roster.agents.find((item) => item.agentId === agentId)
  const profile = getPlayerBuildKnowledgeProfile(agentId)
  const engine = agent?.wEngineDetails
  const hasSignatureReference =
    agentId === 'agent-severian' &&
    engine &&
    severianSignatureCritCondition(engine.id, engine.refinement) !== null
  return {
    ...(hasSignatureReference && typeof engine.refinement === 'number'
      ? { severianSignatureRefinement: engine.refinement }
      : {}),
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
