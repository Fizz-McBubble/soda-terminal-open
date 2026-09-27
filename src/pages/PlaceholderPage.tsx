import { ArrowLeft, Construction } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { allNavigationItems, getRouteMeta } from '../navigation'

export function PlaceholderPage() {
  const location = useLocation()
  const item = allNavigationItems.find((candidate) => candidate.path === location.pathname)
  const meta = getRouteMeta(location.pathname)
  const isUnknown = !item
  return (
    <section className="placeholder-page">
      <span className="placeholder-page__icon">
        <Construction size={31} />
      </span>
      <span className="eyebrow">{isUnknown ? 'LINK NOT FOUND' : 'PLANNED MILESTONE'}</span>
      <h1>{isUnknown ? '页面不存在' : item.label}</h1>
      <p>
        {isUnknown
          ? '这个链接无效，或对应对象已经不存在。你可以返回总览继续操作。'
          : `${item.description}。该功能尚未开放，当前入口用于确认信息架构。`}
      </p>
      <Link className="button button--ghost" to={meta.backTo ?? '/'}>
        <ArrowLeft size={17} /> {meta.backLabel ?? '返回总览'}
      </Link>
    </section>
  )
}
