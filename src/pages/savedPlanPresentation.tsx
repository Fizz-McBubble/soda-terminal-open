import { Link } from 'react-router-dom'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import { readTeamPortfolioPlanningAllocation } from '../accounts/publicTeamPortfolioPlanningAllocation'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import { SavedPortfolioPlanTeams } from './SavedPortfolioPlanTeams'

export function SavedPortfolioPlan({
  warehouse,
  plan,
}: {
  warehouse: CoreWarehouse
  plan: AccountPlanningDraft
  readOnly: boolean
}) {
  const snapshot = plan.teamPortfolioSnapshot
  if (!snapshot) return null
  const savedAllocation = readTeamPortfolioPlanningAllocation(plan, warehouse)
  return (
    <section className="optimizer-flow optimizer-portfolio" aria-label="已保存多队方案">
      <Link to="/loadouts/team">返回队伍结果总览</Link>
      <header className="optimizer-portfolio__heading">
        <div>
          <h1>{savedPlanDisplayName(plan)}</h1>
          <p>已保存 {snapshot.requestedTeamCount} 队同时出战方案。</p>
        </div>
      </header>
      {savedAllocation.status === 'incomplete' ? (
        <p role="status">部分已保存成员或驱动盘无法核对。</p>
      ) : null}
      <SavedPortfolioPlanTeams
        plan={plan}
        warehouse={warehouse}
        allocation={savedAllocation.allocation}
        discRecommendations={plan.teamPortfolioBuildIntent?.recommendations}
      />
    </section>
  )
}
