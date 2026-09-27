import type { ReactNode } from 'react'
import { BookOpen, HardDrive, ShieldCheck } from 'lucide-react'
import './page-header.css'

export type PageHeaderScope = {
  kind: 'account' | 'catalog' | 'local'
  label: string
}

export function PageHeader({
  title,
  description,
  scope,
  action,
}: {
  title: string
  description: string
  scope?: PageHeaderScope
  action?: ReactNode
}) {
  const ScopeIcon =
    scope?.kind === 'catalog' ? BookOpen : scope?.kind === 'local' ? HardDrive : ShieldCheck

  return (
    <header className="page-header">
      <div className="page-header__copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header__aside">
        {scope ? (
          <span className={`page-header__scope page-header__scope--${scope.kind}`}>
            <ScopeIcon aria-hidden="true" size={16} />
            {scope.label}
          </span>
        ) : null}
        {action ? <div className="page-header__action">{action}</div> : null}
      </div>
    </header>
  )
}
