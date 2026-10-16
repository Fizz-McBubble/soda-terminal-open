import type { DriveDisc } from '../domain/schemas'
import {
  projectOutOfCombatMenuPanel,
  projectOutOfCombatPanel,
  type PanelInput,
} from '../calculation/outOfCombatPanel'
import { compareCandidatePanelPriority } from './candidateSearchFacts'
import {
  candidatePanelPolicyPrerequisites,
  getCandidatePanelPolicy,
  getCandidatePanelPolicyForContext,
  type CandidatePanelPolicy,
  type CandidatePanelPriorityStat,
} from '../gameDataPacks/candidatePanelPolicy'

export type CandidatePanelInput = Omit<PanelInput, 'discs'>
export const candidatePanelObjectiveVersion =
  'reviewed-initial-hp-and-attack-threshold-priority-r4' as const
export type CandidatePanelObjective = {
  attackDeficit: number
  hpDeficit?: number
  anomalyProficiency: number
  energyRegen?: number
  priorityStat?: CandidatePanelPriorityStat
}
export type CandidatePanelObjectiveTarget = CandidatePanelPolicy
export type CandidatePanelObjectiveStatus = 'applied' | 'limited' | 'unsupported'

type CandidateSetPlan = {
  pattern: '4+2' | '2+2+2'
  primarySets: readonly string[]
}

type ResolvedSetPlan = {
  pattern: '4+2' | '2+2+2'
  activeSets: readonly string[]
}

export function hasCandidatePanelObjective(agentId: string) {
  return getCandidatePanelPolicy(agentId) !== null
}

/** Only adopted executable targets belong here; ordinary guide ranges are not hard gates. */
export function getCandidatePanelObjectiveTarget(
  agentId: string,
  panelInput?: CandidatePanelInput,
): CandidatePanelObjectiveTarget | null {
  const policy =
    panelInput?.agentId === agentId
      ? getCandidatePanelPolicyForContext(agentId, {
          mindscape: panelInput.mindscape,
        })
      : getCandidatePanelPolicy(agentId)
  if (!policy || panelInput?.agentId !== agentId) return null
  return candidatePanelPolicyPrerequisites(policy, {
    // PanelInput stores Core A-F as 0-5; game-facing Core level is 2-7.
    coreLevel: panelInput.core + 2,
  }).coreSatisfied
    ? policy
    : null
}
export function compareCandidatePanelObjective(
  left?: CandidatePanelObjective,
  right?: CandidatePanelObjective,
) {
  return compareCandidatePanelPriority(left, right)
}

/** Keep a bounded search's threshold coordinate separate from its final local tie breaker. */
export function candidatePanelObjectiveBeamComparator<
  T extends { attack?: number; priority?: number },
>(target: CandidatePanelObjectiveTarget, base: number, tieBreak: (a: T, b: T) => number) {
  const threshold = target.minimumInitialHp ?? target.minimumAttack
  return (a: T, b: T) =>
    Math.min(threshold, base + b.attack!) - Math.min(threshold, base + a.attack!) ||
    b.priority! - a.priority! ||
    tieBreak(a, b)
}

export function candidatePanelObjectiveSupportsSetPlans(
  target: CandidatePanelObjectiveTarget | null,
  setPlans: readonly CandidateSetPlan[],
) {
  const requiredSet = target?.requiredFourPieceSet
  return (
    !requiredSet ||
    setPlans.some((plan) => plan.pattern === '4+2' && plan.primarySets.includes(requiredSet))
  )
}

export function candidatePanelObjectiveAppliesToSetPlan(
  target: CandidatePanelObjectiveTarget | null,
  setPlan: ResolvedSetPlan,
) {
  const requiredSet = target?.requiredFourPieceSet
  return !requiredSet || (setPlan.pattern === '4+2' && setPlan.activeSets[0] === requiredSet)
}

export function resolveCandidatePanelObjectiveStatus(input: {
  requested: boolean
  hasApplicableBuild: boolean
  hasOtherBuild: boolean
  searchLimited: boolean
}) {
  const mixedBranches = input.hasApplicableBuild && input.hasOtherBuild
  const status: CandidatePanelObjectiveStatus | undefined = !input.requested
    ? undefined
    : !input.hasApplicableBuild
      ? 'unsupported'
      : input.searchLimited || mixedBranches
        ? 'limited'
        : 'applied'
  return { status, mixedBranches }
}

export function candidatePanelObjectiveWarning(
  target: CandidatePanelObjectiveTarget,
  status: CandidatePanelObjectiveStatus,
  mixedBranches: boolean,
) {
  if (target.minimumInitialHp !== undefined)
    return status === 'unsupported'
      ? `初始生命目标所需核心技7或精确面板条件不足，保留来源候选顺序。`
      : `优先缩小初始生命${target.minimumInitialHp}缺口，达标后保留来源候选取舍；实际追加增益仍需队伍及以太帷幕条件。${status === 'limited' ? '本次搜索有界。' : ''}`
  const priority = target.priorityStat === 'energyRegen' ? '能量自动回复' : '异常精通'
  if (status === 'applied')
    return `已按攻击力${target.minimumAttack}前补攻击、达标后优先${priority}比较；仍为候选配装。`
  if (status === 'limited')
    return mixedBranches
      ? `仅在${target.requiredFourPieceSet}四件套候选内按攻击力${target.minimumAttack}后优先${priority}比较；其他物理分支保留普通候选顺序。`
      : `已按攻击力${target.minimumAttack}后优先${priority}比较；本次找到的方案可能仍有更合适的替代。`
  return `当前角色、音擎参数或套装前提不足，未按攻击力${target.minimumAttack}门槛比较，保留普通候选配装。`
}

export function projectCandidatePanelObjective(
  target: CandidatePanelObjectiveTarget,
  panelInput: CandidatePanelInput,
  discs: DriveDisc[],
): CandidatePanelObjective | undefined {
  const panel =
    target.minimumInitialHp === undefined
      ? projectOutOfCombatMenuPanel({ ...panelInput, discs })
      : projectOutOfCombatPanel({ ...panelInput, discs })
  if (panel.status !== 'ok') return undefined
  if (target.minimumInitialHp !== undefined) {
    if (!Number.isFinite(panel.values.hp)) return undefined
    return {
      attackDeficit: 0,
      hpDeficit: Math.max(0, target.minimumInitialHp - panel.values.hp),
      anomalyProficiency: panel.values.anomalyProficiency,
      priorityStat: 'source',
    }
  }
  return {
    attackDeficit: Math.max(0, target.minimumAttack - panel.values.atk),
    anomalyProficiency: panel.values.anomalyProficiency,
    ...(target.priorityStat === 'energyRegen'
      ? {
          priorityStat: 'energyRegen' as const,
          energyRegen: panel.values.energyRegen,
        }
      : {}),
  }
}

/** Prepare source-bound panel contributions before generic candidate pruning. */
export function prepareCandidatePanelObjective(
  agentId: string,
  eligible: readonly DriveDisc[],
  panelInput?: CandidatePanelInput,
) {
  const requestedTarget = getCandidatePanelPolicy(agentId)
  const wantsPanelObjective = requestedTarget !== null
  const objectiveTarget = getCandidatePanelObjectiveTarget(agentId, panelInput)
  const projectPanel =
    objectiveTarget?.minimumInitialHp === undefined
      ? projectOutOfCombatMenuPanel
      : projectOutOfCombatPanel
  const thresholdStat = objectiveTarget?.minimumInitialHp === undefined ? 'atk' : 'hp'
  const anchorDiscs = [1, 2, 3, 4, 5, 6].flatMap(
    (slot) => eligible.find((disc) => disc.slot === slot) ?? [],
  )
  const anchor =
    objectiveTarget && panelInput ? projectPanel({ ...panelInput, discs: anchorDiscs }) : null
  const objectiveEnabled = anchor?.status === 'ok'
  const baseAttack =
    anchor?.trace
      .filter((item) => item.key === thresholdStat && item.operation === 'base')
      .reduce((sum, item) => sum + Number(item.value), 0) ?? 0
  const priorityBase =
    anchor?.trace
      .filter((item) => item.key === objectiveTarget?.priorityStat && item.operation === 'base')
      .reduce((sum, item) => sum + Number(item.value), 0) ?? 0
  const contributions = new Map<string, { attack: number; priority: number }>()
  if (objectiveEnabled && panelInput) {
    for (const disc of eligible) {
      const panel = projectPanel({
        ...panelInput,
        discs: anchorDiscs.map((item) => (item.slot === disc.slot ? disc : item)),
      })
      if (panel.status !== 'ok') {
        contributions.clear()
        break
      }
      const trace = panel.trace.filter((item) => item.source.startsWith(`disc:${disc.id}:`))
      contributions.set(disc.id, {
        attack: trace
          .filter((item) => item.key === thresholdStat)
          .reduce(
            (sum, item) =>
              sum + Number(item.value) * (item.operation === 'percent' ? baseAttack / 100 : 1),
            0,
          ),
        priority: trace
          .filter((item) => item.key === objectiveTarget!.priorityStat)
          .reduce(
            (sum, item) =>
              sum + Number(item.value) * (item.operation === 'percent' ? priorityBase / 100 : 1),
            0,
          ),
      })
    }
  }
  const useObjective = objectiveEnabled && contributions.size === eligible.length
  return {
    wantsPanelObjective,
    useObjective,
    contributions,
    baseAttack,
    objectiveTarget,
    requestedTarget,
  }
}
