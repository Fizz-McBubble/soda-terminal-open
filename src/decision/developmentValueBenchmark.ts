import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { compareValueBenchmarkSides } from '../calculation/valueBenchmarkComparison'
import { resolveWEngine } from './wEngineResolver'
import {
  evaluateDevelopmentValueBenchmarkSide,
  unsupportedSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmarkRuntime'

export {
  evaluateDevelopmentValueBenchmarkSide,
  type DevelopmentComparisonParameters,
} from './developmentValueBenchmarkRuntime'

export function projectDevelopmentValueBenchmarks(input: {
  warehouse: CoreWarehouse
  agentId: string
  baseline: DriveDisc[]
  candidates: CandidateWarehousePlan[]
  savedPlans?: readonly AccountPlanningDraft[]
  stale: boolean
  candidateParametersByRank?: Readonly<Record<number, DevelopmentComparisonParameters>>
}) {
  const validLoadout = (discs: readonly DriveDisc[]) =>
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6 &&
    discs.every((disc) => input.warehouse.discs.some((owned) => owned.id === disc.id))
  const saved = (input.savedPlans ?? [])
    .filter(
      (plan) =>
        plan.accountId === input.warehouse.accountId &&
        plan.kind === 'agent' &&
        plan.state === 'saved' &&
        plan.savedRole === 'current_reference' &&
        plan.selection.agentIds.length === 1 &&
        plan.selection.agentIds[0] === input.agentId &&
        plan.solutionContext?.scope === 'agent_independent',
    )
    .toSorted(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.revision - left.revision,
    )[0]
  const savedIds =
    saved?.warehouseRefs.length === 6
      ? saved.warehouseRefs
      : (saved?.candidateWarehouse?.loadouts.find((item) => item.agentId === input.agentId)
          ?.discIds ?? [])
  const savedDiscs = savedIds.flatMap((id) => {
    const disc = input.warehouse.discs.find((item) => item.id === id)
    return disc ? [disc] : []
  })
  const firstCandidateDiscs =
    input.candidates[0]?.loadouts
      .find((item) => item.agentId === input.agentId)
      ?.discs.map((item) => item.disc) ?? []
  const actualAvailable = validLoadout(input.baseline)
  const savedAvailable = validLoadout(savedDiscs)
  const candidateAvailable = validLoadout(firstCandidateDiscs)
  const accountAgent = input.warehouse.roster.agents.find(
    (agent) => agent.agentId === input.agentId,
  )
  const currentEngineRecorded = Boolean(
    resolveWEngine({
      agent: accountAgent,
      legacyWEngines: input.warehouse.roster.wEngines,
    }).current,
  )
  const engineLabel = currentEngineRecorded ? '已记录当前音擎' : '音擎未记录'
  const baselineDiscs = actualAvailable
    ? input.baseline
    : savedAvailable
      ? savedDiscs
      : candidateAvailable && input.candidates.length > 1
        ? firstCandidateDiscs
        : []
  const baselineLabel = actualAvailable
    ? `游戏当前实装（已记录六盘，${engineLabel}）`
    : savedAvailable
      ? `已保存方案「${saved!.name}」（按当前资产与${saved?.solutionContext?.comparisonParameters ? '保存的显式方案参数' : engineLabel}重算，非游戏实装）`
      : baselineDiscs.length
        ? '仓库方案 1（试算基线，非游戏实装）'
        : '没有第二份可比方案（非游戏实装）'
  const baseline = baselineDiscs.length
    ? evaluateDevelopmentValueBenchmarkSide({
        warehouse: input.warehouse,
        agentId: input.agentId,
        discs: baselineDiscs,
        stale: input.stale,
        parameters:
          !actualAvailable && savedAvailable
            ? saved?.solutionContext?.comparisonParameters
            : undefined,
      })
    : unsupportedSide({
        agentId: input.agentId,
        discs: [],
        engineKey: 'missing',
        state: input.stale ? 'stale' : 'unsupported',
        reasons: [
          input.candidates.length === 1
            ? '仅有一份有效方案，直接查看即可；没有相对游戏实装的提升结论。'
            : '未记录完整的游戏当前实装，也没有可用的保存方案或第二份候选。',
        ],
      })
  return input.candidates.map((plan, index) => {
    const discs = plan.loadouts[0]?.discs.map((item) => item.disc) ?? []
    const candidate = evaluateDevelopmentValueBenchmarkSide({
      warehouse: input.warehouse,
      agentId: input.agentId,
      discs,
      stale: input.stale,
      parameters: input.candidateParametersByRank?.[index + 1],
    })
    const changedDimensions = [
      ...(baseline.dimensions.potential === candidate.dimensions.potential
        ? []
        : (['potential'] as const)),
      ...(baseline.dimensions.disc_loadout === candidate.dimensions.disc_loadout
        ? []
        : (['disc_loadout'] as const)),
      ...(baseline.dimensions.w_engine === candidate.dimensions.w_engine
        ? []
        : (['w_engine'] as const)),
    ]
    return compareValueBenchmarkSides({
      baselineSource: actualAvailable
        ? { kind: 'actual', referenceId: null }
        : savedAvailable
          ? { kind: 'saved', referenceId: saved!.id }
          : baselineDiscs.length
            ? { kind: 'candidate', referenceId: 'rank:1' }
            : { kind: 'none', referenceId: null },
      baseline:
        !actualAvailable && !savedAvailable && index === 0
          ? unsupportedSide({
              agentId: input.agentId,
              discs: baselineDiscs,
              engineKey: candidate.dimensions.w_engine,
              state: input.stale ? 'stale' : 'unsupported',
              reasons: ['该方案是试算基线；自身不计算相对提升。'],
            })
          : baseline,
      candidate,
      changedDimensions,
      independentCounterfactual: changedDimensions.length === 1,
      labels: {
        baseline: baselineLabel,
        candidate: `仓库方案 ${index + 1}（六张实体盘，${input.candidateParametersByRank?.[index + 1]?.wEngine ? `显式音擎 ${candidate.dimensions.w_engine}，含音擎养成变化` : engineLabel}${input.candidateParametersByRank?.[index + 1]?.potential !== undefined ? '，显式潜能' : ''}）`,
      },
    })
  })
}
