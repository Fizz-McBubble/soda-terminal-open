import { stableContentHash } from './types'

export type SourceSnapshot = {
  id: string
  sourceId: string
  url: string
  observedAt: string
  gameVersion: string | null
  status: 'formal' | 'candidate' | 'reference-only'
  summary: string
  contentHash: string
  fieldPaths: string[]
}

const createSnapshot = (input: Omit<SourceSnapshot, 'contentHash'>): SourceSnapshot => ({
  ...input,
  contentHash: stableContentHash(input),
})

/**
 * Small, page-level snapshots only. They record the source identity and the fields we may derive;
 * no page body, image, or third-party raw dataset is bundled.
 */
export const currentSourceSnapshots: SourceSnapshot[] = [
  createSnapshot({
    id: 'official-3.0-live-2026-07-27',
    sourceId: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/',
    observedAt: '2026-07-27T00:00:00.000Z',
    gameVersion: '3.0',
    status: 'formal',
    summary: '官方首页明确当前 3.0 版本已上线，并展示当前角色目录。',
    fieldPaths: ['package.current_version', 'catalog.agent.identity'],
  }),
  createSnapshot({
    id: 'official-3.0-phase-2-2026-07-08',
    sourceId: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/zh-cn/news/165160?catchSpider=1',
    observedAt: '2026-07-27T00:00:00.000Z',
    gameVersion: '3.0',
    status: 'formal',
    summary: '官方 3.0 内容公告核对诺姆、千夏及对应限时音擎的目录/版本事实。',
    fieldPaths: [
      'catalog.agent.agent-norma',
      'catalog.agent.agent-sunna',
      'catalog.wengine.identity',
    ],
  }),
  createSnapshot({
    id: 'official-3.1-announcement-2026-07-17',
    sourceId: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/en-us/news/165249?catchSpider=1',
    observedAt: '2026-07-27T00:00:00.000Z',
    gameVersion: '3.1',
    status: 'candidate',
    summary: '官方公告称 3.1 将于 2026-07-29 上线；上线前仅可作为候选增量来源。',
    fieldPaths: ['package.next_version', 'catalog.agent.additions', 'catalog.wengine.additions'],
  }),
  createSnapshot({
    id: 'official-3.1-live-scope-2026-07-29',
    sourceId: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/zh-tw/news/165249?catchSpider=1&page=news',
    observedAt: '2026-07-30T00:00:00.000Z',
    gameVersion: '3.1',
    status: 'formal',
    summary:
      '官方公告确认 3.1「漫长的告别」于 7 月 29 日正式上线并点名蕾米埃尔；仅当前版本与公告直接列出的目录范围为 formal，未公开战斗字段仍独立 candidate/missing。',
    fieldPaths: ['package.current_version', 'catalog.agent.addition.remielle.release_scope'],
  }),
  createSnapshot({
    id: 'official-3.1-deadly-assault-2026-07-27',
    sourceId: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/en-us/news/165369?catchSpider=1',
    observedAt: '2026-07-29T00:00:00.000Z',
    gameVersion: '3.1',
    status: 'formal',
    summary:
      '官方系统说明确认 3.1 危局强袭战更新范围；该范围事实为 formal，固定敌人、DEF/RES/失衡和轮换字段仍独立 missing。',
    fieldPaths: ['mode.deadly_assault.change_scope'],
  }),
  createSnapshot({
    id: 'baha-damage-mechanics-2026-07-28',
    sourceId: 'baha-damage-mechanics',
    url: 'https://forum.gamer.com.tw/Co.php?bsn=74860&sn=32943',
    observedAt: '2026-07-28T00:00:00.000Z',
    gameVersion: null,
    status: 'reference-only',
    summary:
      '社区伤害种类与乘区文章。保存最小公式/机制定位，用于 QQ 历史字段和现有候选的交叉验证；分段版本未完全可证，不能直接进入 formal。',
    fieldPaths: [
      'damage.direct.skill_multiplier',
      'damage.anomaly',
      'damage.disorder',
      'enemy.def_res_daze_phase',
      'damage.multiplier_area',
    ],
  }),
  createSnapshot({
    id: 'qq-sheet-historical-2.6-offline-2026-07-28',
    sourceId: 'qq-sheet-historical',
    url: 'https://docs.qq.com/sheet/DUHBodnJVQ1pKcFl4?tab=BB08J2',
    observedAt: '2026-07-28T00:00:00.000Z',
    gameVersion: '2.6',
    status: 'reference-only',
    summary:
      '用户提供的“附表（停更）”离线历史快照。仅记录字段结构与最小候选交叉；许可未声明，不参与 formal 或线上运行时读取。',
    fieldPaths: [
      'agent.skill_multiplier',
      'wengine.base_and_passive',
      'enemy.def_res_daze_phase',
      'bangboo.skill',
      'drive_disc_set.modifier',
    ],
  }),
  createSnapshot({
    id: 'github-zzz-calculator-3a2e838-reference',
    sourceId: 'github-zzz-calculator',
    url: 'https://github.com/ZztIsolation/zzz_calculator/tree/3a2e838adb0e91e501b575d0503a272f9d6ce06d',
    observedAt: '2026-07-30T00:00:00.000Z',
    gameVersion: '3.1',
    status: 'reference-only',
    summary: '公开仓库未检测到根 LICENSE；仅登记提交与字段/公式契约定位，禁止复制代码或数据。',
    fieldPaths: ['reference.formula_contract', 'reference.catalog_delta_shape'],
  }),
  createSnapshot({
    id: 'github-scanner-next-b4f3b53-mit',
    sourceId: 'github-scanner-next',
    url: 'https://github.com/ZztIsolation/ZZZ-Scanner.Next/tree/b4f3b53f6e9acb1f42af1a68c63cfe326bf912d4',
    observedAt: '2026-07-30T00:00:00.000Z',
    gameVersion: '3.1',
    status: 'reference-only',
    summary: 'MIT 仓库；本节点只登记结构化数据/契约价值，不接扫描、不复制实现。',
    fieldPaths: ['reference.scanner_data_contract'],
  }),
  createSnapshot({
    id: 'github-frzyc-zzz-9617fb-mit',
    sourceId: 'github-frzyc-zzz',
    url: 'https://github.com/frzyc/genshin-optimizer/tree/9617fb58334cfe84e26252041fb9510c34057f62/libs/zzz',
    observedAt: '2026-07-30T00:00:00.000Z',
    gameVersion: null,
    status: 'reference-only',
    summary: 'MIT 锁定提交；沿用项目既有 NOTICE。当前节点只记录适配身份，不改公式或求解。',
    fieldPaths: ['reference.upstream_formula_identity', 'reference.upstream_solver_identity'],
  }),
]

export function snapshotsForVersion(gameVersion: string) {
  return currentSourceSnapshots.filter((snapshot) => snapshot.gameVersion === gameVersion)
}

export function canUseSnapshotForFormal(snapshot: SourceSnapshot) {
  return snapshot.status === 'formal' && snapshot.sourceId === 'official-zzz'
}
