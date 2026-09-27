import { ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AccountRequiredState({ title }: { title: string }) {
  return (
    <section
      className="panel account-required-state"
      role="status"
      aria-labelledby="account-required-title"
    >
      <ScanLine aria-hidden="true" size={28} />
      <span>需要本机账户</span>
      <h1 id="account-required-title">{title}</h1>
      <p>从扫描页创建或选择账户，再完成扫描、检查和确认导入。</p>
      <Link className="button button--primary" to="/system/scanner">
        前往扫描与导入
      </Link>
    </section>
  )
}
