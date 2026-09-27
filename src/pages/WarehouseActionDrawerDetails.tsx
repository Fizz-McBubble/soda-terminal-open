import type { DriveDisc } from '../domain/schemas'
import { displayDiscMainValue } from './publicDiscFacts'
import { formatRecordedDiscSubStat } from './discStatPresentation'
import { readableAgentName, readableSetName, statLabel } from './warehouseFactLabels'
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
    <section className="warehouse-disc-comparison" aria-label="原盘与可比较盘属性比较">
      <div className="warehouse-action-drawer__section-heading">
        <h3>属性比较</h3>
        <span className="warehouse-action-drawer__meta">只比较记录属性，不代表伤害差距</span>
      </div>
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
    </section>
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
  return (
    <div className="warehouse-disc-comparison__row" role="row">
      <span role="rowheader">{label}</span>
      <span role="cell">{original}</span>
      <span role="cell">{candidate}</span>
    </div>
  )
}

export function SavedUsageReferences({ references }: { references: SavedUsageReference[] }) {
  return (
    <ul>
      {references.map(({ plan, team }) => {
        const name = displayedSavedLoadoutName(plan.name)
        const authority = team?.decisionAuthority
        return (
          <li key={plan.id}>
            <strong>{name}</strong>
            {plan.active ? ' · 当前方案' : !name.includes('已保存配装') ? ' · 已保存配装' : ''}
            {team ? ` · ${team.memberIds.map(readableAgentName).join('、')}` : ''}
            {authority
              ? ` · ${cultivationPriorityLabel(authority.cultivationPriority)} · ${confidenceLabel(authority.confidence)}`
              : ''}
          </li>
        )
      })}
    </ul>
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

function confidenceLabel(confidence: string) {
  if (confidence === 'high') return '评级依据充分'
  if (confidence === 'medium') return '评级仅供参考'
  if (confidence === 'low') return '评级依据有限'
  return '评级待验证'
}
