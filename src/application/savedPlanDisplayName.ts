import type { AccountPlanningDraft } from '../accounts/types'
import { getAgentName } from './publicRosterNames'

/** Localize known member aliases only; preserve the user's remaining title and stored record. */
export function localizedAgentNames(text: string, memberIds: readonly string[]) {
  return memberIds.reduce((label, id) => {
    const name = getAgentName(id)
    if (name === id || !id.startsWith('agent-')) return label
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const alias = id.slice(6).split('-').map(escape).join('[\\s_-]*')
    return label.replace(
      new RegExp(`(?<![a-z0-9])(?:${escape(id)}|${alias})(?![a-z0-9])`, 'gi'),
      name,
    )
  }, text)
}

export function savedPlanDisplayName(plan: Pick<AccountPlanningDraft, 'name' | 'selection'>) {
  return playerFacingPlanName(plan.name, plan.selection.agentIds)
}

export function playerFacingPlanName(name: string, memberIds: readonly string[]) {
  return localizedAgentNames(name, memberIds).replace(
    /(^|[·：:]\s*)当前单人(?:参考)?方案\s*$/u,
    '$1养成方案',
  )
}
