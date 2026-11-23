import { WarehouseCalculationStatus } from './WarehouseCalculationStatus'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'
import { RefreshCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { WarehouseActionProjection } from '../application/warehouseActionContract'
import { DiscWorkspaceModeSwitch } from '../components/DiscWorkspaceModeSwitch'
import { WarehouseActionSummary } from './WarehouseDiscControls'
import type { FilterState } from './warehouseDiscPresentation'

export function WarehouseWorkbenchHeader({
  discCount,
  excludedDiscCount,
  accountId,
  selectedDiscId,
  filters,
  updateFilters,
  projection,
  runAnalysis,
  calculation,
  calculationCancelled,
  analysisIssue,
  cancelCalculation,
}: {
  discCount: number
  excludedDiscCount: number
  accountId: string
  selectedDiscId: string | null
  filters: FilterState
  updateFilters: (updater: (current: FilterState) => FilterState) => void
  projection: WarehouseActionProjection | null
  calculationCancelled?: boolean
  analysisIssue?: AccountDecisionWorldContextValue['analysisIssue']
  calculation?: AccountDecisionWorldContextValue['calculation']
  cancelCalculation?: () => void
  runAnalysis: () => void
}) {
  const navigate = useNavigate()
  const hasNotice =
    excludedDiscCount > 0 ||
    Boolean(projection?.referenceIssues?.savedPlanIds.length) ||
    Boolean(projection?.referenceIssues?.equipmentNeedsReview)
  return (
    <header className="warehouse-workbench__header">
      <div className="warehouse-workbench__heading">
        <div className="warehouse-workbench__title-copy">
          <div className="warehouse-workbench__title-line">
            <h1>驱动盘分析</h1>
            <p>
              {projection?.state === 'current'
                ? `已分析 ${projection.actions.length} 张驱动盘（S 级）`
                : projection
                  ? `${discCount} 张 S 级驱动盘`
                  : `已读取 ${discCount} 张 S 级驱动盘，建议待分析`}
            </p>
          </div>
          {hasNotice ? (
            <p className="warehouse-workbench__notice">
              {excludedDiscCount > 0 &&
                `另有 ${excludedDiscCount} 张非 S 级或品质未确认的记录已保留，不纳入分析。`}
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
          ) : null}
        </div>
        <WarehouseActionSummary
          filters={filters}
          updateFilters={updateFilters}
          stale={projection?.state === 'stale'}
          projection={projection}
        />
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
          <span role="status">分析已取消</span>
        ) : analysisIssue && !calculation ? (
          <span role="alert">{analysisIssue.message}</span>
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
