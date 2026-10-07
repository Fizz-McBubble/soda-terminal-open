import { CATALOG_PAGE_SIZE } from './useCatalogPagination'

export function CatalogPagination({
  pagination,
  total,
}: {
  pagination: { page: number; pages: number; start: number; change: (page: number) => void }
  total: number
}) {
  if (pagination.pages === 1) return null
  return (
    <nav className="catalog-foot" aria-label="目录分页">
      <button
        className="quiet"
        disabled={pagination.page === 0}
        onClick={() => pagination.change(pagination.page - 1)}
      >
        上一页
      </button>
      <span role="status">
        第 {pagination.page + 1} / {pagination.pages} 页 · 显示 {pagination.start + 1}–
        {Math.min(total, pagination.start + CATALOG_PAGE_SIZE)} / {total}
      </span>
      <button
        className="quiet"
        disabled={pagination.page === pagination.pages - 1}
        onClick={() => pagination.change(pagination.page + 1)}
      >
        下一页
      </button>
    </nav>
  )
}
