import type { ReactNode } from 'react'
import type { AssetGoldenProps, AssetTab } from './types'
const tabs: Array<[AssetTab, string]> = [
  ['account', '账户与备份'],
  ['agents', '代理人'],
  ['wengines', '音擎'],
  ['bangboos', '邦布'],
  ['discs', '驱动盘'],
]

export function Shell({
  props,
  activeTab,
  onTab,
  children,
}: {
  props: AssetGoldenProps
  activeTab: AssetTab
  onTab: (tab: AssetTab) => void
  children: ReactNode
}) {
  const counts = {
    agents: props.catalog.agents.length,
    wengines: props.catalog.wengines.length,
    bangboos: props.catalog.bangboos.length,
    discs: props.discs.length,
  }
  return (
    <div className="r6-golden r6-golden--content-only">
      <nav className="asset-tabs" aria-label="我的资产分类">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? 'active' : ''}
            aria-current={activeTab === id ? 'page' : undefined}
            disabled={props.accountId === 'no-account' && id !== 'account'}
            onClick={() => onTab(id)}
          >
            <span className="tab-label">{label}</span>
            {id !== 'account' && <span>{counts[id]}</span>}
          </button>
        ))}
      </nav>
      <section className="workspace" aria-live="polite">
        {children}
      </section>
    </div>
  )
}
