import { ChevronLeft } from 'lucide-react'
import type { MouseEventHandler } from 'react'
import { Link, type To } from 'react-router-dom'

type BackNavigationBase = {
  /** Omit the label to use the product-wide parent-route wording. */
  label?: string
  className?: string
}

type BackNavigationLinkProps = BackNavigationBase & {
  to: To
  onClick?: never
}

type BackNavigationButtonProps = BackNavigationBase & {
  to?: never
  onClick: MouseEventHandler<HTMLButtonElement>
}

export type BackNavigationProps = BackNavigationLinkProps | BackNavigationButtonProps

/** Shared player-facing control for returning to the immediate parent route or flow. */
export function BackNavigation({
  label = '返回上一级',
  className,
  ...action
}: BackNavigationProps) {
  const classes = ['back-navigation', className].filter(Boolean).join(' ')
  const content = (
    <>
      <ChevronLeft aria-hidden="true" size={16} />
      <span>{label}</span>
    </>
  )

  if (action.to !== undefined) {
    return (
      <Link className={classes} to={action.to}>
        {content}
      </Link>
    )
  }

  return (
    <button className={classes} type="button" onClick={action.onClick}>
      {content}
    </button>
  )
}
