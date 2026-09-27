export type TeamDeploymentOrder = [string, string, string]

/** Validate a player-selected order without consulting recommendation rules. */
export function isTeamDeploymentOrder(
  order: readonly string[] | undefined,
  memberIds: readonly string[],
): order is TeamDeploymentOrder {
  return Boolean(
    order?.length === 3 &&
    memberIds.length === 3 &&
    new Set(memberIds).size === 3 &&
    new Set(order).size === 3 &&
    order.every((id) => memberIds.includes(id)),
  )
}
