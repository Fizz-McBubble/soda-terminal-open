import { VisualEntityImage } from '../../VisualEntityImage'
import { CatalogReferencePanel } from './CatalogReference'
import { getAgentName, getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { Identity } from './EditorShared'
import type { AssetGoldenProps, CatalogItem, DiscItem } from './types'

export function WEngineEditor({ props, item }: { props: AssetGoldenProps; item: CatalogItem }) {
  const users = props.roster.agents.filter(
    (agent) =>
      props.accountId !== 'no-account' && agent.owned && agent.wEngineDetails.id === item.stableId,
  )
  return (
    <>
      {Identity(
        item,
        `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`,
        users.length ? '已使用' : '图鉴预览',
      )}
      <CatalogReferencePanel item={item} />
      {users.length > 0 && (
        <section className="editor-section" aria-label="使用代理人">
          <h3>使用代理人</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {users.map((agent) => {
              const name =
                props.catalog.agents.find((entry) => entry.stableId === agent.agentId)
                  ?.playerName ?? getAgentName(agent.agentId)
              return (
                <span key={agent.agentId} title={name} className="engine-user-avatar">
                  <VisualEntityImage
                    entityType="agent"
                    entityId={agent.agentId}
                    slotId="agent.square-avatar"
                    consumer="assets.editor"
                    name={name}
                  />
                </span>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

export function BangbooEditor({ item }: { props: AssetGoldenProps; item: CatalogItem }) {
  return (
    <div className="bangboo-editor">
      <div className="bangboo-editor__content">
        <div className="asset-editor-heading">
          {Identity(item, `${item.rarity ?? ''}级邦布`, '图鉴预览')}
        </div>
        <CatalogReferencePanel item={item} additionalAbilityLevel={1} />
      </div>
    </div>
  )
}
export function DiscEditor({ item }: { props: AssetGoldenProps; item: DiscItem }) {
  return (
    <>
      <div className="asset-editor-heading">
        {Identity(
          item.set,
          `${item.rarity ? `${item.rarity}级` : '品质未确认'} · ${item.slot}号位 · +${item.level}`,
        )}
      </div>
      {item.rarity !== 'S' && <p>此盘记录已保留，不纳入配装和驱动盘分析。</p>}
      <CatalogReferencePanel item={item.set} />
      <section className="editor-section disc-editor-stats">
        <h3>词条</h3>
        <div className="main-stat">
          <span>
            主词条 · <strong>{item.mainStat}</strong>
          </span>
          {item.mainValue && <strong>{item.mainValue}</strong>}
        </div>
        <dl className="stats">
          {item.subStats.map((stat) => (
            <div key={stat.stat}>
              <dt>
                <strong>{stat.stat}</strong>
                <em>+{stat.upgrades}</em>
              </dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="editor-section">
        {item.protections.includes('equipped') || item.protections.includes('planned') ? (
          <p className="inventory-protection-note">
            该盘已被{item.protections.includes('equipped') ? '当前装备' : ''}
            {item.protections.includes('equipped') && item.protections.includes('planned')
              ? '和'
              : ''}
            {item.protections.includes('planned') ? '已保存方案' : ''}引用，解除关系前不可删除。
          </p>
        ) : null}
      </section>
    </>
  )
}
