const localOrderTeamMembers =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : (await import('../decision/teamDeployment')).orderTeamMembers

/** Display a server-supplied order; keep the recorded order when no exact
 * order was supplied. The desktop route retains its existing local fallback. */
export function orderTeamMembersForDisplay<T>(
  members: readonly T[],
  memberId: (member: T) => string,
  order?: readonly string[],
): T[] {
  if (localOrderTeamMembers) return localOrderTeamMembers(members, memberId, order)
  const ids = members.map(memberId)
  if (
    ids.length !== 3 ||
    new Set(ids).size !== 3 ||
    order?.length !== 3 ||
    new Set(order).size !== 3 ||
    !order.every((id) => ids.includes(id))
  )
    return [...members]
  const byId = new Map(members.map((member) => [memberId(member), member]))
  return order.map((id) => byId.get(id)!)
}
