import type { ComponentProps, ReactNode } from 'react'
import { TeamLoadoutEntityPortraits } from './TeamLoadoutEntityPortraits'

/** The same portrait and identity structure serves recommendation and saved rows. */
export function TeamLoadoutRowContent({
  item,
  title,
  rating,
  meta,
}: {
  item: ComponentProps<typeof TeamLoadoutEntityPortraits>['item']
  title: string
  rating?: ReactNode
  meta?: ReactNode
}) {
  return (
    <>
      <TeamLoadoutEntityPortraits item={item} />
      <span className="f5v-box-team-row__identity">
        <span className="f5v-box-team-card__title-line">
          <strong>{title}</strong>
          {rating}
        </span>
        {meta ? <span className="f5v-box-team-card__meta-line">{meta}</span> : null}
      </span>
    </>
  )
}
