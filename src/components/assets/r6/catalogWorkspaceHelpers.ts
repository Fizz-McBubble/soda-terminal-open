import type { AssetGoldenProps, CatalogKind } from './types'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'

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
  if (props.accountId === 'no-account') return false
  if (kind === 'agents') return props.roster.agents.some((row) => row.agentId === id && row.owned)
  if (kind === 'bangboos')
    return props.roster.bangboos.some((row) => row.bangbooId === id && row.owned)
  if (kind === 'wengines')
    return props.roster.agents.some((row) => row.owned && row.wEngineDetails.id === id)
  return false
}

export function specialtyLabel(value: string) {
  const label = getAgentSpecialtyLabel(value)
  if (label !== '资料待补齐' && label !== '未知特性') return label
  return /[\u4e00-\u9fff]/u.test(value) ? value : '未知特性'
}

export function factsLabel(props: AssetGoldenProps, kind: CatalogKind, id: string) {
  if (props.accountId === 'no-account') return ''
  if (kind === 'agents') {
    const row = props.roster.agents.find((x) => x.agentId === id)
    return row?.owned ? `已拥有 · Lv ${row.level} · 影${row.mindscape}` : ''
  }
  if (kind === 'bangboos') return ''
  if (kind === 'wengines') {
    const count = props.roster.agents.filter((x) => x.owned && x.wEngineDetails.id === id).length
    return count ? `${count} 人当前使用` : ''
  }
  return ''
}
