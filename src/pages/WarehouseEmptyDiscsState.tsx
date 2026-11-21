import { Link } from 'react-router-dom'
import { WorkbenchEmptyState } from '../components/AppEntryState'

export function WarehouseEmptyDiscsState({ excludedDiscCount }: { excludedDiscCount: number }) {
  if (excludedDiscCount === 0)
    return (
      <WorkbenchEmptyState
        title="还没有可分析的驱动盘"
        description="先扫描或导入当前账户的驱动盘；有数据后，这里会给出保留、观察和清理候选建议。"
        action={
          <Link className="button button--primary" to="/system/scanner">
            前往扫描与导入
          </Link>
        }
      />
    )
  return (
    <WorkbenchEmptyState
      title="暂无可分析的 S 级驱动盘"
      description={`当前仅分析 S 级驱动盘。账户中已有 ${excludedDiscCount} 张非 S 级或品质未确认的驱动盘记录已保留，可在我的资产中查看。`}
      action={
        <>
          <Link className="button button--primary" to="/assets/discs">
            前往我的资产查看
          </Link>
          <Link className="button" to="/system/scanner">
            前往扫描与导入
          </Link>
        </>
      }
    />
  )
}
