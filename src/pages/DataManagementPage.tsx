import { lazy, Suspense } from 'react'
import { DataCenterPage } from '../components/DataCenterPage'
import { AdvancedDataManagement } from './dataManagement/AdvancedDataManagement'

const DevPlayerAccountAuditState = import.meta.env.DEV
  ? lazy(() => import('../testing/PlayerAccountAuditState'))
  : null

export function DataManagementPage() {
  return <DataCenterPage />
}

export function DevDataManagementPage() {
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
