import { useState } from 'react'
import { playerErrorMessage } from '../application/playerErrorMessage'
import {
  getTeamPortfolioPreference,
  restoreDefaultTeamRecommendation,
} from '../accounts/teamPortfolioPreference'

export function TeamConstraintResetPanel({
  accountId,
  activeCount,
  teamCount,
  blocked = false,
}: {
  accountId: string | null | undefined
  activeCount: number
  teamCount: number
  blocked?: boolean
}) {
  const [message, setMessage] = useState('')
  const restore = async () => {
    if (!accountId) return
    try {
      const preference = await getTeamPortfolioPreference(accountId)
      await restoreDefaultTeamRecommendation(accountId, preference)
      setMessage('已恢复默认推荐，请重新分析当前队伍。')
    } catch (error) {
      setMessage(playerErrorMessage(error, '恢复默认推荐失败。'))
    }
  }
  return (
    <section
      className={`f5v-box-analysis-stale${blocked ? ' f5v-box-constraint-blocked' : ''}`}
      role="status"
    >
      <div>
        <h2>{blocked ? '当前固定条件无法同时满足' : '当前存在固定条件'}</h2>
        {blocked ? (
          <p>当前固定条件无法同时满足，暂时没有可直接执行的完整队伍。</p>
        ) : (
          <p>
            {activeCount} 项固定成员、邦布、队伍或方案条件，队伍数量为 {teamCount}。
          </p>
        )}
      </div>
      <button type="button" onClick={restore}>
        恢复默认推荐
      </button>
      {message ? <p>{message}</p> : null}
    </section>
  )
}
