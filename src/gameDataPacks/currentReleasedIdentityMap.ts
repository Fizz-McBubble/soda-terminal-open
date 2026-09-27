export const currentReleasedIdentitySourceRegistry = {
  schema: 'soda-released-identity-source-registry/v1',
  gameVersion: '3.1',
  sources: [
    {
      id: 'official-3.1-update-2026-07-29',
      url: 'https://zenless.hoyoverse.com/zh-cn/news/165414?catchSpider=1',
      sourceVersion: '3.1',
      publishedAt: '2026-07-29',
      checkedAt: '2026-09-04T00:00:00.000Z',
      contentHash: 'E1907C7DE561CEE48E38E38C70E29D4E9B21977C5D6D33177DC18D5AE8911AD2',
      stableIds: [
        'agent-remielle',
        'agent-sigrid',
        'wengine-14159',
        'bangboo-ariel',
        'set-34100',
        'set-34200',
      ],
      boundary:
        '官方更新公告用于版本、发布和可获取身份；不单独证明攻略排序、运行时热修、账户拥有或 Formal 计算。',
    },
  ],
} as const

export const currentReleasedIdentityMap = {
  schema: 'soda-released-identity-map/v1',
  gameVersion: '3.1',
  cutoff: '2026-08-19',
  entries: [
    {
      stableId: 'agent-remielle',
      aliases: ['candidate-3.1-agent-remielle'],
      gameEvidenceId: '1581',
      playerName: '蕾米埃尔·丹',
      releaseState: 'released',
      releaseAt: '2026-07-29',
      sourceRefs: ['official-3.1-update-2026-07-29'],
      boundary:
        '稳定项目身份与 released 状态已闭合；gameEvidenceId 和全部战斗/养成字段继续服从各自 Candidate/Formal 门。',
    },
    {
      stableId: 'agent-sigrid',
      aliases: ['candidate-3.1-agent-sigrid'],
      gameEvidenceId: '1591',
      playerName: '希格莉德·德拉叙尔',
      releaseState: 'released',
      releaseAt: '2026-08-19',
      sourceRefs: ['official-3.1-update-2026-07-29', 'game-evidence-3.1-sigrid-1591'],
      boundary:
        '3.1 Phase II 稳定项目身份与 released 状态已闭合；战斗、构筑和精确伤害字段继续服从 Candidate/Formal 门。',
    },
    {
      stableId: 'wengine-14159',
      aliases: ['candidate-3.1-wengine-knights-extolment'],
      gameEvidenceId: '14159',
      playerName: '骁骑礼赞',
      releaseState: 'released',
      releaseAt: '2026-08-19',
      sourceRefs: ['official-3.1-update-2026-07-29', 'game-evidence-3.1-wengine-14159'],
      boundary:
        '3.1 Phase II 发布、强攻类型与稳定 ID 已闭合；数值和被动来自锁定上游与公开结构化页，保持 Candidate，正式素材仍须独立补齐。',
    },
    {
      stableId: 'bangboo-ariel',
      aliases: [],
      gameEvidenceId: '54023',
      playerName: '艾瑞儿',
      releaseState: 'released',
      releaseAt: '2026-07-29',
      sourceRefs: ['official-3.1-update-2026-07-29', 'game-evidence-3.1-ariel-54023'],
      boundary:
        '3.1 更新公告闭合可获取与 released 状态；主动技、连携倍率和循环频率继续服从 Candidate/Formal 门。',
    },
    {
      stableId: 'set-34100',
      aliases: ['candidate-3.1-drive-disc-feathered-fate'],
      gameEvidenceId: '34100',
      playerName: '谶羽之誓',
      releaseState: 'released',
      releaseAt: '2026-07-29',
      sourceRefs: ['official-3.1-update-2026-07-29', 'game-evidence-3.1-drive-disc-34100'],
      boundary:
        '官方 3.1 更新公告闭合可获取与 released 状态；套装效果数值与本地化映射继续服从 Candidate/Formal 门。',
    },
    {
      stableId: 'set-34200',
      aliases: ['candidate-3.1-drive-disc-thorned-rose'],
      gameEvidenceId: '34200',
      playerName: '棘刺玫瑰',
      releaseState: 'released',
      releaseAt: '2026-07-29',
      sourceRefs: ['official-3.1-update-2026-07-29', 'game-evidence-3.1-drive-disc-34200'],
      boundary:
        '官方 3.1 更新公告闭合可获取与 released 状态；套装效果数值与本地化映射继续服从 Candidate/Formal 门。',
    },
  ],
} as const

export function getCurrentReleasedIdentity(identity: string) {
  return (
    currentReleasedIdentityMap.entries.find(
      (entry) =>
        entry.stableId === identity || (entry.aliases as readonly string[]).includes(identity),
    ) ?? null
  )
}

export function resolveCurrentReleasedIdentity(identity: string) {
  return getCurrentReleasedIdentity(identity)?.stableId ?? identity
}
