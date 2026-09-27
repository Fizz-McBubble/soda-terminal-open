import { recommendTeamDeployment, type TeamDeploymentOrder } from '../decision/teamDeployment'
import { getAgentName } from '../application/publicRosterNames'
import { ExplanationPopover } from '../components/ExplanationPopover'

export function TeamDeploymentControl({
  memberIds,
  customOrder,
  disabled,
  onChange,
}: {
  memberIds: string[]
  customOrder?: readonly string[]
  disabled?: boolean
  onChange?: (order: TeamDeploymentOrder | undefined) => void
}) {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return null
  const recommended = recommendTeamDeployment({ memberIds })
  const current = recommendTeamDeployment({ memberIds, customOrder })
  const [first, second, third] = current.orderedMemberIds
  const hasRecommendation = !['unknown', 'conflict'].includes(recommended.status)
  const followsRecommendation = recommended.equivalentOrders.some((order) =>
    order.every((id, index) => id === current.orderedMemberIds[index]),
  )
  const description = `${customOrder ? '当前站位' : hasRecommendation ? '推荐站位' : '队伍站位'} · ${getAgentName(first)}首发`
  return (
    <div className="team-execution__deployment" aria-label="队伍站位">
      <span title={current.orderedMemberIds.map(getAgentName).join(' → ')}>{description}</span>
      {recommended.openingReason || recommended.handoffReasons.length ? (
        <ExplanationPopover label="站位说明">
          {customOrder && !followsRecommendation ? <p>当前站位与推荐切人顺序不同。</p> : null}
          {recommended.openingReason ? <p>{recommended.openingReason}</p> : null}
          {recommended.handoffReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          <p>首发可根据敌人和开场操作调整。</p>
        </ExplanationPopover>
      ) : null}
      {onChange ? (
        <div role="group" aria-label="调整站位">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([second, third, first])}
          >
            轮换首发
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([first, third, second])}
          >
            交换2、3号位
          </button>
          {customOrder && hasRecommendation ? (
            <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>
              恢复推荐
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
