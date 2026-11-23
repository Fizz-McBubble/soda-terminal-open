import { useState } from 'react'
import type { TeamExecutionDiscPresentation, TeamExecutionPresentation } from './teamExecutionPresentation'
import { getMatchedAttributeKeysForDisc, getStatKeysForAttributeKeyOrLabel, isDiscMatchingAttribute } from './teamLoadoutAttributeLinkage'

type Selection = { scope: string; memberId: string; kind: 'disc' | 'attribute'; key: string }

export function useTeamDiscAttributeLinkage(view: TeamExecutionPresentation, selectedMemberId: string, selectMember: (id: string) => void) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const scope = view.members.map(member => [member.agentId, ...member.discFacts.map(disc => disc.id)].join('|')).join(';')
  const member = view.members.find(item => item.agentId === selectedMemberId) ?? view.members[0]
  const current = selection?.scope === scope && selection.memberId === member?.agentId ? selection : null
  const selectedDiscId = current?.kind === 'disc' ? current.key : null
  const selectedAttributeKey = current?.kind === 'attribute' ? current.key : null
  const disc = selectedDiscId && member?.discFacts.find(item => item.id === selectedDiscId)
  const statKeys = selectedAttributeKey ? getStatKeysForAttributeKeyOrLabel(selectedAttributeKey) : []

  function handleDiscSelect(disc: TeamExecutionDiscPresentation, owner: string) {
    selectMember(owner)
    setSelection(selectedDiscId === disc.id ? null : { scope, memberId: owner, kind: 'disc', key: disc.id })
  }
  function handleAttributeSelect(key: string) {
    if (member) setSelection(selectedAttributeKey === key ? null : { scope, memberId: member.agentId, kind: 'attribute', key })
  }
  function isDiscHighlighted(disc: TeamExecutionDiscPresentation, owner: string) {
    return owner === member?.agentId && statKeys.length > 0 && isDiscMatchingAttribute(disc, statKeys)
  }
  return { selectedDiscId, selectedAttributeKey, matchedAttributeKeys: disc ? getMatchedAttributeKeysForDisc(disc) : undefined,
    handleDiscSelect, handleAttributeSelect, isDiscHighlighted, handleDeselect: () => setSelection(null) }
}
