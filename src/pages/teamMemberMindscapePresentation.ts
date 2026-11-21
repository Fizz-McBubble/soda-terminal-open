import type {
  FormedTeamReference,
  TeamMemberCultivationFacts,
} from '../application/publicFormedTeamReference'
import { getAgentName } from '../application/publicRosterNames'

export type MemberMindscapeStatus =
  | 'met'
  | 'gap'
  | 'recorded'
  | 'unrecorded'
  | 'unowned'
  | 'reference_only'
  | 'unknown'
export type MemberMindscapeDisplay = {
  agentId: string
  name: string
  badgeText: string
  accessibleLabel: string
  status: MemberMindscapeStatus
  actualMindscape: number | 'unknown'
  referenceMindscape: number | undefined
  actualPotential: number | 'unknown' | null
  referencePotential: number | null | undefined
}

/** References describe targets; only typed roster facts describe current cultivation. */
export function resolveMemberMindscapeDisplay(
  agentId: string,
  reference?: FormedTeamReference,
  current?: TeamMemberCultivationFacts,
): MemberMindscapeDisplay {
  const name = getAgentName(agentId)
  const target = reference?.members.find((row) => row.agentId === agentId)
  const referenceMindscape = target?.mindscape
  const referencePotential = target?.potential
  const known = (value: number | null | undefined) =>
    value != null && Number.isInteger(value) && value >= 0 && value <= 6
  const actual = current?.owned === true && known(current.mindscape) ? current.mindscape! : null
  const actualPotential =
    current?.owned === true && known(current.potential) ? current.potential! : 'unknown'
  const referenceText = referenceMindscape === undefined ? '' : `，参考 ${referenceMindscape} 影`
  let status: MemberMindscapeStatus
  let badgeText: string
  let accessibleLabel: string
  if (current?.owned === false) {
    status = 'unowned'
    badgeText = '?'
    accessibleLabel = `${name}：尚未拥有${referenceText}`
  } else if (actual === null) {
    status = current?.owned === true ? 'unrecorded' : target ? 'reference_only' : 'unknown'
    badgeText = target ? `?→${referenceMindscape}` : '?'
    accessibleLabel = `${name}：影画未记录${referenceText}`
  } else {
    const missing = referenceMindscape !== undefined && actual < referenceMindscape
    status = missing ? 'gap' : target ? 'met' : 'recorded'
    badgeText = missing ? `${actual}→${referenceMindscape}` : String(actual)
    accessibleLabel = `${name}：当前 ${actual} 影${referenceText}`
  }
  if (referencePotential != null || (current?.owned === true && current.potential != null))
    accessibleLabel += `；潜能${actualPotential === 'unknown' ? '未记录' : actualPotential + '级'}${referencePotential == null ? '' : `，参考${referencePotential}级`}`
  return {
    agentId,
    name,
    badgeText,
    accessibleLabel,
    status,
    actualMindscape: actual ?? 'unknown',
    referenceMindscape,
    actualPotential:
      referencePotential == null && current?.potential == null ? null : actualPotential,
    referencePotential,
  }
}
