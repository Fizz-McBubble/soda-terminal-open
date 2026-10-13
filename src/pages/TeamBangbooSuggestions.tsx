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
      <p>
        优先保留资料推荐作为起点，再按同类优势与未覆盖用途补充适配项；仅推荐可激活项，不宣称全局最优，可在方案中自由选择其他邦布。
      </p>
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
            <small>{recommendationReason}</small>
          </span>
        ))}
      </div>
    </section>
  )
}
