import { Fragment } from 'react'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { EffectDescription } from '../../components/EffectDescription'
import type { GoldenWorkbenchData } from './types'

type DiscGuide = GoldenWorkbenchData['graduation']['discs']
type DiscSet = DiscGuide['sets'][number]
type DiscPiece = { entityId: string; name: string; effect: string; count: 2 | 4 }
type DiscOption = Pick<
  DiscSet,
  | 'label'
  | 'warehouseRank'
  | 'recommendationPriority'
  | 'recommendationExplicitlyRanked'
  | 'recommendationGroup'
  | 'recommendationPurpose'
  | 'recommendationConditionHint'
  | 'recommendationExplanation'
  | 'twoPiecePriority'
> & {
  pieces: DiscPiece[]
  fourPiece?: Omit<DiscPiece, 'count'>
  twoPiece?: Omit<DiscPiece, 'count'>
}
const effectKey = (piece: { entityId: string; count: number; effect: string }) =>
  JSON.stringify([piece.entityId, piece.count, piece.effect])

function optionPriorityLabel(set: DiscOption, hasSharedPrimary: boolean) {
  if (set.recommendationPurpose === 'conditional') return '条件搭配'
  if (set.recommendationPurpose === 'historical') return '历史参考'
  if (set.twoPiecePriority)
    return set.twoPiecePriority.label.replace(/攻略软?参考[·\s]*/g, '').trim()
  if (hasSharedPrimary) return '可选副套'
  if (!set.recommendationExplicitlyRanked) return '可选搭配'
  return set.recommendationPriority === 0 ? '首选搭配' : '备选搭配'
}

/** Keep choices visible and the complete explanation beside the choice it describes. */
export function DevelopmentDiscGuide({ guide }: { guide: DiscGuide }) {
  const rawOptions: DiscOption[] = guide.sets.map((set) =>
    set.pieces
      ? { ...set, pieces: set.pieces }
      : {
          ...set,
          pieces: [
            { ...set.fourPiece, count: 4 },
            { ...set.twoPiece, count: 2 },
          ],
        },
  )
  const commonPrimary =
    rawOptions.length > 0 &&
    rawOptions.every((option) => option.fourPiece?.entityId === rawOptions[0]?.fourPiece?.entityId)
  const groups = new Map<string, typeof rawOptions>()
  for (const option of rawOptions) {
    const key = commonPrimary ? option.label : (option.recommendationGroup ?? option.label)
    groups.set(key, [...(groups.get(key) ?? []), option])
  }
  const options: DiscOption[] = [...groups.values()].map((group): DiscOption => {
    const first = group[0]!
    if (group.length === 1 || !first.fourPiece) return first
    const secondary = group.flatMap((item) => (item.twoPiece ? [item.twoPiece] : []))
    return {
      ...first,
      label: `${first.fourPiece.name} 4件 + ${secondary.map((piece) => piece.name).join(' / ')} 2件${first.recommendationExplanation ? '' : (first.label.match(/（[^（）]+）$/)?.[0] ?? '')}`,
      twoPiecePriority: undefined,
      pieces: [
        { ...first.fourPiece, count: 4 },
        ...secondary.map((piece) => ({ ...piece, count: 2 as const })),
      ],
    }
  })
  const currentOptions = options.filter((set) => set.recommendationPurpose !== 'transition')
  const firstPrimary = currentOptions[0]?.fourPiece
  const shared =
    currentOptions.length > 0 &&
    firstPrimary &&
    currentOptions.every((set) => set.fourPiece?.entityId === firstPrimary.entityId)
      ? [{ ...firstPrimary, count: 4 as const }]
      : []
  const sharedKeys = new Set(shared.map(effectKey))
  const distinctDirections =
    currentOptions.length > 1 && !shared.length && currentOptions.every((set) => set.fourPiece)
  const sharedHeading = currentOptions.every(
    (set) =>
      set.recommendationExplicitlyRanked &&
      set.recommendationPriority === 0 &&
      set.recommendationPurpose !== 'conditional',
  )
    ? '首选'
    : '主套'
  const renderOption = (set: DiscOption) => (
    <li className="disc-guide__option" key={set.label}>
      <span className="recommendation-square-group" aria-hidden="true">
        {set.pieces
          .filter((piece) => piece.entityId && !sharedKeys.has(effectKey(piece)))
          // One visual marker per direction; all set names and effects remain in the copy.
          .slice(0, 1)
          .map((piece) => (
            <VisualEntityImage
              key={piece.entityId}
              className="recommendation-item-icon"
              entityType="drive_disc_set"
              entityId={piece.entityId}
              name={piece.name}
            />
          ))}
      </span>
      <div className="disc-guide__option-copy">
        <div className="disc-guide__option-heading">
          <small className="disc-priority">{optionPriorityLabel(set, shared.length > 0)}</small>
          <b>
            {distinctDirections && set.fourPiece
              ? `${set.fourPiece.name} 4件`
              : shared.length && set.pieces.filter((piece) => piece.count === 2).length > 1
                ? '两件套搭配'
                : shared.some((piece) => piece.count === 4) && set.twoPiece
                  ? `${set.twoPiece.name} 2件套`
                  : set.label}
          </b>
          {set.recommendationConditionHint ? (
            <span className="disc-guide__condition">{set.recommendationConditionHint}</span>
          ) : null}
        </div>
        <ExplanationPopover label="搭配说明" title={set.label}>
          {set.recommendationExplanation && (
            <p>
              <EffectDescription text={set.recommendationExplanation} />
            </p>
          )}
          {set.twoPiecePriority && (
            <p>
              <EffectDescription text={set.twoPiecePriority.reason} />
            </p>
          )}
          <dl>
            {set.pieces
              .filter((piece) => piece.effect)
              .map((piece) => (
                <div key={effectKey(piece)}>
                  <dt>
                    {piece.name} {piece.count}件套
                  </dt>
                  <dd>
                    <EffectDescription text={piece.effect} />
                  </dd>
                </div>
              ))}
          </dl>
        </ExplanationPopover>
        <div className="disc-guide__secondary-options" aria-label="搭配效果">
          {set.pieces
            .filter((piece) => piece.count === 2 && !sharedKeys.has(effectKey(piece)))
            .map((piece, index) => (
              <Fragment key={effectKey(piece)}>
                {index > 0 ? (
                  <span className="disc-guide__secondary-separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <span className="disc-guide__secondary-option">
                  {distinctDirections ||
                  set.pieces.filter((item) => item.count === 2).length > 1 ? (
                    <span className="disc-guide__secondary-name">{piece.name} 2件</span>
                  ) : null}
                  {piece.effect ? (
                    <span className="disc-guide__effect">
                      <EffectDescription text={piece.effect.replace(/[。.]\s*$/, '')} />
                    </span>
                  ) : null}
                </span>
              </Fragment>
            ))}
        </div>
      </div>
    </li>
  )
  return (
    <article className="loadout-recommendation-card loadout-recommendation-card--discs disc-guide">
      <header className="disc-guide__heading">
        <h3>驱动盘建议</h3>
        {guide.mainStatAlternatives?.length ? (
          <ExplanationPopover label="词条备选" title="按用途选择词条">
            {guide.mainStatAlternatives.map((alternative) => (
              <section key={`${alternative.label}-${alternative.sourceUrl}`}>
                <strong>{alternative.label}</strong>
                <p>{alternative.condition}</p>
                <a href={alternative.sourceUrl} target="_blank" rel="noreferrer">
                  查看攻略{alternative.sourceVersion ? ` · ${alternative.sourceVersion}` : ''}
                </a>
              </section>
            ))}
          </ExplanationPopover>
        ) : null}
        {shared.length ? (
          <div className="disc-guide__shared">
            {shared.map((piece) => (
              <strong key={effectKey(piece)}>
                {sharedHeading} · {piece.name} {piece.count}件套
              </strong>
            ))}
          </div>
        ) : null}
        {guide.directionNote ? (
          <ExplanationPopover label="选择说明">
            {guide.directionNote && (
              <p>
                <EffectDescription text={guide.directionNote} />
              </p>
            )}
          </ExplanationPopover>
        ) : null}
      </header>
      {guide.unavailableReason && <p role="status">{guide.unavailableReason}</p>}
      <ol className={`loadout-disc-options${distinctDirections ? ' has-distinct-directions' : ''}`}>
        {currentOptions.map(renderOption)}
      </ol>
      <dl className="loadout-main-stat-priority" aria-label="4、5、6号位主词条建议">
        {guide.mainStats.map((stat) => (
          <div key={stat.slot}>
            <dt>{stat.slot}</dt>
            <dd>
              {stat.value.split(/\s*\/\s*/).map((value, index) => (
                <span className="disc-guide__main-stat" key={value}>
                  {index > 0 ? ' / ' : ''}
                  {value}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
