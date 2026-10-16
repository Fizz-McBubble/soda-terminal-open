export const TEAM_RECOMMENDATION_PAGE_SIZE = 10

export function TeamLoadoutPagination({
  label,
  page,
  pageCount,
  onPageChange,
}: {
  label: string
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const currentPage = Math.max(1, Math.min(page, pageCount))
  const changePage = (nextPage: number, source: HTMLButtonElement) => {
    const heading = source.closest('section')?.querySelector<HTMLElement>('h2, h3')
    onPageChange(nextPage)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }
  return (
    <nav className="f5v-box-team-recommendation-pagination" aria-label={label}>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={(event) => changePage(1, event.currentTarget)}
      >
        首页
      </button>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={(event) => changePage(currentPage - 1, event.currentTarget)}
      >
        上一页
      </button>
      <span aria-live="polite">
        第 {currentPage} / {pageCount} 页
      </span>
      <button
        type="button"
        disabled={currentPage === pageCount}
        onClick={(event) => changePage(currentPage + 1, event.currentTarget)}
      >
        下一页
      </button>
    </nav>
  )
}
