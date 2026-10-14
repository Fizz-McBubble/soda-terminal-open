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
        </ExplanationPopover>
      </div>
      <div>
        {options.map((option) => {
          const { bangbooId, defaultStars } = option
          const name = playerFacingBangbooLabel(bangbooId)
          const display = formatBangbooCardDisplay(option)
          return (
            <span key={bangbooId} title={display.fullReason || undefined}>
              <VisualEntityImage
                entityType="bangboo"
                entityId={bangbooId}
                name={name}
                slotId="bangboo.team-icon"
                consumer="box.team-overview"
              />
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
              <small className="f5v-box-team-bangboo-purpose">{display.shortPurpose}</small>
              {display.fullReason ? (
                <ExplanationPopover label="适配说明" title={`${name} 适配说明`}>
                  <p>{display.fullReason}</p>
                </ExplanationPopover>
              ) : null}
            </span>
          )
        })}
      </div>
    </section>
  )
}
