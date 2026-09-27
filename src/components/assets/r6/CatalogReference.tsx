import { CatalogReferencePublic } from './CatalogReferencePublic'
import type { CatalogItem } from './types'

type CatalogReferenceProps = {
  item: CatalogItem
  skillLevel?: number
  additionalAbilityLevel?: number
}

const ReferencePanel =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? CatalogReferencePublic
    : (await import('./CatalogReferenceLocal')).CatalogReferencePanel

export function CatalogReferencePanel(props: CatalogReferenceProps) {
  return <ReferencePanel {...props} />
}
