import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { DevelopmentDiscCard } from '../features/agentDevelopmentGolden/DevelopmentDiscCard'
import '../features/agentDevelopmentGolden/development-disc-card.css'
import type { TeamExecutionDiscPresentation } from './teamExecutionPresentation'
import { formatTeamExecutionNumberText } from './teamExecutionPlayerText'
import './team-execution-disc-card.interaction.css'

function discStateLabel(state: TeamExecutionDiscPresentation['state']) {
  return state === 'keep'
    ? '保持'
    : state === 'borrow'
      ? '借用'
      : state === 'recorded'
        ? '方案用盘'
        : '替换当前装备'
}

export function TeamExecutionDiscCard({
  disc,
  condensed = false,
  selected = false,
  highlighted = false,
  onSelect,
  onDeselect,
}: {
  disc: TeamExecutionDiscPresentation
  condensed?: boolean
  selected?: boolean
  highlighted?: boolean
  onSelect?: () => void
  onDeselect?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const detailId = useId()
  const mainValue = formatTeamExecutionNumberText(disc.mainValue)
  const displayedDisc = {
    ...disc,
    mainValue,
    score: disc.score === undefined ? undefined : Number(formatTeamExecutionNumberText(disc.score)),
    effective: formatTeamExecutionNumberText(disc.effective),
    subs: disc.subs.map((sub) => ({
      ...sub,
      value: formatTeamExecutionNumberText(sub.value),
    })),
  }
  if (!condensed) {
    const isInteractive = Boolean(onSelect)
    return (
      <li
        aria-label={`${disc.slot}号位 · ${discStateLabel(disc.state)}`}
        className={`team-execution__disc-card team-execution__shared-disc is-${disc.state}${
          selected ? ' is-selected' : ''
        }${highlighted ? ' is-stat-matched' : ''}`}
        tabIndex={isInteractive ? 0 : undefined}
        role={isInteractive ? 'button' : undefined}
        aria-pressed={isInteractive ? selected : undefined}
        data-selected={selected ? 'true' : undefined}
        data-stat-matched={highlighted ? 'true' : undefined}
        onClick={
          isInteractive
            ? (event) => {
                if ((event.target as HTMLElement).closest('.development-disc-card__user')) return
                onSelect?.()
              }
            : undefined
        }
        onKeyDown={
          isInteractive
            ? (event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect?.()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  onDeselect?.()
                }
              }
            : undefined
        }
      >
        <DevelopmentDiscCard
          disc={displayedDisc}
          slotAction={
            disc.state === 'borrow' || disc.state === 'change'
              ? discStateLabel(disc.state)
              : undefined
          }
          conflictContext="equipment_or_plan"
          consumer="box.team-workspace"
        />
      </li>
    )
  }
  const statusLabel = discStateLabel(disc.state)
  const summarySubstat = displayedDisc.subs[0]
  return (
    <li
      aria-label={`${disc.slot}号位 · ${discStateLabel(disc.state)}`}
      className={`team-execution__disc-card is-${disc.state} is-expandable${
        expanded ? ' is-expanded' : ''
      }${selected ? ' is-selected' : ''}${highlighted ? ' is-stat-matched' : ''}`}
      data-expanded={expanded ? 'true' : 'false'}
      data-selected={selected ? 'true' : undefined}
      data-stat-matched={highlighted ? 'true' : undefined}
    >
      <button
        aria-controls={detailId}
        aria-expanded={expanded}
        aria-pressed={selected}
        aria-label={`${expanded ? '收起' : '展开'}${disc.slot}号位驱动盘：${disc.set}`}
        className="team-execution__disc-toggle"
        onClick={() => {
          setExpanded((current) => !current)
          onSelect?.()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onDeselect?.()
          }
        }}
        type="button"
      >
        <span className="team-execution__disc-summary-heading">
          <span>
            {disc.slot}号位 · +{disc.level}
          </span>
          <span className="team-execution__disc-summary-meta">
            {(disc.grade !== '未评定' || disc.score !== undefined) && (
              <b>
                {disc.score === undefined
                  ? disc.grade
                  : disc.grade === '未评定'
                    ? `评分 ${formatTeamExecutionNumberText(disc.score)}`
                    : `${disc.grade} · ${formatTeamExecutionNumberText(disc.score)}`}
              </b>
            )}
            <span className="team-execution__disc-state">{statusLabel}</span>
            <span aria-hidden="true" className="team-execution__disc-summary-action">
              {expanded ? '收起' : '详情'}
              <ChevronDown aria-hidden="true" size={13} />
            </span>
          </span>
        </span>
        <span className="team-execution__disc-summary-main">
          {disc.visual ? (
            <VisualEntityImage
              className="team-execution__disc-summary-visual"
              entityId={disc.visual.entityId}
              entityType={disc.visual.entityType}
              name={disc.visual.name}
              slotId="drive-disc-set.icon"
              consumer="box.team-workspace"
            />
          ) : null}
          <span className="team-execution__disc-summary-set">{disc.set}</span>
          <strong>{disc.main}</strong>
          <b>{mainValue}</b>
        </span>
        <span className="team-execution__disc-substats-summary">
          {summarySubstat
            ? `${summarySubstat.name} ${summarySubstat.value} · 另 ${Math.max(
                0,
                displayedDisc.subs.length - 1,
              )} 条`
            : '暂无副词条'}
        </span>
      </button>
      <div
        aria-label={`${disc.slot}号位完整驱动盘`}
        className="team-execution__disc-detail"
        hidden={!expanded}
        id={detailId}
      >
        {expanded ? (
          <>
            <DevelopmentDiscCard
              disc={displayedDisc}
              conflictContext="equipment_or_plan"
              consumer="box.team-workspace"
            />
            <div className="team-execution__disc-detail-state">
              <span>{statusLabel}</span>
              {/\d/.test(displayedDisc.effective) ? (
                <span>有效副属性 {displayedDisc.effective}</span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </li>
  )
}
