import { lazy, Suspense } from 'react'
import { CatalogReferencePublic } from './CatalogReferencePublic'
import type { CatalogReferenceProps } from './types'

const ReferencePanel =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? CatalogReferencePublic
    : lazy(() =>
        import('./CatalogReferenceLocal').then((module) => ({
          default: module.CatalogReferencePanel,
        })),
      )

export function CatalogReferencePanel(props: CatalogReferenceProps) {
  return (
    <Suspense fallback={<p role="status">正在读取图鉴…</p>}>
      <ReferencePanel {...props} />
    </Suspense>
  )
}
