import type { CatalogItem } from './types'

export function CatalogReferencePublic({ item }: { item: CatalogItem }) {
  if (
    item.entityType !== 'wengine' &&
    item.entityType !== 'bangboo' &&
    item.entityType !== 'drive_disc_set'
  )
    return null

  return (
    <section className="editor-section catalog-reference" aria-label="图鉴详情">
      <h3>图鉴详情</h3>
      <p>详细属性与效果请在游戏内图鉴查看。</p>
    </section>
  )
}
