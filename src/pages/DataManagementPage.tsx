import { lazy, Suspense } from 'react'
import { AdvancedDataManagement } from './dataManagement/AdvancedDataManagement'

const DevPlayerAccountAuditState = import.meta.env.DEV
  ? lazy(() => import('../testing/PlayerAccountAuditState'))
  : null

// Only development tools use this module. The player data route redirects to /assets/account.
export function DevDataManagementPage() {
  if (!import.meta.env.DEV) return null
  return <AdvancedDataManagement />
}

export function DevPlayerAccountAuditPage() {
  if (!import.meta.env.DEV || !DevPlayerAccountAuditState) return null
  return (
    <Suspense
      fallback={
        <section className="panel">
          <p>正在载入只读审计状态…</p>
        </section>
      }
    >
      <DevPlayerAccountAuditState />
    </Suspense>
  )
}
