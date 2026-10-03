import { contentHash } from './contentHash'
import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import {
  characterPanelLabels,
  targetPanelDisplayValue,
} from '../pages/agentDevelopmentWorkbenchViewModel'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { resolveWEngine } from '../decision/wEngineResolver'
import {
  developmentComparisonPanelsContract,
  developmentPanelDiscFingerprint,
  type DevelopmentComparisonPanels,
} from './publicDevelopmentComparisonPanels'

/** Private Query side: project the panels used by the captured comparison, including saved baselines. */
export function projectDevelopmentComparisonPanels(input: {
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
  agentId: string
  baseline: DriveDisc[]
  candidates: CandidateWarehousePlan[]
  candidateParametersByRank?: Readonly<
    Record<number, import('../decision/developmentValueBenchmark').DevelopmentComparisonParameters>
  >
}): DevelopmentComparisonPanels {
  const agent = input.warehouse.roster.agents.find((item) => item.agentId === input.agentId)
  const profile = getProjectedBuildKnowledgeProfile(input.agentId)
  const targetPanel = getCurrentBuildTargetPanel(input.agentId)
  const targetDisplayByLabel = Object.fromEntries(
    characterPanelLabels.flatMap((label) => {
      const target = targetPanel ? targetPanelDisplayValue(targetPanel, label) : null
      return target ? [[label, target]] : []
    }),
  )
  const savedDiscSets = input.drafts
    .filter(
      (draft) =>
        draft.accountId === input.warehouse.accountId &&
        draft.kind === 'agent' &&
        draft.state === 'saved' &&
        draft.selection.agentIds.length === 1 &&
        draft.selection.agentIds[0] === input.agentId,
    )
    .map((draft) => ({
      discs: input.warehouse.discs.filter((disc) => draft.warehouseRefs.includes(disc.id)),
      parameters: draft.solutionContext?.comparisonParameters,
    }))
  const discSets = [
    { discs: input.baseline, parameters: undefined },
    ...input.candidates.map((candidate, index) => ({
      discs: candidate.loadouts[0]?.discs.map((item) => item.disc) ?? [],
      parameters: input.candidateParametersByRank?.[index + 1],
    })),
    ...savedDiscSets,
  ]
  const seen = new Set<string>()
  const entries: DevelopmentComparisonPanels['entries'] = []
  if (agent?.owned)
    for (const { discs, parameters } of discSets) {
      const discFingerprint = developmentPanelDiscFingerprint(discs)
      const parameterFingerprint = parameters ? contentHash(parameters) : undefined
      const key = `${discFingerprint}:${parameterFingerprint ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const result = createAgentDevelopmentPanelProjection({
        agent: {
          ...agent,
          potentialImage: parameters?.potential ?? agent.potentialImage,
          wEngineDetails: parameters?.wEngine
            ? {
                id: parameters.wEngine.engineId,
                name: parameters.wEngine.engineId,
                level: parameters.wEngine.level,
                ascension: parameters.wEngine.ascension,
                refinement: parameters.wEngine.refinement,
              }
            : agent.wEngineDetails,
        },
        discs,
        candidateDiscIds: discs.map((disc) => disc.id),
      }).result
      entries.push({
        discFingerprint,
        ...(parameterFingerprint ? { parameterFingerprint } : {}),
        status: result.status,
        values: result.values,
        ...(result.reason ? { reason: result.reason } : {}),
      })
    }
  return {
    contract: developmentComparisonPanelsContract,
    agentId: input.agentId,
    entries,
    targetDisplayByLabel,
    saveKnowledge: {
      scenario: profile.scenario,
      profileId: profile.id,
      status: profile.status,
      version: profile.packageVersion,
      source: profile.sources
        .map((source) => source.label ?? '')
        .filter(Boolean)
        .join('、'),
      currentEngineRecorded: Boolean(
        resolveWEngine({ agent, legacyWEngines: input.warehouse.roster.wEngines }).current,
      ),
    },
  }
}
