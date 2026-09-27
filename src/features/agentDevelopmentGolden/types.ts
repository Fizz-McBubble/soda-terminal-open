export type JourneyView = 'overview' | 'workbench' | 'top10'
export type JourneyScenario =
  | 'current'
  | 'ordinary'
  | 'stale'
  | 'incomplete'
  | 'conflict'
  | 'save-recovery'
  | 'empty-discs'

export type AgentSummary = {
  agentId: string
  name: string
  rarity: 'S' | 'A'
  attribute?: string
  specialty?: string
  favorite: boolean
  visual: {
    kind: 'avatar'
    src: string
    fallback: 'initials'
  }
  level: number
  mindscape: number
  status: '待确认' | '培养中' | '可继续' | '已有方案'
  guideNote: string
  plan?: string
  reliableTarget: boolean
  decisionAuthorityState?: 'ready' | 'unsupported' | 'stale'
  teamRating?: string
  cultivationPriority?: string
  confidence?: string
  nextTrainingSteps?: string[]
  trainingContext?: {
    hasPrioritySkillGap: boolean
    inSavedTeam: boolean
  }
}

export type DiscFact = {
  conflicts?: Array<{ agentId: string; name: string }>
  id: string
  label: string
  slot: number
  set: string
  image: string | null
  visual?: {
    entityType: 'drive_disc_set'
    entityId: string
    name: string
  }
  level: number
  main: string
  mainValue: string
  subs: Array<{ name: string; value: string; hits: number; effective?: boolean }>
  effective: string
  grade: 'A+' | 'A' | 'B+' | '未评定'
  score?: number
}

export type LoadoutRow = {
  rank: number
  label: string
  fit: string
  panel: string
  sets: string
  effective: string
  /** Null means the current baseline does not contain a complete six-disc record. */
  swaps: number | null
  conflict: string
  cost: string
  /** Kept empty until a same-context static DPS model is available. */
  staticDps: number | null
  statDeltaSummary: string
  finalStats: Record<string, number>
  /** Recorded 4/5/6 main-stat differences from this agent's candidate constraint. */
  mainStatDifferences?: string[]
  /** Absent when the current baseline has no complete six-disc record. */
  discIds?: [string, string, string, string, string, string]
}

/** Typed production input. It deliberately carries player-facing display facts
 * only; repositories and solver details stay in the route adapter. */
export type GoldenWorkbenchData = {
  agentId: string
  name: string
  rarity: string
  specialty: string
  level: number
  mindscape: number
  supportsPotential: boolean
  potential?: number
  engine: {
    name: string
    detail: string
    copyLabel?: string
    copyId?: string | null
    copies?: Array<{ copyId: string; label: string }>
    currentId?: string | null
    level?: number | null
    refinement?: number | null
    /** Read-only catalog directions; account facts are edited in My Assets. */
    options?: Array<{
      engineId: string
      label: string
      defaultRefinement: number
      group?: string
      visual?: { entityId: string; name: string }
    }>
    visual?: { entityId: string; name: string }
  }
  skills: Array<{ short: string; label: string; value: number | null }>
  planName?: string
  /** Comparison is available only after the user starts a read-only warehouse solve. */
  hasComparablePlan: boolean
  /** Number of frozen, complete warehouse candidates exposed by the current solve. */
  candidatePlanCount: number
  /** The candidate currently selected for preview and the single explicit save action. */
  selectedCandidateRank: number
  /** Optional read-only main-stat guidance for the selected candidate. */
  candidateDifferences?: string[]
  graduation: {
    skills: Array<{ label: string; recommended: string; priority: boolean }>
    /** Historical full-potential guide reference. It never changes current account skills or solver input. */
    potentialSkillReference?: {
      conditionLabel: string
      skills: Array<{ label: string; recommended: string }>
    }
    skillPriority: string[]
    panel: Array<{ name: string; value: string }>
    panelConditions?: readonly string[]
    teams: Array<{
      label: string
      members: string
      note?: string
      conditions?: readonly string[]
      visuals: Array<{ entityType: 'agent' | 'bangboo'; entityId: string; name: string }>
    }>
    engines: Array<{
      tier: '首选' | 'S级替代' | 'A级下位替代' | '候选方向'
      name: string
      /** Player-facing attribute direction mapped from the available data foundation. */
      bonus: string
      visual?: { entityId: string; name: string }
    }>
    engineConditions?: readonly string[]
    discs: {
      /** Authority-provided reading only, separate from automatic set suggestions. */
      historicalReferences?: readonly string[]
      unavailableReason?: string
      directionNote?: string
      sets: Array<
        {
          label: string
          warehouseRank?: number
          recommendationPriority?: number
          /** True only when the adopted source plan supplied a rank; default sort values are not ranks. */
          recommendationExplicitlyRanked?: boolean
          recommendationGroup?: string
          recommendationPurpose?: 'recommended' | 'conditional' | 'transition' | 'historical'
          /** Short player-facing prerequisite shown beside the direction name. */
          recommendationConditionHint?: string
          /** Complete adopted source wording retained in the on-demand explanation. */
          recommendationExplanation?: string
          twoPiecePriority?: import('../../pages/twoPieceRecommendationPriority').TwoPiecePriority
        } & (
          | {
              fourPiece: { entityId: string; name: string; effect: string }
              twoPiece: { entityId: string; name: string; effect: string }
              pieces?: never
            }
          | {
              pieces: Array<{ entityId: string; name: string; effect: string; count: 2 | 4 }>
              fourPiece?: never
              twoPiece?: never
            }
        )
      >
      mainStats: Array<{ slot: string; value: string }>
      mainStatAlternatives?: Array<{
        label: string
        condition: string
        sourceUrl: string
        sourceVersion: string | null
      }>
      subStats: string
    }
  }
  decisionGuide: {
    status: 'recommendation' | 'limited' | 'unavailable'
    recommendation: string
    accountFacts: string
    coverage: string[]
    gaps: string[]
    evidence: Array<{ label: string; detail: string }>
    /** A field is never promoted to missing_after_reuse without the Data Foundation gate. */
    gapDisposition: 'existing_evidence_unresolved' | 'missing_after_reuse'
  }
  panelFacts: Array<{ name: string; value: string; target?: string; focus?: boolean }>
  currentPanel: { availability: 'available' | 'unavailable'; summary: string; title?: string }
  valueBenchmark?: {
    comparison: import('../../calculation/valueBenchmarkComparison').ValueBenchmarkComparison
    stale: boolean
  }
  warehouseAnalysis: {
    inventoryTransition?: boolean
    status: 'idle' | 'ready' | 'unavailable'
    summary: string
    totalScore?: number
    effectiveLines?: number
    effectiveEnhancements?: number
    /** Candidate discs that differ from a complete current six-disc baseline. */
    replacementCount?: number
  }
  /** A historical plan is a recorded read-only six-disc reference, not a new warehouse solve. */
  mode?: 'current' | 'saved'
  discSource: '当前方案' | '当前已装备' | '仓库候选' | '未关联实体盘'
  discs: DiscFact[]
}

export type GoldenTop10Data = {
  currentPlan?: LoadoutRow
  agentName: string
  baseline: LoadoutRow
  candidates: LoadoutRow[]
  selectedCandidateRank?: number
  valueBenchmarks?: import('../../calculation/valueBenchmarkComparison').ValueBenchmarkComparison[]
  discs: DiscFact[]
  /** The 4–5 role-relevant metrics visible by default. */
  coreStats: Array<{ key: string; label: string; unit: '%' | ''; highlight: boolean }>
  /** Every attribute recorded on the compared six-disc candidates. */
  allStats: Array<{
    key: string
    label: string
    unit: '%' | ''
    highlight: boolean
    target?: string
  }>
  /** Prevent six-disc contribution totals from being mistaken for a final agent panel. */
  statPresentation: 'disc_contribution' | 'static_panel'
  /** Missing current six-disc facts must not be rendered as numeric zeroes. */
  baselineAvailability?: 'available' | 'unavailable'
  /** Identifies the six-disc comparison reference without treating a saved or generated plan as equipped. */
  baselineKind?: 'actual' | 'saved' | 'candidate' | 'none'
  baselineLabel?: string
  /** Frozen on explicit solve; retained while the player refreshes the warehouse. */
  snapshot?: { capturedAt: string; stale: boolean }
}

export type AgentDevelopmentGoldenProps = {
  initialView?: JourneyView
  scenario?: JourneyScenario
  directoryAgents?: AgentSummary[]
  onOpenAgent?: (agentId: string) => void
  onOpenSavedAgent?: (agentId: string) => void
  onContinueOptimization?: () => void
  onToggleFavorite?: (agentId: string) => void | Promise<void>
  onDeleteAgentPlan?: (agentId: string) => void
  workbench?: GoldenWorkbenchData
  top10?: GoldenTop10Data
  onNavigate?: (view: JourneyView) => void
  onSavePlan?: (candidateRank: number) => void | Promise<void>
  /** Changes the read-only candidate preview; it never writes account equipment. */
  onSelectCandidatePlan?: (candidateRank: number) => void
  /** Starts the page's bounded, read-only warehouse candidate solve. */
  onAnalyzeWarehouse?: () => void
  /** Replaces a prior frozen candidate snapshot with a fresh bounded, read-only solve. */
  onReanalyzeWarehouse?: () => void | Promise<void>
  /** Kept for isolated component tests; production always uses the shared AppShell. */
  embedded?: boolean
}
