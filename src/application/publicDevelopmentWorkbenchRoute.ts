import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden'
import type { DriveDisc } from '../domain/schemas'
import type { evaluateDevelopmentRecordedDiscs } from '../pages/developmentRecordedDiscEvaluation'
import type { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import type { createAgentDevelopmentWorkbenchViewModel } from '../pages/agentDevelopmentWorkbenchViewModel'
import type { RosterAgent } from '../assault/types'
import type { DevelopmentWorkbenchEquipmentDecision } from './publicDevelopmentWorkbenchPresentation'
import { contentHash } from './contentHash'

export type DevelopmentCurrentRecord = {
  accountId: string
  agent: Pick<
    RosterAgent,
    | 'agentId'
    | 'owned'
    | 'level'
    | 'ascension'
    | 'mindscape'
    | 'potentialImage'
    | 'skillLevels'
    | 'wEngineDetails'
    | 'observedFacts'
  >
  revision: string
  selectedDiscIds: string[]
}

export function developmentCurrentRecordAgent(
  agent: RosterAgent,
): DevelopmentCurrentRecord['agent'] {
  const {
    agentId,
    owned,
    level,
    ascension,
    mindscape,
    potentialImage,
    skillLevels,
    wEngineDetails,
    observedFacts,
  } = agent
  return {
    agentId,
    owned,
    level,
    ascension,
    mindscape,
    potentialImage,
    skillLevels,
    wEngineDetails,
    observedFacts,
  }
}

export function developmentCurrentRecordBinding(record: DevelopmentCurrentRecord) {
  return contentHash([
    record.accountId,
    record.agent.agentId,
    record.revision,
    record.selectedDiscIds,
  ])
}

export type DevelopmentWorkbenchRouteSelection = {
  /** Explicit return from retain-current comparison; legacy routes retain saved-plan fallback. */
  preferEquipped?: true
  agentId: string
  requestedPlanId: string | null
  candidateRank: number | null
  /** Assert an exact loadout from the separately captured candidate Query response. */
  candidateLoadoutFingerprint: string | null
}

/** Comparison intent, deliberately separate from current account equipment. */
export type DevelopmentComparisonTarget = {
  source: 'saved_plan' | 'candidate'
  wEngine: {
    engineId: string
    name: string
    level: number
    ascension?: number
    refinement: number
  } | null
  /** Null means the saved record did not capture this target dimension. */
  potential: number | null
}

export type DevelopmentWorkbenchRoutePresentation = {
  contract: 'soda-development-workbench-route/v1'
  runId: string
  accountId: string
  inputFingerprint: string
  selection: DevelopmentWorkbenchRouteSelection
  status: 'ready' | 'missing' | 'references_changed' | 'candidate_mismatch'
  selectedDiscFingerprint: string | null
  source: '仓库候选' | '当前方案' | '当前已装备' | '未关联实体盘' | null
  panel: Pick<ReturnType<typeof createAgentDevelopmentPanelProjection>, 'source' | 'result'> | null
  setRecommendations: GoldenWorkbenchData['graduation']['discs']['sets']
  recordedEvaluation: ReturnType<typeof evaluateDevelopmentRecordedDiscs>
  discFacts: GoldenWorkbenchData['discs']
  workbench: ReturnType<typeof createAgentDevelopmentWorkbenchViewModel> | null
  graduationPanel: GoldenWorkbenchData['graduation']['panel']
  /** Narrow per-agent equipment projection; older in-memory fixtures may omit it. */
  equipment?: DevelopmentWorkbenchEquipmentDecision | null
  /** A saved-record panel refresh is separate from the captured run's recommendations. */
  currentRecordBinding?: string
  /** Present for saved plans and parameterized candidates; current-only routes leave it absent. */
  comparisonTarget?: DevelopmentComparisonTarget
}

function hasValidComparisonTarget(value: unknown): value is DevelopmentComparisonTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const target = value as Partial<DevelopmentComparisonTarget>
  const targetPotential = target.potential
  const targetEngine = target.wEngine
  return (
    (target.source === 'saved_plan' || target.source === 'candidate') &&
    (targetPotential === null ||
      (Number.isInteger(targetPotential) && targetPotential! >= 0 && targetPotential! <= 6)) &&
    (targetEngine === null ||
      (Boolean(targetEngine) &&
        typeof targetEngine?.engineId === 'string' &&
        targetEngine.engineId.length > 0 &&
        typeof targetEngine.name === 'string' &&
        targetEngine.name.length > 0 &&
        Number.isInteger(targetEngine.level) &&
        targetEngine.level >= 0 &&
        targetEngine.level <= 60 &&
        (targetEngine.ascension === undefined ||
          (Number.isInteger(targetEngine.ascension) &&
            targetEngine.ascension >= 0 &&
            targetEngine.ascension <= 5)) &&
        Number.isInteger(targetEngine.refinement) &&
        targetEngine.refinement >= 1 &&
        targetEngine.refinement <= 5))
  )
}

export function isCurrentDevelopmentWorkbenchRoute(
  value: DevelopmentWorkbenchRoutePresentation | undefined,
  expected: {
    runId: string
    accountId: string
    inputFingerprint: string
    selection: DevelopmentWorkbenchRouteSelection
    selectedDiscs: DriveDisc[]
  },
  fingerprint: (discs: DriveDisc[]) => string,
) {
  return Boolean(
    value?.contract === 'soda-development-workbench-route/v1' &&
    value.currentRecordBinding === undefined &&
    value.runId === expected.runId &&
    value.accountId === expected.accountId &&
    value.inputFingerprint === expected.inputFingerprint &&
    value.selection.agentId === expected.selection.agentId &&
    value.selection.requestedPlanId === expected.selection.requestedPlanId &&
    value.selection.preferEquipped === expected.selection.preferEquipped &&
    value.selection.candidateRank === expected.selection.candidateRank &&
    value.selection.candidateLoadoutFingerprint ===
      expected.selection.candidateLoadoutFingerprint &&
    (value.comparisonTarget === undefined || hasValidComparisonTarget(value.comparisonTarget)) &&
    (!expected.selection.requestedPlanId || value.comparisonTarget !== undefined) &&
    value.status === 'ready' &&
    value.selectedDiscFingerprint === fingerprint(expected.selectedDiscs) &&
    Array.isArray(value.setRecommendations) &&
    Array.isArray(value.discFacts) &&
    Array.isArray(value.workbench?.slices.currentPanel.facts) &&
    Array.isArray(value.graduationPanel),
  )
}
