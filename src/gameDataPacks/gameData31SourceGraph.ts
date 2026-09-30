import { canonicalSourceCensus } from './canonicalBaseline'
import { gameData31CatalogIntake } from './gameData31CatalogIntake'
export type GameData31SourceNode = {
  id: string
  label: string
  url: string
  tier:
    | 'official'
    | 'game-evidence'
    | 'community-candidate'
    | 'licensed-upstream'
    | 'reference-only'
  sourceVersion: string | null
  checkedAt: string
  contentIdentity: string | null
  licenseBoundary: string
}
export const checkedAt = '2026-07-30T00:00:00.000Z'

export const announcementUrl =
  'https://zenless.hoyoverse.com/zh-tw/news/165249?catchSpider=1&page=news'

const liveActivityUrl = 'https://zenless.hoyoverse.com/zh-cn/news/165388?catchSpider=1'

export const deadlyAssaultUrl = 'https://zenless.hoyoverse.com/en-us/news/165369?catchSpider=1'

export const officialSources: GameData31SourceNode[] = [
  {
    id: 'official-3.1-launch',
    label: '绝区零 3.1 版本上线公告',
    url: announcementUrl,
    tier: 'official',
    sourceVersion: '3.1',
    checkedAt,
    contentIdentity: 'sha256-cdf156b004b7635d61796a553544a68bbebf6e0fd8050487f8acdc883f2a266e',
    licenseBoundary: '仅保存版本、日期与目录身份等最小官方事实；不复制页面正文或图片。',
  },
  {
    id: 'official-3.1-live-scope',
    label: '绝区零 3.1 当前活动范围',
    url: liveActivityUrl,
    tier: 'official',
    sourceVersion: '3.1',
    checkedAt,
    contentIdentity: 'sha256-cdf156b004b7635d61796a553544a68bbebf6e0fd8050487f8acdc883f2a266e',
    licenseBoundary: '仅用于证明活动已处于“3.1版本更新后”范围；不复制页面正文或图片。',
  },
  {
    id: 'official-3.1-deadly-assault',
    label: '绝区零 3.1 危局绝境系统说明',
    url: deadlyAssaultUrl,
    tier: 'official',
    sourceVersion: '3.1',
    checkedAt,
    contentIdentity: 'official-news-165369-2026-07-27',
    licenseBoundary: '只保存玩法范围事实；敌人、轮换和数值字段未公开时保持 missing。',
  },
]

const baselineSources: GameData31SourceNode[] = canonicalSourceCensus.map((source) => ({
  id: source.id,
  label: source.label,
  url: source.url,
  tier:
    source.tier === 'official'
      ? 'official'
      : source.tier === 'community-candidate'
        ? 'community-candidate'
        : 'reference-only',
  sourceVersion: source.sourceVersion,
  checkedAt: source.checkedAt,
  contentIdentity: source.contentHash ?? source.snapshotIdentity,
  licenseBoundary: `${source.licenseBoundary} ${source.conversionBoundary}`,
}))

const intakeSources: GameData31SourceNode[] = gameData31CatalogIntake.entities.map((entity) => ({
  id: entity.source.id,
  label: `${entity.displayName} 3.1 字段来源`,
  url: entity.source.url,
  tier: entity.identity.kind === 'game_evidence' ? 'game-evidence' : 'community-candidate',
  sourceVersion: entity.source.sourceVersion,
  checkedAt: entity.source.checkedAt,
  contentIdentity: entity.source.contentHash,
  licenseBoundary: entity.source.licenseBoundary,
}))

const calculationReferenceSources: GameData31SourceNode[] = [
  {
    id: 'baha-user-formula-article',
    label: '巴哈姆特伤害公式与乘区文章',
    url: 'https://forum.gamer.com.tw/C.php?bsn=74860&snA=6498',
    tier: 'reference-only',
    sourceVersion: null,
    checkedAt,
    contentIdentity: 'sha256-8aefa97f0f3e9fafb4202698e608ebaa53453183e0a64d74340d95b040fe46ce',
    licenseBoundary: '只保留最小公式结构定位与页面身份；不复制作者正文、图片或数值表。',
  },
  {
    id: 'github-frzyc-zzz-formula',
    label: 'frzyc/genshin-optimizer ZZZ 公式与求解地基',
    url: 'https://github.com/frzyc/genshin-optimizer/tree/9617fb58334cfe84e26252041fb9510c34057f62/libs/zzz',
    tier: 'licensed-upstream',
    sourceVersion: 'commit-9617fb58334cfe84e26252041fb9510c34057f62',
    checkedAt,
    contentIdentity: 'git-9617fb58334cfe84e26252041fb9510c34057f62',
    licenseBoundary: 'MIT；仅按项目既有 NOTICE 与锁定提交适配，不自动升级提交或复制无关前端。',
  },
  {
    id: 'github-zzt-zzz-calculator',
    label: 'ZztIsolation/zzz_calculator 结构与数据线索',
    url: 'https://github.com/ZztIsolation/zzz_calculator',
    tier: 'reference-only',
    sourceVersion: 'commit-3a2e838adb0e91e501b575d0503a272f9d6ce06d',
    checkedAt,
    contentIdentity: 'git-3a2e838adb0e91e501b575d0503a272f9d6ce06d',
    licenseBoundary:
      'GitHub 未检测到根许可证且根 LICENSE 不存在；只读参考结构/字段线索，不复制代码或数据。',
  },
  {
    id: 'github-zzt-scanner-next',
    label: 'ZztIsolation/ZZZ-Scanner.Next 数据契约线索',
    url: 'https://github.com/ZztIsolation/ZZZ-Scanner.Next',
    tier: 'licensed-upstream',
    sourceVersion: 'commit-b4f3b53f6e9acb1f42af1a68c63cfe326bf912d4',
    checkedAt,
    contentIdentity: 'git-b4f3b53f6e9acb1f42af1a68c63cfe326bf912d4',
    licenseBoundary:
      'MIT；本节点只登记数据/契约价值，不接扫描流程、不复制 WinForms 或 OCR 运行时。',
  },
]

function uniqueSources(nodes: GameData31SourceNode[]) {
  return [...new Map(nodes.map((node) => [node.id, node])).values()]
}

export const gameData31SourceGraph = {
  nodes: uniqueSources([
    ...baselineSources,
    ...officialSources,
    ...intakeSources,
    ...calculationReferenceSources,
  ]),
  policy: {
    formal: '同版本官方事实，或已有 formal 历史字段且无后续受影响证据时，才可保持 formal。',
    candidate: '游戏证据、社区交叉与许可受限来源仅形成字段级 candidate；不能越过正式计算门。',
    missing: '没有合法、稳定、可版本化证据的字段保持 missing，不按名称、顺序或相似效果猜测。',
  },
} as const
