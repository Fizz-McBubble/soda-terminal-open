import { getAgentName, getBangbooName } from './publicRosterNames'

export function playerFacingLabel(value: string | null | undefined) {
  if (
    !value ||
    /(?:bangboo-|build-knowledge-|agent-|wengine-|set-)/i.test(value) ||
    /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)+$/i.test(value)
  )
    return '资料待补齐'
  return value
}

export function playerFacingAgentLabel(value: string) {
  if (!value.startsWith('agent-')) return playerFacingLabel(value)
  const name = getAgentName(value)
  return name === value ? '资料待补齐' : name
}

export function playerFacingBangbooLabel(value: string) {
  if (!value.startsWith('bangboo-')) return playerFacingLabel(value)
  const name = getBangbooName(value)
  return name === value ? '资料待补齐' : name
}
