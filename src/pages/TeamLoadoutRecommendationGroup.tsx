import { type ReactNode } from 'react'
import { TeamCompletionCandidates, TeamRow } from './TeamLoadoutOverviewParts'
import type { TeamLoadoutOverviewGroup, TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'

export function TeamGroup({
  group,
  selectedId,
  activeVariants,
  onSelect,
  onDeleteSaved,
  recommendedQuery,
  onRecommendedQueryChange,
  recommendedPage = 1,
  recommendedPageCount = 1,
  onRecommendedPageChange,
  onlyFavorites = false,
  onOnlyFavoritesChange,
  scopeActions,
}: {
  scopeActions?: ReactNode
  group: TeamLoadoutOverviewGroup
  selectedId: string
  activeVariants: Record<string, string>
  onSelect: (id: string) => void
  onDeleteSaved?: (item: TeamLoadoutOverviewItem) => void
  recommendedQuery?: string
  onRecommendedQueryChange?: (query: string) => void
  recommendedPage?: number
  recommendedPageCount?: number
  onRecommendedPageChange?: (page: number) => void
  onlyFavorites?: boolean
  onOnlyFavoritesChange?: (checked: boolean) => void
}) {
  const isRecommended = group.kind === 'recommended'
  const changeRecommendedPage = (page: number, source: HTMLButtonElement) => {
    const heading = source.closest('section')?.querySelector<HTMLElement>('h2')
    onRecommendedPageChange?.(page)
    if (heading) {
      heading.focus({ preventScroll: true })
      heading.scrollIntoView?.({ block: 'start', behavior: 'instant' })
    }
  }
  const pagination =
    isRecommended && recommendedPageCount > 1 ? (
      <nav className="f5v-box-team-recommendation-pagination" aria-label="当前推荐分页（底部）">
        <button
          type="button"
          disabled={recommendedPage === 1}
          onClick={(event) => changeRecommendedPage(1, event.currentTarget)}
        >
          首页
        </button>
        <button
          type="button"
          disabled={recommendedPage === 1}
          onClick={(event) => changeRecommendedPage(recommendedPage - 1, event.currentTarget)}
        >
          上一页
        </button>
        <span aria-live="polite">
          第 {recommendedPage} / {recommendedPageCount} 页
        </span>
        <button
          type="button"
          disabled={recommendedPage === recommendedPageCount}
          onClick={(event) => changeRecommendedPage(recommendedPage + 1, event.currentTarget)}
        >
          下一页
        </button>
      </nav>
    ) : null
  if (!group.items.length && group.completionCandidates?.length) {
    return <TeamCompletionCandidates candidates={group.completionCandidates} />
  }
  return (
    <section className={`f5v-box-team-group is-${group.kind}`}>
      <div className={isRecommended ? 'f5v-box-team-toolbar' : undefined}>
        <h2 tabIndex={isRecommended ? -1 : undefined}>{group.label}</h2>
        {!isRecommended ? (
          <p className="f5v-box-team-group__description">{group.description}</p>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-recommendation-search">
            <input
              type="search"
              aria-label="搜索队名或成员"
              value={recommendedQuery ?? ''}
              onChange={(event) => onRecommendedQueryChange?.(event.target.value)}
              placeholder="输入队名或成员名"
            />
          </label>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-favorites-filter">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) => onOnlyFavoritesChange?.(event.target.checked)}
            />
            收藏角色
          </label>
        ) : null}
        {isRecommended ? scopeActions : null}
      </div>
      <div role="list" aria-label={group.label}>
        {group.items.map((family) => (
          <div key={family.id} role="listitem" className="f5v-box-team-row-shell">
            <TeamRow
              family={family}
              selected={family.id === selectedId}
              activeVariantId={activeVariants[family.id]}
              onSelect={() => onSelect(family.id)}
            />
            {group.kind === 'saved' && onDeleteSaved ? (
              <button
                className="f5v-box-team-row-delete"
                type="button"
                onClick={() => onDeleteSaved(family.variants[0]!)}
                aria-label={`删除已保存方案 ${family.title}`}
              >
                删除
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {pagination}
      {isRecommended && group.items.length === 0 ? (
        <div className="f5v-box-team-recommendation-empty" role="status">
          <p>
            {recommendedQuery?.trim()
              ? '没有找到相关队伍，试试其他队名或成员名。'
              : onlyFavorites
                ? '当前没有包含收藏角色的搭配，可取消筛选查看其他队伍。'
                : '暂未找到推荐队伍，可搜索成员查看搭配。'}
          </p>
          {recommendedQuery?.trim() ? (
            <button
              type="button"
              className="f5v-box-team-recommendation-more"
              onClick={() => onRecommendedQueryChange?.('')}
            >
              清除搜索
            </button>
          ) : null}
        </div>
      ) : null}
      <TeamCompletionCandidates candidates={group.completionCandidates ?? []} />
    </section>
  )
}
