import { Link, useInRouterContext } from 'react-router-dom'
import type { DriveDisc } from '../domain/schemas'
import { displayDiscMainValue } from './publicDiscFacts'
import { formatRecordedDiscSubStat } from './discStatPresentation'
import { readableAgentName, readableSetName, statLabel } from './warehouseFactLabels'
import { ExplanationPopover } from '../components/ExplanationPopover'
import type { SavedUsageReference } from './WarehouseActionDrawerDetails.helpers'

export function DiscAttributeComparison({
  original,
  candidate,
}: {
  original: DriveDisc
  candidate: DriveDisc
}) {
  const substatKeys = [
    ...new Set([
      ...original.subStats.map((item) => item.stat),
      ...candidate.subStats.map((item) => item.stat),
    ]),
  ]
  const substatValue = (disc: DriveDisc, stat: (typeof substatKeys)[number]) => {
    const value = disc.subStats.find((item) => item.stat === stat)
    return value ? formatRecordedDiscSubStat(value.stat, value.value, value.upgrades) : '—'
  }
  return (
    <div className="warehouse-disc-comparison" role="region" aria-label="原盘与可比较盘属性比较">
      <h4>属性差异</h4>
      <div className="warehouse-disc-comparison__grid" role="table">
        <div className="warehouse-disc-comparison__row warehouse-disc-comparison__head" role="row">
          <span role="columnheader">属性</span>
          <strong role="columnheader">原盘</strong>
          <strong role="columnheader">可比较盘</strong>
        </div>
        <ComparisonRow
          label="身份"
          original={`${readableSetName(original.setId)} · ${original.slot}号位 · +${original.level}`}
          candidate={`${readableSetName(candidate.setId)} · ${candidate.slot}号位 · +${candidate.level}`}
        />
        <ComparisonRow
          label="主词条"
          original={`${statLabel(original.mainStat)} ${displayDiscMainValue(original)}`}
          candidate={`${statLabel(candidate.mainStat)} ${displayDiscMainValue(candidate)}`}
        />
        {substatKeys.map((stat) => (
          <ComparisonRow
            key={stat}
            label={statLabel(stat)}
            original={substatValue(original, stat)}
            candidate={substatValue(candidate, stat)}
          />
        ))}
      </div>
    </div>
  )
}

function ComparisonRow({
  label,
  original,
  candidate,
}: {
  label: string
  original: string
  candidate: string
}) {
  const incomplete = original === '—' || candidate === '—'
  const change =
    original === '—' && candidate === '—'
      ? '均未记录'
      : incomplete
        ? '单侧未记录'
        : original !== candidate
          ? '有差异'
          : null
  return (
    <div
      className="warehouse-disc-comparison__row"
      role="row"
      data-comparison-change={change ? (incomplete ? 'incomplete' : 'changed') : undefined}
    >
      <span role="rowheader">
        {label}
        {change ? <small>{change}</small> : null}
      </span>
      <span role="cell">{original}</span>
      <span role="cell">{candidate}</span>
    </div>
  )
}

export function WarehouseSavedUsagePopover({ references }: { references: SavedUsageReference[] }) {
  const routed = useInRouterContext()
  if (references.length === 0) return null
  return (
    <ExplanationPopover label={`${references.length} 个关联方案`}>
      <ul>
        {references.map(({ plan, team }) => {
          const name = displayedSavedLoadoutName(plan.name)
          const members = plan.memberIds ?? team?.memberIds
          const authority = team?.decisionAuthority
          return (
            <li key={plan.id}>
              <strong>
                {routed ? (
                  <Link to={`/loadouts/plans/${encodeURIComponent(plan.id)}`}>{name}</Link>
                ) : (
                  name
                )}
              </strong>
              {plan.active ? ' · 当前方案' : !name.includes('已保存配装') ? ' · 已保存配装' : ''}
              {members?.length ? ` · ${members.map(readableAgentName).join('、')}` : ''}
              {authority ? ` · ${cultivationPriorityLabel(authority.cultivationPriority)}` : ''}
            </li>
          )
        })}
      </ul>
    </ExplanationPopover>
  )
}

function displayedSavedLoadoutName(name: string) {
  return name.replace(/方案\s*B(?=$|[\s·（(：:—-])/giu, '已保存配装')
}

function cultivationPriorityLabel(tier: string) {
  if (tier === 'ready_now') return '现在可用'
  if (tier === 'short_upgrade') return '短期补强'
  if (tier === 'strategic_build') return '需较多培养'
  return '培养建议待确认'
}
