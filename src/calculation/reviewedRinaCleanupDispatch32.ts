/** Source scheduler rotates Morning1→2→3, one command per2.5s. The
 * published numeric rows do not bind those commands to physical/electric
 * damage properties. Keep their identities readable, but reject a fabricated
 * all-electric or three-rows-per-tick damage result. Midnight has a separate,
 * explicitly electric official row and is unaffected by this guard. */
export const reviewedRinaCleanupDispatchIdentity32 = Object.freeze({
  revision: 'rina-cleanup-one-row-per-tick-element-binding-pending-r1',
  dumpCommit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
  source: 'Data/_unsorted/Rina_Upgrade_01.json',
  sourceSha256: '1e0abd639580cdc2ffdbc852ba0a4a52fa3acaea0f5cea8995945130d1bfe5a5',
  receiverSource: 'Data/_unsorted/Rina_DrusillaAnastacia_Upgrade_01.json',
  receiverSha256: '5cac9f08ba4f86649680b72c1f08fefb694ad55e830cffa4b261086260c28390',
})

export function reviewedRinaCleanupDispatchGap32(agentId: string, eventId: string) {
  return agentId === 'agent-rina' && /^basic\.BasicAttackMorningCleanup\.hit-[012]$/.test(eventId)
    ? '丽娜净洁黎明尚缺动画索引到数值行及物理／电属性的来源绑定，不能按全电或每次三行结算。'
    : null
}
