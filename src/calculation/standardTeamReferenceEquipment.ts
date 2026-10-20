import { currentAgentDirectory } from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../domain/stableContentHash'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import {
  createStandardReferenceDiscSeed,
  standardReferenceDiscAllocationPolicy,
  standardReferenceDiscProposals,
  validateStandardReferenceDiscs,
} from './standardReferenceDiscAllocation'

export type StandardTeamReferenceMember = {
  agentId: string
  /** Bound by the consumer to S0/A6 and shared effective skills/potential. */
  referenceStateIdentity: string
  branches: readonly { identity: string; discs: readonly DriveDisc[] }[]
  /** The consumer supplies only source-qualified options; identity includes
   * their applicability and explicit runtime, not just an engine catalog ID. */
  engines: readonly { engineId: string; refinement: number; sourceIdentity: string }[]
}

export type StandardTeamReferenceSelection = {
  agentId: string
  referenceStateIdentity: string
  branchIdentity: string
  engineId: string
  refinement: number
  sourceIdentity: string
  discs: DriveDisc[]
}

export type StandardTeamReferenceEvaluation = {
  value: number
  coverageIdentity: string
}

export const standardTeamReferenceEquipmentPolicy = Object.freeze({
  id: 'standard-team-18-discs-3x48-shared-objective-bounded/v2',
  allocation: standardReferenceDiscAllocationPolicy,
  defaultMaxEvaluations: 256,
  frontierSize: 12,
  discreteSeedBudgetFraction: 0.5,
  discreteRevisitInterval: 8,
  searchCompleteness: 'bounded' as const,
  numericalStrengthAdjudication: false,
})

type OptionDiagnostic = {
  agentId: string
  branchIdentity: string
  engineId: string
  status: 'eligible' | 'ineligible'
  reason?: string
  evaluations: number
  unknown: number
  differentCoverage: number
}

type Option = { selection: StandardTeamReferenceSelection; diagnostic: OptionDiagnostic }
type State = { selections: StandardTeamReferenceSelection[]; value: number }

/** Diagonal enumeration reaches simultaneous changes while a baseline is
 * unknown, without requiring either single-member transition to be scoreable. */
function* discreteTeams(options: readonly Option[][]) {
  const maximum = options.reduce((sum, rows) => sum + rows.length - 1, 0)
  for (let diagonal = 0; diagonal <= maximum; diagonal++)
    for (let a = 0; a < options[0]!.length; a++)
      for (let b = 0; b < options[1]!.length; b++) {
        const c = diagonal - a - b
        if (c >= 0 && c < options[2]!.length)
          yield [options[0]![a]!, options[1]![b]!, options[2]![c]!].map((row) => row.selection)
      }
}

/** Coordinate changes and simultaneous two/three-member changes reuse the
 * allocator's exact physical proposals, always evaluated as one whole team. */
function* teamProposals(selections: readonly StandardTeamReferenceSelection[]) {
  const streams = selections.map((row) => standardReferenceDiscProposals(row.discs))
  while (true) {
    const batch = streams.map((stream) => stream.next())
    if (batch.every((row) => row.done)) return
    for (let actor = 0; actor < 3; actor++) {
      const proposal = batch[actor]!
      if (!proposal.done)
        yield selections.map((row, index) =>
          index === actor ? { ...row, discs: proposal.value } : row,
        )
    }
    for (let left = 0; left < 2; left++)
      for (let right = left + 1; right < 3; right++) {
        const a = batch[left]!,
          b = batch[right]!
        if (!a.done && !b.done)
          yield selections.map((row, index) =>
            index === left
              ? { ...row, discs: a.value }
              : index === right
                ? { ...row, discs: b.value }
                : row,
          )
      }
    if (batch.every((row) => !row.done))
      yield selections.map((row, index) => ({ ...row, discs: batch[index]!.value! }))
  }
}

export function selectStandardTeamReferenceEquipment(input: {
  members: readonly StandardTeamReferenceMember[]
  objectiveIdentity: string
  evaluate: (
    selections: readonly StandardTeamReferenceSelection[],
  ) => StandardTeamReferenceEvaluation | null
  maxEvaluations?: number
  /** Optional immutable complete reference. It is evaluated first, uses one
   * evaluation and must be supported; absence retains unknown-domain exploration. */
  initialReference?: readonly StandardTeamReferenceSelection[]
}) {
  const policy = standardTeamReferenceEquipmentPolicy
  const maxEvaluations = input.maxEvaluations ?? policy.defaultMaxEvaluations
  const optionDiagnostics: OptionDiagnostic[] = []
  let evaluations = 0,
    unknownEvaluations = 0,
    differentCoverageEvaluations = 0
  let invalidAssignments = 0,
    discreteEvaluations = 0,
    discEvaluations = 0,
    referenceEvaluations = 0
  let discreteExhausted = false
  const diagnostics = () => ({
    evaluations,
    maxEvaluations,
    unknownEvaluations,
    differentCoverageEvaluations,
    invalidAssignments,
    discreteEvaluations,
    discEvaluations,
    referenceEvaluations,
    allDiscreteCombinationsVisited: discreteExhausted,
    budgetExhausted: evaluations === maxEvaluations,
    searchCompleteness: 'bounded' as const,
    options: optionDiagnostics.map((row) => ({ ...row, visited: row.evaluations > 0 })),
  })
  const unsupported = (reason: string) => ({
    status: 'unsupported' as const,
    reason,
    diagnostics: diagnostics(),
  })
  if (!input.objectiveIdentity.trim()) return unsupported('标准三人配装需要明确的整队目标身份。')
  if (!Number.isInteger(maxEvaluations) || maxEvaluations < 1)
    return unsupported('整队目标求值总预算必须为正整数。')
  if (input.members.length !== 3 || new Set(input.members.map((row) => row.agentId)).size !== 3)
    return unsupported('标准三人配装需要精确三个不同成员。')
  const members = [...input.members].sort((a, b) => a.agentId.localeCompare(b.agentId))
  const options: Option[][] = []
  for (const member of members) {
    const agent = currentAgentDirectory.find((row) => row.id === member.agentId)
    if (
      !agent ||
      agent.releaseState !== 'released' ||
      !agent.accountOwnable ||
      !['S', 'A'].includes(agent.rarity ?? '') ||
      !member.referenceStateIdentity.trim()
    )
      return unsupported(`${member.agentId} 缺少当前S/A身份或标准培养身份。`)
    if (!member.branches.length || !member.engines.length)
      return unsupported(`${member.agentId} 缺少已核分支或音擎候选。`)
    if (
      new Set(member.branches.map((row) => row.identity)).size !== member.branches.length ||
      new Set(member.engines.map((row) => row.engineId)).size !== member.engines.length
    )
      return unsupported(`${member.agentId} 的分支或音擎身份重复。`)
    const rows: Option[] = []
    for (const branch of [...member.branches].sort((a, b) =>
      a.identity.localeCompare(b.identity),
    )) {
      const seed = createStandardReferenceDiscSeed(branch.discs)
      for (const engine of [...member.engines].sort((a, b) =>
        a.engineId.localeCompare(b.engineId),
      )) {
        const source = getCurrentWEngineStaticData(engine.engineId)
        const released = currentWEngineDirectory.find((row) => row.id === engine.engineId)
        const reason = !branch.identity.trim()
          ? '分支来源身份缺失。'
          : seed.status === 'unsupported'
            ? seed.reason
            : !engine.sourceIdentity.trim()
              ? '音擎适用与条件身份缺失。'
              : !source || released?.releaseState !== 'released' || !released.accountOwnable
                ? '音擎不在当前已发布候选中。'
                : source.specialty !== agent.specialty
                  ? '音擎职业不适用。'
                  : engine.refinement !== (source.rarity === 'S' ? 1 : 5)
                    ? '标准音擎精炼须为S1或A/B5。'
                    : undefined
        const diagnostic: OptionDiagnostic = {
          agentId: member.agentId,
          branchIdentity: branch.identity,
          engineId: engine.engineId,
          status: reason ? 'ineligible' : 'eligible',
          ...(reason ? { reason } : {}),
          evaluations: 0,
          unknown: 0,
          differentCoverage: 0,
        }
        optionDiagnostics.push(diagnostic)
        if (reason || seed.status !== 'supported') continue
        rows.push({
          diagnostic,
          selection: {
            agentId: member.agentId,
            referenceStateIdentity: member.referenceStateIdentity,
            branchIdentity: branch.identity,
            engineId: engine.engineId,
            refinement: engine.refinement,
            sourceIdentity: engine.sourceIdentity,
            discs: seed.discs,
          },
        })
      }
    }
    if (!rows.length) return unsupported(`${member.agentId} 没有合法48次与适用音擎组成的完整候选。`)
    options.push(rows)
  }
  const optionFor = (selection: StandardTeamReferenceSelection) =>
    options
      .flat()
      .find(
        (row) =>
          row.selection.agentId === selection.agentId &&
          row.selection.branchIdentity === selection.branchIdentity &&
          row.selection.engineId === selection.engineId,
      )!.diagnostic
  let coverageIdentity: string | undefined
  let best: State | undefined
  const seen = new Set<string>()
  const evaluate = (
    selections: StandardTeamReferenceSelection[],
    phase: 'discrete' | 'disc' | 'reference',
  ): State | undefined => {
    const ids = selections.flatMap((row) => row.discs.map((disc) => disc.id))
    if (
      ids.length !== 18 ||
      new Set(ids).size !== 18 ||
      selections.some((row) => !validateStandardReferenceDiscs(row.discs).valid)
    ) {
      invalidAssignments++
      return undefined
    }
    const key = stableContentHash(selections)
    if (seen.has(key) || evaluations >= maxEvaluations) return undefined
    seen.add(key)
    evaluations++
    if (phase === 'discrete') discreteEvaluations++
    else if (phase === 'reference') referenceEvaluations++
    else discEvaluations++
    const affected = selections.map(optionFor)
    affected.forEach((row) => row.evaluations++)
    // The callback receives isolated values; neither candidate exploration nor
    // a consumer's incidental mutations can modify the input or incumbent.
    const result = input.evaluate(structuredClone(selections))
    if (!result || !Number.isFinite(result.value) || !result.coverageIdentity?.trim()) {
      unknownEvaluations++
      affected.forEach((row) => row.unknown++)
      return undefined
    }
    if (coverageIdentity === undefined) coverageIdentity = result.coverageIdentity
    if (coverageIdentity !== result.coverageIdentity) {
      differentCoverageEvaluations++
      affected.forEach((row) => row.differentCoverage++)
      return undefined
    }
    const state = { selections, value: result.value }
    if (!best || state.value > best.value) best = state
    return state
  }
  type Entry = State & { proposals: Generator<StandardTeamReferenceSelection[]>; turn: number }
  const frontier: Entry[] = []
  let turn = 0
  const add = (state: State) =>
    frontier.push({ ...state, proposals: teamProposals(state.selections), turn: turn++ })
  const order = (a: Entry, b: Entry) => b.value - a.value || a.turn - b.turn
  const trim = () => {
    frontier.sort(order)
    frontier.length = Math.min(frontier.length, policy.frontierSize)
  }
  if (input.initialReference) {
    const reference = structuredClone([...input.initialReference])
    if (
      reference.length !== 3 ||
      new Set(reference.map((row) => row.agentId)).size !== 3 ||
      reference.some((row) => {
        const member = members.find((member) => member.agentId === row.agentId)
        const branch = member?.branches.find((branch) => branch.identity === row.branchIdentity)
        return (
          !member ||
          !options
            .flat()
            .some(
              ({ selection }) =>
                selection.agentId === row.agentId &&
                selection.branchIdentity === row.branchIdentity &&
                selection.engineId === row.engineId &&
                selection.refinement === row.refinement &&
                selection.sourceIdentity === row.sourceIdentity,
            ) ||
          member.referenceStateIdentity !== row.referenceStateIdentity ||
          !branch ||
          !member.engines.some(
            (engine) =>
              engine.engineId === row.engineId &&
              engine.refinement === row.refinement &&
              engine.sourceIdentity === row.sourceIdentity,
          ) ||
          row.discs.some(
            (disc) =>
              !branch.discs.some(
                (template) =>
                  template.slot === disc.slot &&
                  template.mainStat === disc.mainStat &&
                  template.setId === disc.setId,
              ),
          )
        )
      })
    )
      return unsupported('显式标准参考不属于该合法候选域。')
    const state = evaluate(reference, 'reference')
    if (!state) return unsupported('显式完整标准参考目标未知，不能改用首候选作为参考。')
    add(state)
  }
  const discrete = discreteTeams(options)
  const nextDiscrete = () => {
    const next = discrete.next()
    if (next.done) {
      discreteExhausted = true
      return
    }
    const state = evaluate(next.value, 'discrete')
    if (state) add(state)
    trim()
  }
  const initialDiscreteBudget = Math.max(
    1,
    Math.floor(maxEvaluations * policy.discreteSeedBudgetFraction),
  )
  while (
    !discreteExhausted &&
    evaluations < maxEvaluations &&
    (evaluations < initialDiscreteBudget || !best)
  )
    nextDiscrete()
  let sinceDiscrete = 0
  while (evaluations < maxEvaluations && (frontier.length || !discreteExhausted)) {
    if (
      !discreteExhausted &&
      (!frontier.length || sinceDiscrete >= policy.discreteRevisitInterval)
    ) {
      nextDiscrete()
      sinceDiscrete = 0
      continue
    }
    trim()
    const current = frontier.shift()
    if (!current) break
    const next = current.proposals.next()
    if (next.done) continue
    current.turn = turn++
    frontier.push(current)
    const before = evaluations
    const state = evaluate(next.value, 'disc')
    sinceDiscrete += evaluations - before
    if (state) add(state)
    trim()
  }
  if (!best || !coverageIdentity)
    return unsupported('预算内没有来源与覆盖范围已闭合的完整三人48次配装。')
  const selections = structuredClone(best.selections)
  return {
    status: 'supported' as const,
    selections,
    value: best.value,
    coverageIdentity,
    objectiveIdentity: input.objectiveIdentity,
    identity: stableContentHash({
      policy,
      members,
      objectiveIdentity: input.objectiveIdentity,
      maxEvaluations,
      initialReference: input.initialReference ?? null,
      selections,
      coverageIdentity,
      value: best.value,
    }),
    diagnostics: diagnostics(),
    policy,
  }
}
