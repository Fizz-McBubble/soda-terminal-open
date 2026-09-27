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
    .map((draft) => input.warehouse.discs.filter((disc) => draft.warehouseRefs.includes(disc.id)))
  const discSets = [
    input.baseline,
    ...input.candidates.map(
      (candidate) => candidate.loadouts[0]?.discs.map((item) => item.disc) ?? [],
    ),
    ...savedDiscSets,
  ]
  const seen = new Set<string>()
  const entries: DevelopmentComparisonPanels['entries'] = []
  if (agent?.owned)
    for (const discs of discSets) {
      const discFingerprint = developmentPanelDiscFingerprint(discs)
      if (seen.has(discFingerprint)) continue
      seen.add(discFingerprint)
      const result = createAgentDevelopmentPanelProjection({
        agent,
        discs,
        candidateDiscIds: discs.map((disc) => disc.id),
      }).result
      entries.push({
        discFingerprint,
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
