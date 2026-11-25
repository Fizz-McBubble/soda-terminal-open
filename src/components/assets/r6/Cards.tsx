import { VisualEntityImage } from '../../VisualEntityImage'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { preloadVisualEntityImage } from '../../../assets/visualEntityImageSource'
import { assetAttributeIcons } from '../../../application/publicAssetIdentityLabels'
import type { CatalogItem, CatalogKind, DiscItem } from './types'

function OfficialIcon({ id, name }: { id: string; name: string }) {
  return (
    <VisualEntityImage
      entityType="illustration"
      entityId={id}
      variant="icon"
      name={name}
      className="official-icon"
      compactFallback
    />
  )
}

export function CatalogCard({
  kind,
  item,
  selected,
  facts,
  tabIndex,
  onFocus,
  onSelect,
}: {
  kind: Exclude<CatalogKind, 'discs'>
  item: CatalogItem
  selected: boolean
  facts: string
  tabIndex?: number
  onFocus?: () => void
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
  const attribute = item.attribute ? assetAttributeIcons[item.attribute] : undefined
  const specialtyIcons: Record<string, string> = {
    armorer: 'specialty-armorer',
    anomaly: 'specialty-anomaly',
    damage: 'specialty-attack',
    defense: 'specialty-defense',
    rupture: 'specialty-rupture',
    stun: 'specialty-stun',
    support: 'specialty-support',
  }
  const accessibleName = [
    item.playerName,
    facts,
    kind === 'agents' && attribute ? `${attribute.label}属性` : null,
    (kind === 'agents' || kind === 'wengines') && item.specialty && specialtyIcons[item.specialty]
      ? `${getAgentSpecialtyLabel(item.specialty)}特性`
      : null,
  ]
    .filter(Boolean)
    .join('，')
  return (
    <button
      className={`object-card${kind === 'agents' ? ' agent' : kind === 'wengines' ? ' wengine' : kind === 'bangboos' ? ' bangboo' : ''}`}
      role="option"
      aria-selected={selected}
      aria-label={accessibleName}
      tabIndex={tabIndex}
      title={facts ? `${item.playerName} · ${facts}` : item.playerName}
      onPointerEnter={preloadDetailAvatar}
      onFocus={() => {
        preloadDetailAvatar()
        onFocus?.()
      }}
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
      {item.rarity ? <span className="badge left">{item.rarity}</span> : null}
      <span className="card-name" style={facts ? undefined : { bottom: 5 }}>
        {item.playerName}
      </span>
      {facts ? <span className="card-state">{facts}</span> : null}
      {kind === 'agents' && (item.attribute || item.specialty) && (
        <span className="icon-stack" aria-label="属性与特性">
          {attribute?.id ? (
            <OfficialIcon id={attribute.id} name={`${attribute.label}属性`} />
          ) : attribute ? (
            <span
              className="official-icon"
              aria-label={`${attribute.label}属性`}
              style={{ fontSize: 10, width: 24, lineHeight: '18px', textAlign: 'center' }}
            >
              {attribute.label}
            </span>
          ) : null}
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
  tabIndex,
  onFocus,
  onSelect,
}: {
  item: DiscItem
  selected: boolean
  bulk: boolean
  checked: boolean
  tabIndex?: number
  onFocus?: () => void
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
      className={`object-card disc${bulk ? ' is-bulk' : ''}`}
      role="option"
      aria-selected={bulk ? undefined : selected}
      aria-checked={bulk ? checked : undefined}
      tabIndex={tabIndex}
      aria-label={`${item.set.playerName}，${item.rarity ? `${item.rarity}级` : '品质未确认'}，${item.slot}号位，强化${item.level}${protectionLabels.length ? `，${protectionLabels.join('，')}` : ''}`}
      title={`${item.set.playerName} · ${item.rarity ? `${item.rarity}级` : '品质未确认'} · ${item.slot}号位 · 强化${item.level}`}
      onFocus={onFocus}
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

      <span className="disc-fact disc-rarity" aria-hidden="true">
        {item.rarity ? `${item.rarity}级` : '未知'}
      </span>
      <span className="disc-fact disc-slot" aria-hidden="true">
        {item.slot}号
      </span>
      <span className="disc-fact disc-level" aria-hidden="true">
        +{item.level}
      </span>
      {protectionLabels.length ? (
        <span className="disc-protection" aria-hidden="true" title={protectionLabels.join(' · ')}>
          {protectionLabels.slice(0, 2).join(' · ')}
          {protectionLabels.length > 2 ? ` +${protectionLabels.length - 2}` : ''}
        </span>
      ) : null}
    </button>
  )
}
