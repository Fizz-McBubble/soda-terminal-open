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
    : await import('./savedPlanGraduationCompletion')

export function GraduationCompletionLabel({
  completion,
}: {
  completion?: SavedTeamGraduationCardCompletion | null
}) {
  const discCompletion = completion?.discCompletion
  const memberText = completion?.members
    .map(
      (member) =>
        `${getAgentName(member.agentId)} ${member.status === 'scored' ? `${member.score}%${member.appliedConditions?.length ? `（${member.appliedConditions.join('；')}）` : ''}${member.limitations?.length ? `；未计入：${member.limitations.join('；')}` : ''}` : member.reason}`,
    )
    .join(' · ')
  const partial = completion?.members.some(
    (member) => member.status === 'scored' && member.limitations?.length,
  )
  const label =
    completion?.score != null
      ? `毕业完成度 ${completion.score}%${partial ? '（已核验部分）' : ''}`
      : '毕业完成度 待核对'
  const title =
    completion?.score != null
      ? `对照三名成员的毕业参考计算，成员等权，不含技能养成。${partial ? '仅统计有参考目标且可核对的属性，不代表全部毕业目标已达成。' : ''}${discCompletion ? `\n${discCompletion.reason}` : ''}${memberText ? `\n${memberText}` : ''}`
      : discCompletion
        ? `已保存方案的驱动盘数量。${completion?.reason ? `\n${completion.reason}` : ''}${memberText ? `\n${memberText}` : ''}\n${discCompletion.reason}${discCompletion.members.length ? `\n${discCompletion.members.map((member) => `${getAgentName(member.agentId)} ${member.savedCount}/${member.expectedCount}`).join(' · ')}` : ''}`
        : `当前方案暂无可用的毕业面板目标。${completion?.reason ? `\n${completion.reason}` : ''}`
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
    Partial<Pick<AccountPlanningDraft, 'warehouseRefs' | 'candidateWarehouse'>>
  warehouse?: Pick<CoreWarehouse, 'roster' | 'discs'>
  publicCompletion?: SavedTeamGraduationCompletion | null
}) {
  const completion = useMemo(() => {
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
  return <GraduationCompletionLabel completion={cardCompletion} />
}
