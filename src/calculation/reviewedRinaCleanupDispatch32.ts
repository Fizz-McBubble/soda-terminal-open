export const reviewedRinaCleanupDispatchIdentity32 = Object.freeze({
  revision: 'rina-cleanup-contact-splits-3.3-r2',
  dumpCommit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
  source: 'Data/_unsorted/Rina_Upgrade_01.json',
  sourceSha256: '1e0abd639580cdc2ffdbc852ba0a4a52fa3acaea0f5cea8995945130d1bfe5a5',
  receiverSource: 'Data/_unsorted/Rina_DrusillaAnastacia_Upgrade_01.json',
  receiverSha256: '5cac9f08ba4f86649680b72c1f08fefb694ad55e830cffa4b261086260c28390',
})

// Source animation 41..43 dispatches one stage. CNBetaWin3.3.4 hit tables
// identify the actual emitter, element and split within each source row.
// 1211026 has contacts, but dealt zero damage in all three logs.
export const rinaCleanupContactRefs32 = [
  'https://zzz.analytics.moe/db/run_1791630911911_kv93hie#sha256=ecf5f0578c07cdb366b2c39c420fbf0ef7a32a3623477d09b5cc731fec2c60c3',
  'https://zzz.analytics.moe/db/run_1791811520769_kg8c1sb#sha256=340ae0148bd5befbcba2bca573f9df46c51a664c6a341221e234d714663e0f11',
  'https://zzz.analytics.moe/db/run_1791812607517_fs4zbmr#sha256=d9ac1cceb4536471281cad7db17e124c996b12fe138d3dcbd913e34442427e23',
] as const

export const rinaCleanupStages32 = [
  {
    animation: 41,
    skillId: 1211023,
    eventId: 'basic.BasicAttackMorningCleanup.hit-0',
    attribute: 'physical',
    splits: [1 / 3, 1 / 3, 1 / 3],
  },
  {
    animation: 42,
    skillId: 1211024,
    eventId: 'basic.BasicAttackMorningCleanup.hit-1',
    attribute: 'physical',
    splits: Array<number>(7).fill(1 / 7),
  },
  {
    animation: 43,
    skillId: 1211025,
    eventId: 'basic.BasicAttackMorningCleanup.hit-2',
    attribute: 'electric',
    splits: [0.6, 0.2, 0.2],
    companion: {
      skillId: 1211026,
      attribute: 'electric',
      splits: [0.5, 0.25, 0.25],
      observedDamage: 0,
    },
  },
  {
    animation: 44,
    skillId: 1211027,
    eventId: 'basic.BasicAttackMidnightCleanup.hit-0',
    attribute: 'electric',
    splits: [...Array<number>(18).fill(0.05), 0.1],
  },
] as const
