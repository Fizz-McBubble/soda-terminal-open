import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkState,
  type ValueBenchmarkSide,
  type ValueBenchmarkComparison,
} from '../calculation/valueBenchmarkComparison'
import {
  resolveWEngine,
  defaultWEngineRefinement,
  type LegalWEngineCandidate,
  type ResolvedWEngine,
} from './wEngineResolver'
import {
  resolveCurrentPlanningScenario32,
  type CurrentPlanningScenarioSelection32,
} from '../calculation/currentPlanningScenario32'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'
import {
  evaluateDevelopmentValueBenchmarkSide,
  unsupportedSide,
} from './developmentValueBenchmarkRuntime'
import type { DevelopmentComparisonParameters } from './developmentValueBenchmark'

export type DevelopmentWEngineBenchmarkInput = {
  warehouse: CoreWarehouse
  agentId: string
  discs?: readonly DriveDisc[]
  plan?: CandidateWarehousePlan
  candidateEngines?: readonly (LegalWEngineCandidate | ResolvedWEngine)[]
  stale?: boolean
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclaration?: ReviewedTemplateEventConditionDeclaration32
  resourceGrantDeclaration32?: import('../calculation/sourceMechanismResourceGrants32').SourceResourceGrantDeclaration32
  progressionMode?:
    | 'account_owned_if_available'
    | 'actual_account_preferred'
    | 'theoretical_benchmark_only'
  parameters?: DevelopmentComparisonParameters
}

export type DevelopmentWEngineBenchmarkEntry = {
  candidate: LegalWEngineCandidate | ResolvedWEngine
  benchmark: ValueBenchmarkComparison
  planningDps: number | null
  planningDpsDelta: number | null
  planningDpsPercentDelta: number | null
  status: ValueBenchmarkState
  passiveState: 'active' | 'unobserved_conditions' | 'static_only' | 'inactive_mismatch'
  comparable: boolean
  comparableGroupIdentity: string
  partialOrderTier:
    | 'direct_comparable'
    | 'theoretical_comparable'
    | 'limited_coverage'
    | 'passive_inactive'
    | 'unsupported'
  tradeoffs: readonly string[]
}

export type DevelopmentWEngineBenchmarkResult = {
  contract: 'soda-development-w-engine-benchmarks/v1'
  agentId: string
  baselineSide: ReturnType<typeof evaluateDevelopmentValueBenchmarkSide>
  currentEngineRecorded: boolean
  entries: readonly DevelopmentWEngineBenchmarkEntry[]
  comparableGroupIdentities: readonly string[]
}

export function createComparableGroupIdentity(side: ValueBenchmarkSide): string {
  const target = side.dimensions?.subject ?? 'unknown_subject'
  const scenario = side.dimensions?.scenario ?? 'unknown_scenario'
  const eventSet = side.dimensions?.event_set ?? 'unknown_event_set'
  const duration = side.dimensions?.duration ?? 'unknown_duration'
  const formula = side.dimensions?.formula ?? 'unknown_formula'
  const coverageDomain = side.coverage?.domain ?? 'unknown_domain'
  const coverageFingerprint = side.coverage?.exclusionContextFingerprint ?? 'none'
  return `${target}::${scenario}::${eventSet}::${duration}::${formula}::${coverageDomain}::${coverageFingerprint}`
}

export function projectDevelopmentWEngineValueBenchmarks(
  input: DevelopmentWEngineBenchmarkInput,
  evaluate: typeof evaluateDevelopmentValueBenchmarkSide = evaluateDevelopmentValueBenchmarkSide,
): DevelopmentWEngineBenchmarkResult {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const validLoadout = (discs: readonly DriveDisc[]) =>
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6 &&
    discs.every((disc) => input.warehouse.discs.some((owned) => owned.id === disc.id))

  const accountAgent = input.warehouse.roster.agents.find(
    (agent) => agent.agentId === input.agentId,
  )

  const resolution = resolveWEngine({
    agent: accountAgent,
    legacyWEngines: input.warehouse.roster.wEngines,
    roster: input.warehouse.roster,
  })

  let loadoutDiscs: readonly DriveDisc[] = []
  if (input.discs && validLoadout(input.discs)) {
    loadoutDiscs = input.discs
  } else if (accountAgent?.equippedDiscIds) {
    const equipped = accountAgent.equippedDiscIds.flatMap((id) => {
      const disc = input.warehouse.discs.find((d) => d.id === id)
      return disc ? [disc] : []
    })
    if (validLoadout(equipped)) {
      loadoutDiscs = equipped
    }
  }

  const current = resolution.current
  const currentEngineRecorded = Boolean(current)
  const currentProgressionComplete = current && current.ascension != null

  const baselineSide =
    currentProgressionComplete && loadoutDiscs.length === 6
      ? evaluate({
          warehouse: input.warehouse,
          agentId: input.agentId,
          discs: [...loadoutDiscs],
          stale: input.stale ?? false,
          scenarioSelection: input.scenarioSelection,
          eventConditionDeclaration: input.eventConditionDeclaration,
          resourceGrantDeclaration32: input.resourceGrantDeclaration32,
          parameters: {
            ...input.parameters,
            wEngine: {
              engineId: current.engineId,
              level: current.level,
              ascension: current.ascension,
              refinement: current.refinement,
            },
          },
        })
      : unsupportedSide({
          agentId: input.agentId,
          discs: loadoutDiscs,
          engineKey: current
            ? `${current.engineId}:p${current.refinement}:lv${current.level}`
            : 'missing',
          state: input.stale ? 'stale' : 'unsupported',
          reasons: [
            !current
              ? '未记录当前实装音擎；不假定为未装备或0级。'
              : !currentProgressionComplete
                ? '当前音擎突破未录入，不能假定满破作为比较基线。'
                : '未记录六张完整驱动盘，无法试算音擎数值表现。',
          ],
          scenarioSelection: scenario.selection,
        })

  const candidatesToEvaluate = input.candidateEngines ?? resolution.legalCandidates ?? []

  const rawEntries: DevelopmentWEngineBenchmarkEntry[] = candidatesToEvaluate.map((cand) => {
    const owned = 'owned' in cand ? cand.owned : false
    const useTheoretical = input.progressionMode === 'theoretical_benchmark_only' || !owned

    const level = useTheoretical ? 60 : cand.level
    const refinement = useTheoretical ? defaultWEngineRefinement(cand.rarity) : cand.refinement
    const ascension = useTheoretical ? 5 : cand.ascension

    // Missing actual progression facts cannot be silently assumed as full or 1
    const missingProgressionFacts: string[] = []
    if (!useTheoretical) {
      if (level === null || level === undefined) {
        missingProgressionFacts.push('当前音擎未记录等级，不假定为0级或满级。')
      }
      if (refinement === null || refinement === undefined) {
        missingProgressionFacts.push('当前音擎未记录精炼阶数（P阶未知），不假定为P1或满精。')
      }
      if (ascension === null || ascension === undefined) {
        missingProgressionFacts.push('当前音擎未记录突破阶数，不假定为满破。')
      }
    }

    const candidateSide =
      missingProgressionFacts.length > 0
        ? unsupportedSide({
            agentId: input.agentId,
            discs: loadoutDiscs,
            engineKey: `${cand.engineId}:unknown_progression`,
            state: 'unsupported',
            reasons: missingProgressionFacts,
            scenarioSelection: scenario.selection,
          })
        : loadoutDiscs.length === 6
          ? evaluate({
              warehouse: input.warehouse,
              agentId: input.agentId,
              discs: [...loadoutDiscs],
              stale: input.stale ?? false,
              scenarioSelection: input.scenarioSelection,
              eventConditionDeclaration: input.eventConditionDeclaration,
              resourceGrantDeclaration32: input.resourceGrantDeclaration32,
              parameters: {
                ...input.parameters,
                wEngine: {
                  engineId: cand.engineId,
                  level: level!,
                  ascension: ascension ?? undefined,
                  refinement: refinement!,
                },
              },
            })
          : unsupportedSide({
              agentId: input.agentId,
              discs: loadoutDiscs,
              engineKey: `${cand.engineId}:p${refinement}:lv${level}`,
              state: input.stale ? 'stale' : 'unsupported',
              reasons: ['缺少六张完整驱动盘，无法试算音擎数值表现。'],
              scenarioSelection: scenario.selection,
            })

    const candidateLabel =
      cand.source === 'agent_current_fact'
        ? `${cand.name}（当前实装 Lv.${cand.level}/P${cand.refinement}）`
        : cand.source === 'legacy_copy_compat'
          ? `${cand.name}（仓库持有 Lv.${cand.level}/P${cand.refinement}）`
          : cand.source === 'account_owned'
            ? `${cand.name}（账号其他副本 Lv.${cand.level}/P${cand.refinement}）`
            : `${cand.name}（理论参考 Lv.${level}/P${refinement}）`

    const benchmark = compareValueBenchmarkSides({
      baselineSource: current
        ? { kind: 'actual', referenceId: null }
        : { kind: 'none', referenceId: null },
      baseline: baselineSide,
      candidate: candidateSide,
      changedDimensions: ['w_engine'],
      independentCounterfactual: true,
      labels: {
        baseline: current
          ? `当前实装音擎（${current.name} Lv.${current.level}/P${current.refinement}）`
          : '未记录当前实装音擎',
        candidate: candidateLabel,
      },
    })

    const passiveCompatibility =
      'passiveCompatibility' in cand ? cand.passiveCompatibility : 'matched'

    let passiveState: DevelopmentWEngineBenchmarkEntry['passiveState'] = 'active'
    if (passiveCompatibility === 'mismatched') {
      passiveState = 'inactive_mismatch'
    } else if (
      candidateSide.coverage?.excludedEffects?.some(
        (e) => e.effectKey.includes(cand.engineId) && e.reason.includes('静态目录'),
      )
    ) {
      passiveState = 'static_only'
    } else if (
      candidateSide.coverage?.excludedEffects?.some((e) => e.effectKey.includes(cand.engineId))
    ) {
      passiveState = 'unobserved_conditions'
    }

    const tradeoffs: string[] = []
    if (passiveState === 'inactive_mismatch') {
      tradeoffs.push('职业不匹配，音擎被动效果未激活。')
    } else if (passiveState === 'unobserved_conditions') {
      tradeoffs.push('固定事件切片缺少被动触发条件或累计状态，未假定满触发。')
    } else if (passiveState === 'static_only') {
      tradeoffs.push('音擎仅有静态目录，暂无已采用被动机制合同。')
    }
    if (useTheoretical && owned) {
      tradeoffs.push('按理论 60 级满培养试算，高于当前账号持有等级。')
    }

    if (
      baselineSide.state === 'supported' &&
      (!benchmark.comparable || benchmark.status !== 'supported')
    ) {
      tradeoffs.push('比较条件、场景或事件集不完全一致，无法直接计算相对基线差值。')
    }

    let partialOrderTier: DevelopmentWEngineBenchmarkEntry['partialOrderTier']
    if (candidateSide.state !== 'supported') {
      partialOrderTier = 'unsupported'
    } else if (passiveState === 'inactive_mismatch') {
      partialOrderTier = 'passive_inactive'
    } else if (
      passiveState === 'unobserved_conditions' ||
      passiveState === 'static_only' ||
      (baselineSide.state === 'supported' && benchmark.coverage.generalConclusion === 'limited')
    ) {
      partialOrderTier = 'limited_coverage'
    } else if (baselineSide.state === 'supported') {
      if (benchmark.comparable && benchmark.status === 'supported') {
        partialOrderTier = 'direct_comparable'
      } else {
        partialOrderTier = 'limited_coverage'
      }
    } else {
      // Baseline is unrecorded or unsupported: candidate forms an independent theoretical comparable group
      partialOrderTier = 'theoretical_comparable'
      tradeoffs.push(
        currentEngineRecorded
          ? '当前实装音擎养成或计算条件不完整，无法进行基准相对差值对比；候选仅在完整同条件组内排序。'
          : '未记录当前实装音擎，无法进行基准相对差值对比；保留为独立理论候选排序。',
      )
    }

    const comparableGroupIdentity =
      candidateSide.state === 'supported'
        ? createComparableGroupIdentity(candidateSide)
        : 'unsupported'

    // When comparable is false, relative deltas must strictly be null
    const planningDpsDelta = benchmark.comparable ? benchmark.planningDpsDelta : null
    const planningDpsPercentDelta = benchmark.comparable ? benchmark.planningDpsPercentDelta : null

    return {
      candidate: cand,
      benchmark,
      planningDps: candidateSide.planningDps,
      planningDpsDelta,
      planningDpsPercentDelta,
      status: benchmark.status,
      passiveState,
      comparable: benchmark.comparable,
      comparableGroupIdentity,
      partialOrderTier,
      tradeoffs,
    }
  })

  const tierOrder = (tier: DevelopmentWEngineBenchmarkEntry['partialOrderTier']) => {
    switch (tier) {
      case 'direct_comparable':
        return 0
      case 'theoretical_comparable':
        return 1
      case 'limited_coverage':
        return 2
      case 'passive_inactive':
        return 3
      case 'unsupported':
        return 4
    }
  }

  const entries = rawEntries.sort((left, right) => {
    const tierDiff = tierOrder(left.partialOrderTier) - tierOrder(right.partialOrderTier)
    if (tierDiff !== 0) return tierDiff

    // Within theoretical_comparable or direct_comparable, only candidates with identical comparableGroupIdentity are comparable
    if (left.comparableGroupIdentity !== right.comparableGroupIdentity) {
      return left.comparableGroupIdentity.localeCompare(right.comparableGroupIdentity)
    }

    if (
      (left.partialOrderTier === 'direct_comparable' ||
        left.partialOrderTier === 'theoretical_comparable' ||
        left.partialOrderTier === 'limited_coverage') &&
      left.planningDps !== null &&
      right.planningDps !== null
    ) {
      const dpsDiff = right.planningDps - left.planningDps
      if (dpsDiff !== 0) return dpsDiff
    }

    return left.candidate.name.localeCompare(right.candidate.name, 'zh-CN')
  })

  const distinctIdentities = [
    ...new Set(entries.map((e) => e.comparableGroupIdentity).filter((id) => id !== 'unsupported')),
  ]

  return {
    contract: 'soda-development-w-engine-benchmarks/v1',
    agentId: input.agentId,
    baselineSide,
    currentEngineRecorded,
    entries,
    comparableGroupIdentities: distinctIdentities,
  }
}
