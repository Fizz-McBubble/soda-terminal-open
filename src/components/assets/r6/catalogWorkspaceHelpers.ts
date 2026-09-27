import type { AssetGoldenProps, CatalogKind } from './types'

export function incomingDiscSelection(kind: CatalogKind, accountId: string, search: string) {
  if (kind !== 'discs') return undefined
  const params = new URLSearchParams(search)
  return params.get('account') === accountId ? (params.get('selected') ?? undefined) : undefined
}

export function discWorkspacePath(path: string, selectedId: string | undefined, accountId: string) {
  return selectedId
    ? `${path}?selected=${encodeURIComponent(selectedId)}&account=${encodeURIComponent(accountId)}`
    : path
}

export function isOwned(props: AssetGoldenProps, kind: CatalogKind, id: string) {
  if (kind === 'agents') return props.roster.agents.some((row) => row.agentId === id && row.owned)
  if (kind === 'bangboos')
    return props.roster.bangboos.some((row) => row.bangbooId === id && row.owned)
  if (kind === 'wengines') return props.roster.agents.some((row) => row.wEngineDetails.id === id)
  return false
}

export function specialtyLabel(value: string) {
  return (
    {
      anomaly: '异常',
      damage: '强攻',
      defense: '防护',
      rupture: '命破',
      stun: '击破',
      support: '支援',
    }[value] ?? value
  )
}

export function factsLabel(props: AssetGoldenProps, kind: CatalogKind, id: string) {
  if (kind === 'agents') {
    const row = props.roster.agents.find((x) => x.agentId === id)
    return row?.owned ? `Lv ${row.level} · 影${row.mindscape}` : ''
  }
  if (kind === 'bangboos') return ''
  if (kind === 'wengines') {
    const count = props.roster.agents.filter((x) => x.wEngineDetails.id === id).length
    return count ? `${count} 人使用中` : ''
  }
  return ''
}
