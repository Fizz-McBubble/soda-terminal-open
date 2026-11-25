import { contentHash } from './contentHash'
import type { AccountPlanningDraft } from '../accounts/types'
import {
  isPersonalSavedAgentPlan,
  resolvePersonalReferenceDiscs,
} from '../accounts/personalCurrentReference'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import {
  characterPanelLabels,
  targetPanelPresentation,
} from '../pages/agentDevelopmentWorkbenchViewModel'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { canDisplayStaticPanelTarget } from '../gameDataPacks/targetPanelSemantics'
import { projectDevelopmentSaveKnowledge } from './developmentSaveKnowledge'
import { readSavedAgentComparisonContext } from './readSavedAgentComparisonContext'
import { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import { developmentComparisonParametersSchema } from '../accounts/developmentComparisonParametersSchema'
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
  const targetPanel = getCurrentBuildTargetPanel(input.agentId, {
    coreLevel: agent?.skillLevels.core,
    specialLevel: agent?.skillLevels.special,
    engineId: agent?.wEngineDetails?.id,
    engineRefinement: agent?.wEngineDetails?.refinement,
    mindscape: agent?.mindscape,
  })
  const targetPresentations = characterPanelLabels.map((label) => ({
    label,
    reference: targetPanelPresentation(targetPanel, label),
  }))
  const targetDisplayByLabel = Object.fromEntries(
    targetPresentations.flatMap(({ label, reference }) =>
      canDisplayStaticPanelTarget(targetPanel, label) && reference.value
        ? [[label, reference.value]]
        : [],
    ),
  )
  const targetConditionsByLabel = Object.fromEntries(
    targetPresentations.flatMap(({ label, reference }) =>
      reference.conditions.length ? [[label, [...reference.conditions]]] : [],
    ),
  )
  const savedDiscSets = input.drafts
    .filter(
      (draft) =>
        draft.accountId === input.warehouse.accountId &&
        isPersonalSavedAgentPlan(draft, input.agentId),
    )
    .flatMap((draft) => {
      const saved = readSavedAgentComparisonContext(draft, input.agentId)
      if (
        saved.parameters.wEngine.state === 'invalid' ||
        saved.parameters.potential.state === 'invalid' ||
        saved.parameters.independentDirection.state === 'invalid'
      )
        return []
      const resolved = resolvePersonalReferenceDiscs(draft, input.warehouse.discs)
      if (!resolved) return []
      return [
        {
          discs: resolved,
          parameters: saved.comparisonParameters,
        },
      ]
    })
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
      const engine = parameters?.wEngine
      const result = createAgentDevelopmentPanelProjection({
        agent: {
          ...agent,
          potentialImage: parameters?.potential ?? agent.potentialImage,
        },
        discs,
        candidateDiscIds: discs.map((disc) => disc.id),
        planWEngine: engine
          ? {
              id: engine.engineId,
              level: engine.level,
              ascension: engine.ascension,
              refinement: engine.refinement,
            }
          : undefined,
      }).result
      const direction = parameters?.independentDirection
      const validDirection =
        direction === undefined ||
        developmentComparisonParametersSchema.shape.independentDirection.safeParse(direction)
          .success
      const evaluation = validDirection
        ? evaluateDevelopmentRecordedDiscs(input.agentId, discs, {
            independentDirection: direction,
          })
        : null
      const discScore = evaluation
        ? {
            version: evaluation.version,
            basisFingerprint: evaluation.basisFingerprint,
            complete: evaluation.complete,
            setStatus: evaluation.setStatus,
            ...(evaluation.totalScore === undefined ? {} : { totalScore: evaluation.totalScore }),
            ...(evaluation.setScore === undefined ? {} : { setScore: evaluation.setScore }),
            ...(evaluation.effectiveLines === undefined
              ? {}
              : { effectiveLines: evaluation.effectiveLines }),
            ...(evaluation.effectiveEnhancements === undefined
              ? {}
              : { effectiveEnhancements: evaluation.effectiveEnhancements }),
          }
        : undefined
      entries.push({
        discFingerprint,
        ...(parameterFingerprint ? { parameterFingerprint } : {}),
        status: result.status,
        values: result.values,
        ...(discScore ? { discScore } : {}),
        ...(result.reason ? { reason: result.reason } : {}),
      })
    }
  return {
    contract: developmentComparisonPanelsContract,
    agentId: input.agentId,
    entries,
    targetDisplayByLabel,
    targetConditionsByLabel,
    saveKnowledge: projectDevelopmentSaveKnowledge(input.warehouse, input.agentId),
  }
}
