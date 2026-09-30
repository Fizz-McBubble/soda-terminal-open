import { WarehouseCalculationStatus } from './WarehouseCalculationStatus'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'
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
  calculation,
  calculationCancelled,
  cancelCalculation,
}: {
  discCount: number
  accountId: string
  selectedDiscId: string | null
  projection: WarehouseActionProjection | null
  calculationCancelled?: boolean
  calculation?: AccountDecisionWorldContextValue['calculation']
  cancelCalculation?: () => void
  runAnalysis: () => void
}) {
  const navigate = useNavigate()
  return (
    <header className="warehouse-workbench__header">
      <div>
        <h1>驱动盘分析</h1>
        <p>
          {projection
            ? `已分析 ${discCount} 张驱动盘。`
            : `已读取 ${discCount} 张驱动盘，建议待分析。`}
          {Boolean(projection?.referenceIssues?.savedPlanIds.length) && (
            <Link to="/loadouts/team">
              {' '}
              {projection?.referenceIssues?.savedPlanIds.length} 份队伍配装待核对
            </Link>
          )}
          {projection?.referenceIssues?.equipmentNeedsReview && (
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
        {calculationCancelled && !calculation ? (
          <span role="status">分析已取消，可重新分析。</span>
        ) : null}
        <WarehouseCalculationStatus
          calculation={calculation}
          cancelCalculation={cancelCalculation}
        />
        <button
          className="button button--primary"
          type="button"
          disabled={Boolean(calculation)}
          onClick={runAnalysis}
        >
          <RefreshCw size={17} /> 重新分析
        </button>
      </div>
    </header>
  )
}
