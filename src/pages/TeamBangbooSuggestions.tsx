import { VisualEntityImage } from '../components/VisualEntityImage'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

export function TeamBangbooSuggestions({
  options,
}: {
  options: NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']>
}) {
  if (!options.length) return null
  return (
    <section className="f5v-box-team-bangboo-options" aria-label="可搭配邦布">
      <h3>邦布推荐</h3>
      <div>
        {options.map(({ bangbooId, defaultStars, recommendationReason }) => (
          <span key={bangbooId} title={recommendationReason}>
            <VisualEntityImage
              entityType="bangboo"
              entityId={bangbooId}
              name={playerFacingBangbooLabel(bangbooId)}
              slotId="bangboo.team-icon"
              consumer="box.team-overview"
            />
            <span>
              {playerFacingBangbooLabel(bangbooId)} · {defaultStars}星
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}
