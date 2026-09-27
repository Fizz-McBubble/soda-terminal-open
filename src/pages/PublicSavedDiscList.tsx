import type { CoreWarehouse } from '../accounts/coreFlow'
import {
  discMainStatLabel,
  discSubStatLabel,
  displayDiscMainValue,
  displayDriveDiscSet,
  formatDiscStatValue,
} from './publicDiscFacts'

/**
 * Saved driver-disc facts are displayed from the player's own storage. Nothing here recalculates a
 * current score, and discs that left the warehouse stay visible as an explicit gap.
 */
export function PublicSavedDiscList({
  discIds,
  warehouse,
  label,
  missingNotice = '原记录已保留。',
  statNotice,
}: {
  discIds: readonly string[]
  warehouse: CoreWarehouse
  label: string
  missingNotice?: string
  /** Set when the list mixes saved identity with live warehouse attributes. */
  statNotice?: string
}) {
  const byId = new Map(warehouse.discs.map((disc) => [disc.id, disc]))
  const present = discIds.flatMap((id) => {
    const disc = byId.get(id)
    return disc ? [disc] : []
  })
  return (
    <>
      {present.length ? (
        <ol className="team-execution__disc-slots" aria-label={label}>
          {present.map((disc) => (
            <li className="team-execution__disc-card is-recorded" key={disc.id}>
              <header>
                <span>
                  {disc.slot}号位 · +{disc.level}
                </span>
              </header>
              <div className="team-execution__disc-main">
                <small>{displayDriveDiscSet(disc.setId)}</small>
                <strong>{discMainStatLabel(disc)}</strong>
                <b>{displayDiscMainValue(disc)}</b>
              </div>
              <ul className="team-execution__disc-substats" aria-label="副词条">
                {disc.subStats.map((sub, index) => (
                  <li key={`${sub.stat}:${index}`}>
                    <span>{discSubStatLabel(sub.stat)}</span>
                    <em>{sub.upgrades > 0 ? `+${sub.upgrades}` : ''}</em>
                    <b>{formatDiscStatValue(sub.stat, sub.value, '+')}</b>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
      {present.length && statNotice ? (
        <p className="team-execution__disc-missing">{statNotice}</p>
      ) : null}
      {present.length !== discIds.length ? (
        <p className="team-execution__disc-missing" role="status">
          有 {discIds.length - present.length} 张已保存的驱动盘当前不在仓库；{missingNotice}
        </p>
      ) : null}
    </>
  )
}
