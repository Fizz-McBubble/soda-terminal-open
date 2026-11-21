import { useMemo } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import type { SavedTeamGraduationCompletion } from '../decision/savedTeamGraduationCompletion'
import { getAgentName } from '../application/publicRosterNames'
import {
  attachSavedTeamDiscCompletion,
  savedTeamDiscCompletion,
  type SavedTeamGraduationCardCompletion,
} from './savedTeamDiscCompletion'

const localGraduation =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true'
      ? null
      : await import('./savedPlanGraduationCompletion')

function playerTargetConditions(conditions: readonly string[] | undefined) {
  return (conditions ?? []).flatMap((condition) =>
    condition
      .split(/[；;。]/u)
      .map((part) => part.trim())
      .filter((part) => part && !/(?:不证明|未计入|尚未计入|未闭合|没有对应)/u.test(part)),
  )
}

export function GraduationCompletionLabel({
  completion,
  currentCultivation = false,
}: {
  completion?: SavedTeamGraduationCardCompletion | null
  currentCultivation?: boolean
}) {
  if (!completion || completion.status !== 'scored' || !Number.isFinite(completion.score))
    return null
  const memberText = completion.members
    .flatMap((member) => {
      if (member.status !== 'scored') return []
      const conditions = playerTargetConditions(member.appliedConditions)
      return [
        `${getAgentName(member.agentId)} ${member.score}%${conditions.length ? `（${conditions.join('；')}）` : ''}`,
      ]
    })
    .join(' · ')
  const label = `${currentCultivation ? '当前培养 · ' : ''}局外属性目标达成度 ${completion.score}%`
  const title = `成员的局外属性目标，按成员等权计算。${memberText ? `\n${memberText}` : ''}`
  return (
    <span className="team-graduation-completion" title={title} aria-label={`${label}。${title}`}>
      {label}
    </span>
  )
}

export function SavedPlanGraduationLabel({
  plan,
  warehouse,
  publicCompletion,
}: {
  plan: Pick<AccountPlanningDraft, 'teamExecutionSnapshot' | 'teamPortfolioSnapshot'> &
    Partial<Pick<AccountPlanningDraft, 'warehouseRefs' | 'candidateWarehouse' | 'solutionContext'>>
  warehouse?: Pick<CoreWarehouse, 'roster' | 'discs'>
  publicCompletion?: SavedTeamGraduationCompletion | null
}) {
  const completion = useMemo(() => {
    const executions =
      plan.teamPortfolioSnapshot?.executions ??
      (plan.teamExecutionSnapshot ? [plan.teamExecutionSnapshot] : [])
    if (
      !executions.length ||
      executions.some(
        (execution) =>
          execution.members?.length !== 3 ||
          execution.members.some(
            (member) =>
              member.suggested?.wEngine?.level == null ||
              member.suggested.wEngine.ascension == null ||
              member.suggested.wEngine.refinement == null,
          ) ||
          (execution.members.some((member) => member.cultivation !== undefined) &&
            !execution.members.every((member) => member.cultivation !== undefined)),
      )
    )
      return null
    const hasSavedCultivation = executions.map((execution) =>
      execution.members.every((member) => member.cultivation !== undefined),
    )
    if (hasSavedCultivation.some(Boolean) && !hasSavedCultivation.every(Boolean)) return null
    if (!localGraduation) return publicCompletion ?? null
    try {
      return localGraduation.savedPlanGraduationCompletion(plan, warehouse)
    } catch {
      // Legacy saved snapshots can omit the execution fields needed by the quantitative
      // projection; the independent disc reference fact remains safe to present.
      return null
    }
  }, [plan, publicCompletion, warehouse])
  const discCompletion = useMemo(() => savedTeamDiscCompletion(plan), [plan])
  const cardCompletion = useMemo(
    () => attachSavedTeamDiscCompletion(completion, discCompletion),
    [completion, discCompletion],
  )
  const executions =
    plan.teamPortfolioSnapshot?.executions ??
    (plan.teamExecutionSnapshot ? [plan.teamExecutionSnapshot] : [])
  const currentCultivation =
    executions.length > 0 &&
    executions.every(
      (execution) =>
        execution.members?.length === 3 &&
        execution.members.every((member) => member.cultivation === undefined),
    )
  return (
    <GraduationCompletionLabel
      completion={cardCompletion}
      currentCultivation={currentCultivation}
    />
  )
}
