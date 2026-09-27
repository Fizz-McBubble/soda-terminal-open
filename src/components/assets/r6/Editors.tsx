import { AgentEditor } from './AgentEditor'
import { BangbooEditor, DiscEditor, WEngineEditor } from './SecondaryEditors'
import type { AssetGoldenProps, CatalogItem, CatalogKind, DiscItem } from './types'

export function Editor({
  props,
  kind,
  item,
}: {
  props: AssetGoldenProps
  kind: CatalogKind
  item: CatalogItem | DiscItem
}) {
  if (kind === 'agents')
    return <AgentEditor key={item.stableId} props={props} item={item as CatalogItem} />
  if (kind === 'wengines')
    return <WEngineEditor key={item.stableId} props={props} item={item as CatalogItem} />
  if (kind === 'bangboos')
    return <BangbooEditor key={item.stableId} props={props} item={item as CatalogItem} />
  return <DiscEditor key={item.stableId} props={props} item={item as DiscItem} />
}
