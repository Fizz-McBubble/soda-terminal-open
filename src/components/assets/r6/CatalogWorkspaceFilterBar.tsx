import { SelectMenu, type SelectMenuOption } from './SelectMenu'
import type { CatalogKind } from './types'

export function CatalogWorkspaceFilterBar({
  kind,
  kindLabel,
  query,
  onQueryChange,
  statusFilter,
  statusOptions,
  onStatusFilterChange,
  primaryFilter,
  primaryFilterOptions,
  onPrimaryFilterChange,
  secondaryFilter,
  secondaryFilterOptions,
  onSecondaryFilterChange,
}: {
  kind: CatalogKind
  kindLabel: string
  query: string
  onQueryChange: (query: string) => void
  statusFilter: string
  statusOptions: SelectMenuOption[]
  onStatusFilterChange: (status: string) => void
  primaryFilter: string
  primaryFilterOptions: SelectMenuOption[]
  onPrimaryFilterChange: (primary: string) => void
  secondaryFilter: string
  secondaryFilterOptions: SelectMenuOption[]
  onSecondaryFilterChange: (secondary: string) => void
}) {
  return (
    <div
      aria-label={`筛选${kindLabel}`}
      className={`filterbar${kind === 'discs' ? ' filterbar--discs' : kind === 'agents' ? ' filterbar--agents' : ''}`}
      role="group"
    >
      <input
        aria-label="搜索名称"
        placeholder="搜索名称"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {kind !== 'bangboos' ? (
        <SelectMenu
          label={kind === 'discs' || kind === 'wengines' ? '使用状态' : '拥有状态'}
          value={statusFilter}
          options={statusOptions}
          onChange={onStatusFilterChange}
        />
      ) : null}
      <SelectMenu
        label={kind === 'discs' ? '套装' : '稀有度'}
        value={primaryFilter}
        options={primaryFilterOptions}
        onChange={onPrimaryFilterChange}
      />
      {kind !== 'bangboos' && (
        <SelectMenu
          label={kind === 'discs' ? '号位' : '特性'}
          value={secondaryFilter}
          options={secondaryFilterOptions}
          onChange={onSecondaryFilterChange}
        />
      )}
    </div>
  )
}
