import { Link } from 'react-router-dom'
import { WorkbenchEmptyState } from '../AppEntryState'

export function AccountRequiredState({ title }: { title: string }) {
  return (
    <WorkbenchEmptyState
      title={title}
      description="从扫描页创建或选择账户，再完成扫描、检查和确认导入。"
      action={
        <Link className="button button--primary" to="/system/scanner">
          前往扫描与导入
        </Link>
      }
    />
  )
}
