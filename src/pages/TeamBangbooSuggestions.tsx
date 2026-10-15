import { VisualEntityImage } from '../components/VisualEntityImage'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { ExplanationPopover } from '../components/ExplanationPopover'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import {
  BANGBOO_RECOMMENDATION_EXPLANATION,
  formatBangbooCardDisplay,
} from './teamBangbooPresentation'

export function TeamBangbooSuggestions({
  options,
}: {
  options: NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']>
}) {
  if (!options.length) return null
  return (
    <section className="f5v-box-team-bangboo-options" aria-label="可搭配邦布">
      <div className="f5v-box-team-bangboo-header">
        <h3>邦布推荐</h3>
        <ExplanationPopover label="推荐说明" title="邦布推荐规则">
          <p>{BANGBOO_RECOMMENDATION_EXPLANATION}</p>
          {options.map((option) => {
            const display = formatBangbooCardDisplay(option)
            return display.fullReason ? (
              <section className="f5v-box-team-bangboo-reason" key={option.bangbooId}>
                <strong>
                  {playerFacingBangbooLabel(option.bangbooId)} · {option.defaultStars}星
                </strong>
                <p>{display.fullReason}</p>
              </section>
            ) : null
          })}
        </ExplanationPopover>
      </div>
      <ul className="f5v-box-team-bangboo-list" aria-label="邦布推荐">
        {options.map((option) => {
          const { bangbooId, defaultStars } = option
          const name = playerFacingBangbooLabel(bangbooId)
          const display = formatBangbooCardDisplay(option)
          return (
            <li key={bangbooId}>
              <VisualEntityImage
                entityType="bangboo"
                entityId={bangbooId}
                name={name}
                slotId="bangboo.team-icon"
                consumer="box.team-overview"
              />
              <span className="f5v-box-team-bangboo-summary">
                <span className="f5v-box-team-bangboo-title">
                  {name} · {defaultStars}星
                  {display.statusBadge ? (
                    <span
                      className={`f5v-box-team-bangboo-status f5v-box-team-bangboo-status--${
                        display.statusBadge === '未激活' ? 'inactive' : 'unknown'
                      }`}
                    >
                      {display.statusBadge}
                    </span>
                  ) : null}
                </span>
                <span className="f5v-box-team-bangboo-purpose">
                  {option.primaryPurpose ? display.shortPurpose : '用途待核实'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
