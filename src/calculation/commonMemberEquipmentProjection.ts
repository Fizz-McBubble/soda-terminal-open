/** Project only explicitly identified recipients from this formation onto its
 * common members. Missing, malformed and foreign identities stay observable. */
export function projectCommonMemberEquipmentRows(
  rows: readonly unknown[],
  memberIds: readonly string[],
  commonMemberIds: readonly string[],
): unknown[] {
  const members = new Set(memberIds)
  const common = new Set(commonMemberIds)
  const replaced = (id: unknown) => typeof id === 'string' && members.has(id) && !common.has(id)
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value))
      return value
        .filter((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true
          return !replaced((entry as Record<string, unknown>).recipientAgentId)
        })
        .map(visit)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      key === 'recipientAgentIds' && Array.isArray(entry)
        ? entry.filter((id) => !replaced(id)).map(visit)
        : visit(entry),
    ]))
  }
  return visit(rows) as unknown[]
}
