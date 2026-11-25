import { useId, useState } from 'react'
import { Check, Layers, Minus } from 'lucide-react'
import { getAgentName } from '../application/publicRosterNames'
import { VisualEntityImage } from '../components/VisualEntityImage'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { referenceSummary, variantAvailabilityLabel } from './teamRatingPresentation'

const compactCount = 3

export function TeamLoadoutRowVariants({
  family,
  activeVariantId,
  selected,
  onSelect,
}: {
  family: TeamLoadoutOverviewFamily
  activeVariantId?: string
  selected: boolean
  onSelect: (variantId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const optionsId = useId()
  const variants = family.variants
  const active = variants.find((variant) => variant.id === activeVariantId) ?? variants[0]!
  const compact = variants.slice(0, compactCount)
  if (!expanded && !compact.includes(active)) compact[compact.length - 1] = active
  const remaining = variants.length - compact.length
  function choice(variant: TeamLoadoutOverviewItem, full = false) {
    const current = variant.id === active.id
    const additions = variant.agentIds.filter((id) => !active.agentIds.includes(id))
    const changedBangboo =
      !current && Boolean(variant.bangbooId && variant.bangbooId !== active.bangbooId)
    const agentId =
      additions[0] ??
      (current ? variant.agentIds.find((id) => !family.coreAgentIds.includes(id)) : undefined)
    const name = current ? '当前搭配' : additions.map(getAgentName).join('、') || '另一种搭配'
    const displayName = additions.length
      ? name
      : agentId
        ? getAgentName(agentId)
        : changedBangboo
          ? variant.bangbooLabel
          : variant.title
    const availability = variantAvailabilityLabel(variant.executionStatus) ?? '待配装'
    const rating = referenceSummary(variant)
    const label = [
      availability,
      name,
      rating,
      changedBangboo ? `邦布：${variant.bangbooLabel}` : null,
    ]
      .filter(Boolean)
      .join('，')
    return (
      <button
        type="button"
        key={variant.id}
        data-variant-id={variant.id}
        className="f5v-box-row-choice"
        aria-pressed={selected && current}
        aria-label={label}
        title={`${variant.title} · ${label}`}
        onClick={() => onSelect(variant.id)}
      >
        <span className="f5v-box-row-choice__portrait" aria-hidden="true">
          {agentId ? (
            <VisualEntityImage
              className="f5v-box-team-portrait"
              entityType="agent"
              entityId={agentId}
              name={getAgentName(agentId)}
              slotId="agent.square-avatar"
              consumer="box.team-overview"
            />
          ) : changedBangboo && variant.bangbooId ? (
            <VisualEntityImage
              className="f5v-box-team-portrait"
              entityType="bangboo"
              entityId={variant.bangbooId}
              name={variant.bangbooLabel ?? '邦布'}
              slotId="bangboo.team-icon"
              consumer="box.team-overview"
            />
          ) : (
            <Layers size={16} />
          )}
          {current && selected ? (
            <Check className="f5v-box-row-choice__check" size={12} strokeWidth={3} />
          ) : null}
        </span>
        <span className="f5v-box-row-choice__text">
          <strong>{displayName}</strong>
          <small>{full ? `${availability} · ${rating}` : rating.replace(/^评级\s*/u, '')}</small>
        </span>
      </button>
    )
  }
  return (
    <>
      <div className="f5v-box-row-variants" role="group" aria-label={`${family.title} · 替换成员`}>
        <span className="f5v-box-row-variants__label">替换成员</span>
        <div className="f5v-box-row-variants__choices">
          {compact.map((variant) => choice(variant))}
          {remaining > 0 ? (
            <button
              type="button"
              className="f5v-box-row-variants__more"
              aria-expanded={expanded}
              aria-controls={optionsId}
              aria-label={expanded ? '收起替补' : `展开其余 ${remaining} 种搭配`}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <Minus size={14} /> : `+${remaining}`}
            </button>
          ) : null}
        </div>
      </div>
      {remaining > 0 ? (
        <div id={optionsId} className="f5v-box-row-variants__expanded" hidden={!expanded}>
          {expanded &&
            variants
              .filter((variant) => !compact.includes(variant))
              .map((variant) => choice(variant, true))}
        </div>
      ) : null}
    </>
  )
}
