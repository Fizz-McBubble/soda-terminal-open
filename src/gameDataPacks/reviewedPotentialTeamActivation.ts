/** Source-reviewed activation deltas, separate from numeric potential effects. */
export const reviewedPotentialTeamActivation = [
  {
    agentId: 'agent-ellen',
    minimum: 1,
    specialty: 'stun',
    source: {
      postId: '65170849',
      url: 'https://www.miyoushe.com/zzz/article/65170849',
      sourceVersion: '2.0',
      checkedAt: '2026-09-10',
      archivedFile:
        'source/miyoushe-2.8-source-boundary-r1/collections/3108686-bd1d5b53682643c4.json',
      archivedFileSha256: '1a71b24cead501819b579777441ac860efb537434084c62fba1bcd0b19e8b3dd',
      locators: [
        'structured_content op31 insert.fold; unitRawSha256=71eca0eadcf85cc09c6ad8fc1ae20fcc1a5e0ff586a08c8d0ddad6cf2d1c75ec',
        '触发条件：队伍中存在与自身属性/阵营相同或[击破]特性的角色（注：击破需要开启潜能后才可触发）',
      ],
    },
  },
  {
    agentId: 'agent-lycaon',
    minimum: 1,
    specialty: 'anomaly',
    source: {
      postId: '73045858',
      url: 'https://www.miyoushe.com/zzz/article/73045858',
      sourceVersion: '2.6',
      checkedAt: '2026-09-10',
      archivedFile:
        'source/preferred-author-corpus-r1-collections/raw/collections/2716049-13f1c6bedb43a89b.json',
      archivedFileSha256: '5ed94053d19bd1d3aff6b944a534998a9a1d64d7568ee6d1589d050a0d46097e',
      locators: [
        'structured_content op109 image247682881; imageSha256=4f1ee9e5a813f741713dd8d6a6636450edaa2684555ee16f6d5cd0a9f5077c93',
        '[潜能影像·狩猎的风度]在解锁01后，代理人获得全部的机制性补强，02-06均为数值层面补强；',
        '额外能力除原有的同属性、同阵营条件外，新增了[异常]代理人的配队选项',
      ],
    },
  },
  {
    agentId: 'agent-nekomata',
    minimum: 1,
    specialty: 'support',
    source: {
      postId: '76994144',
      url: 'https://www.miyoushe.com/zzz/article/76994144',
      sourceVersion: '3.1',
      checkedAt: '2026-09-08',
      archivedFile:
        'source/preferred-author-corpus-r1-collections/raw/collections/2716049-13f1c6bedb43a89b.json',
      archivedFileSha256: '5ED94053D19BD1D3AFF6B944A534998A9A1D64D7568EE6D1589D050A0D46097E',
      locators: [
        '[潜能影像·猫的报恩]在解锁01后，代理人获得全部的机制性补强，02-06均为数值层面补强；',
        '此外额外能力新增[支援]角色扩展配队思路',
      ],
    },
  },
] as const
