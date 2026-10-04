import { VisualEntityImage } from '../../VisualEntityImage'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { preloadVisualEntityImage } from '../../../assets/visualEntityImageSource'
import type { CatalogItem, CatalogKind, DiscItem } from './types'

function OfficialIcon({ id, name }: { id: string; name: string }) {
  return (
    <VisualEntityImage
      entityType="illustration"
      entityId={id}
      variant="icon"
      name={name}
      className="official-icon"
    />
  )
}

export function CatalogCard({
  kind,
  item,
  selected,
  facts,
  onSelect,
}: {
  kind: Exclude<CatalogKind, 'discs'>
  item: CatalogItem
  selected: boolean
  facts: string
  onSelect: () => void | Promise<void>
}) {
  const preloadDetailAvatar = () => {
    if (kind !== 'agents') return
    void preloadVisualEntityImage({
      entityType: 'agent',
      entityId: item.stableId,
      slotId: 'agent.square-avatar',
      consumer: 'assets.editor',
    })
  }
  const attributeIcons: Record<string, { id: string; label: string }> = {
    electric: { id: 'attribute-electric', label: '电属性' },
    ether: { id: 'attribute-ether', label: '以太属性' },
    fire: { id: 'attribute-fire', label: '火属性' },
    ice: { id: 'attribute-ice', label: '冰属性' },
    physical: { id: 'attribute-physical', label: '物理属性' },
    wind: { id: 'attribute-wind', label: '风属性' },
  }
  const specialtyIcons: Record<string, string> = {
    armorer: 'specialty-armorer',
    anomaly: 'specialty-anomaly',
    damage: 'specialty-attack',
    defense: 'specialty-defense',
    rupture: 'specialty-rupture',
    stun: 'specialty-stun',
    support: 'specialty-support',
  }
  return (
    <button
      className={`object-card${kind === 'agents' ? ' agent' : kind === 'wengines' ? ' wengine' : kind === 'bangboos' ? ' bangboo' : ''}`}
      role="option"
      aria-selected={selected}
      aria-label={facts ? `${item.playerName}，${facts}` : item.playerName}
      title={facts ? `${item.playerName} · ${facts}` : item.playerName}
      onPointerEnter={preloadDetailAvatar}
      onFocus={preloadDetailAvatar}
      onClick={() => {
        void onSelect()
      }}
    >
      <VisualEntityImage
        entityType={item.entityType}
        entityId={item.stableId}
        slotId={
          kind === 'agents'
            ? 'agent.factual-card'
            : kind === 'wengines'
              ? 'wengine.catalog-card'
              : 'bangboo.catalog-card'
        }
        consumer="assets.catalog"
        name={item.playerName}
        className="object-image"
        compactFallback
      />
      <span className="badge left">{item.rarity ?? 'S'}</span>
      <span className="card-name" style={facts ? undefined : { bottom: 5 }}>
        {item.playerName}
      </span>
      {facts ? <span className="card-state">{facts}</span> : null}
      {kind === 'agents' && (item.attribute || item.specialty) && (
        <span className="icon-stack" aria-label="属性与特性">
          {item.attribute && attributeIcons[item.attribute] && (
            <OfficialIcon
              id={attributeIcons[item.attribute].id}
              name={attributeIcons[item.attribute].label}
            />
          )}
          {item.specialty && specialtyIcons[item.specialty] && (
            <OfficialIcon
              id={specialtyIcons[item.specialty]}
              name={`${getAgentSpecialtyLabel(item.specialty)}特性`}
            />
          )}
        </span>
      )}
      {kind === 'wengines' && item.specialty && specialtyIcons[item.specialty] && (
        <span className="icon-stack single" aria-label="适用特性">
          <OfficialIcon
            id={specialtyIcons[item.specialty]}
            name={`${getAgentSpecialtyLabel(item.specialty)}特性`}
          />
        </span>
      )}
    </button>
  )
}

export function DiscCard({
  item,
  selected,
  bulk,
  checked,
  onSelect,
}: {
  item: DiscItem
  selected: boolean
  bulk: boolean
  checked: boolean
  onSelect: () => void
}) {
  const protectionLabels = item.protections
    .filter((value) => value !== 'locked' && value !== 'favorite')
    .map(
      (value) =>
        ({ locked: '锁定', favorite: '收藏', equipped: '装备中', planned: '已保存方案' })[value],
    )
  return (
    <button
      className="object-card disc"
      role="option"
      aria-selected={bulk ? undefined : selected}
      aria-checked={bulk ? checked : undefined}
      aria-label={`${item.set.playerName}，${item.slot}号位，强化${item.level}${protectionLabels.length ? `，${protectionLabels.join('，')}` : ''}`}
      onClick={onSelect}
    >
      {bulk && (
        <span className="disc-select" aria-hidden="true">
          {checked ? '✓' : ''}
        </span>
      )}
      <VisualEntityImage
        entityType="drive_disc_set"
        entityId={item.set.stableId}
        name={item.set.playerName}
        className="object-image"
        slotId="drive-disc-set.icon"
        consumer="assets.catalog"
      />

      <span className="disc-facts" aria-hidden="true">
        <i>{item.slot}号</i>
        <i>+{item.level}</i>
      </span>
      {protectionLabels.length ? (
        <span className="disc-protection" aria-hidden="true" title={protectionLabels.join(' · ')}>
          {protectionLabels[0]}
          {protectionLabels.length > 1 ? ` +${protectionLabels.length - 1}` : ''}
        </span>
      ) : null}
    </button>
  )
}
