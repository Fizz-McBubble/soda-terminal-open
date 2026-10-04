import type { DriveDisc } from '../domain/schemas'
import { projectOutOfCombatMenuPanel, type PanelInput } from '../calculation/outOfCombatPanel'
import {
  candidatePanelPolicyPrerequisites,
  getCandidatePanelPolicy,
  type CandidatePanelPolicy,
  type CandidatePanelPriorityStat,
} from '../gameDataPacks/candidatePanelPolicy'

export type CandidatePanelInput = Omit<PanelInput, 'discs'>
export const candidatePanelObjectiveVersion =
  'reviewed-attack-threshold-menu-white-priority-r3' as const
export type CandidatePanelObjective = {
  attackDeficit: number
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
  const policy = getCandidatePanelPolicy(agentId)
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
  if (!left || !right) return 0
  const priorityStat = left.priorityStat ?? 'anomalyProficiency'
  if (priorityStat !== (right.priorityStat ?? 'anomalyProficiency')) return 0
  return (
    left.attackDeficit - right.attackDeficit ||
    (right[priorityStat] ?? 0) - (left[priorityStat] ?? 0)
  )
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
  const panel = projectOutOfCombatMenuPanel({ ...panelInput, discs })
  if (panel.status !== 'ok') return undefined
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
  const anchorDiscs = [1, 2, 3, 4, 5, 6].flatMap(
    (slot) => eligible.find((disc) => disc.slot === slot) ?? [],
  )
  const anchor =
    objectiveTarget && panelInput
      ? projectOutOfCombatMenuPanel({ ...panelInput, discs: anchorDiscs })
      : null
  const objectiveEnabled = anchor?.status === 'ok'
  const baseAttack =
    anchor?.trace
      .filter((item) => item.key === 'atk' && item.operation === 'base')
      .reduce((sum, item) => sum + Number(item.value), 0) ?? 0
  const priorityBase =
    anchor?.trace
      .filter((item) => item.key === objectiveTarget?.priorityStat && item.operation === 'base')
      .reduce((sum, item) => sum + Number(item.value), 0) ?? 0
  const contributions = new Map<string, { attack: number; priority: number }>()
  if (objectiveEnabled && panelInput) {
    for (const disc of eligible) {
      const panel = projectOutOfCombatMenuPanel({
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
          .filter((item) => item.key === 'atk')
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
