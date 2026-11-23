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
  const hasAccount = props.accountId !== 'no-account'
  const ownedAgents = props.roster.agents.filter((agent) => agent.owned)
  // Count catalog identities in use, not catalog entries as owned copies.
  const usedEngines = new Set(ownedAgents.map((agent) => agent.wEngineDetails?.id).filter(Boolean))
  const counts = {
    agents: `${hasAccount ? `已拥有 ${ownedAgents.length} / ` : ''}图鉴 ${props.catalog.agents.length}`,
    wengines: `${hasAccount ? `已使用 ${usedEngines.size} 种 / ` : ''}图鉴 ${props.catalog.wengines.length}`,
    bangboos: `图鉴 ${props.catalog.bangboos.length}`,
    discs: hasAccount ? `已记录 ${props.discCount ?? props.discs.length}` : '未选择账户',
  }
  return (
    <div className="r6-golden r6-golden--content-only">
      <nav className="asset-tabs" aria-label="我的资产分类">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? 'active' : ''}
            aria-current={activeTab === id ? 'page' : undefined}
            disabled={props.accountId === 'no-account' && id === 'discs'}
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
