import { useState } from 'react'
import { AccountWorkspace } from './Account'
import { CatalogWorkspace } from './CatalogWorkspace'
import { Shell } from './Shell'
import type { AssetGoldenProps, AssetTab } from './types'

export function AssetMaintenanceGolden(props: AssetGoldenProps) {
  const [navigation, setNavigation] = useState({
    tab: props.initialTab ?? 'account',
    initialTab: props.initialTab,
    accountId: props.accountId,
  })
  if (navigation.initialTab !== props.initialTab || navigation.accountId !== props.accountId) {
    setNavigation({
      tab: props.initialTab ?? 'account',
      initialTab: props.initialTab,
      accountId: props.accountId,
    })
  }
  const tab = navigation.tab
  const navigate = (next: AssetTab) => {
    setNavigation((current) => ({ ...current, tab: next }))
    props.onNavigate(next)
  }
  return (
    <Shell props={props} activeTab={tab} onTab={navigate}>
      {props.message && (
        <p className="r6-message" role="status">
          {props.message}
        </p>
      )}
      {tab === 'account' ? (
        <AccountWorkspace props={props} />
      ) : (
        <CatalogWorkspace key={`${props.accountId}:${tab}`} props={props} kind={tab} />
      )}
    </Shell>
  )
}
