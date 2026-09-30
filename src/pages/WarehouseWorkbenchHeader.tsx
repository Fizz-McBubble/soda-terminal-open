import { RefreshCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { WarehouseActionProjection } from '../application/warehouseActionContract'
import { DiscWorkspaceModeSwitch } from '../components/DiscWorkspaceModeSwitch'

export function WarehouseWorkbenchHeader({
  discCount,
  accountId,
  selectedDiscId,
  projection,
  runAnalysis,
}: {
  discCount: number
  accountId: string
  selectedDiscId: string | null
  projection: WarehouseActionProjection
  runAnalysis: () => void
}) {
  const navigate = useNavigate()
  return (
    <header className="warehouse-workbench__header">
      <div>
        <h1>驱动盘分析</h1>
        <p>
          已分析 {discCount} 张驱动盘。
          {Boolean(projection.referenceIssues?.savedPlanIds.length) && (
            <Link to="/loadouts/team">
              {' '}
              {projection.referenceIssues?.savedPlanIds.length} 份队伍配装待核对
            </Link>
          )}
          {projection.referenceIssues?.equipmentNeedsReview && (
            <Link to="/assets/agents"> 核对当前装备</Link>
          )}
        </p>
        <p className="warehouse-workbench__notice">
          “继续观察”不等于建议强化；清理候选须自行核对，本站不会自动删除驱动盘。
        </p>
      </div>
      <div className="warehouse-workbench__actions">
        <DiscWorkspaceModeSwitch
          mode="analysis"
          onNavigate={(path) =>
            navigate(
              selectedDiscId
                ? `${path}?selected=${encodeURIComponent(selectedDiscId)}&account=${encodeURIComponent(accountId)}`
                : path,
            )
          }
        />
        <button className="button button--primary" type="button" onClick={runAnalysis}>
          <RefreshCw size={17} /> 重新分析
        </button>
      </div>
    </header>
  )
}
