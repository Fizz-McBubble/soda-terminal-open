import {
  canonicalBaseline30,
  canonicalFieldConflictLedger,
  canonicalSourceCensus,
  type CanonicalEntity,
  type CanonicalFieldStatus,
} from './canonicalBaseline'
import { canonicalBaselinePack30 } from './canonicalPack'
import { candidateWarehouseConstraints30 } from './candidateWarehouseConstraints'
import { directDamageGapChecklist } from './fieldContinuity'
import { gameData31CatalogIntake, type GameData31CatalogEntity } from './gameData31CatalogIntake'
import { gameData31DeadlyAssaultScenario } from './gameData31DeadlyAssaultScenario'
import { stableContentHash } from './types'

export type GameData31FieldStatus = CanonicalFieldStatus
export type GameData31FieldChange =
  | 'add'
  | 'change'
  | 'carry_forward'
  | 'potential_overlay'
  | 'conflict'
  | 'missing'
  | 'deprecate'
export type GameData31CurrentApplicability =
  | 'verified_current'
  | 'continuous'
  | 'affected_unverified'
  | 'missing'
  | 'deprecated'

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

export type GameData31CanonicalField = {
  id: string
  entityId: string
  entityType: CanonicalEntity['entityType'] | 'version'
  path: string
  value: string | number | boolean | null
  status: GameData31FieldStatus
  change: GameData31FieldChange
  originalSourceVersion: string | null
  lastChangeVersion: string | null
  currentApplicability: GameData31CurrentApplicability
  sourceRefs: string[]
  affectedCalculationKinds: ReadonlyArray<'guidance' | 'warehouse' | 'damage' | 'rotation'>
  reason: string
}

export type GameData31DeltaEntry = {
  id: string
  domain: 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set' | 'enemy_mode' | 'combat_rule'
  effect: 'add' | 'change' | 'deprecate' | 'carry_forward'
  status: GameData31FieldStatus
  displayName: string
  sourceUrl: string
  sourceVersion: '3.1'
  sourceCheckedAt: string
  sourceContentIdentity: string
  licenseBoundary: string
  affectedCalculationKinds: Array<'guidance' | 'warehouse' | 'damage' | 'rotation'>
  note: string
}

const checkedAt = '2026-07-30T00:00:00.000Z'
const announcementUrl = 'https://zenless.hoyoverse.com/zh-tw/news/165249?catchSpider=1&page=news'
const liveActivityUrl = 'https://zenless.hoyoverse.com/zh-cn/news/165388?catchSpider=1'
const deadlyAssaultUrl = 'https://zenless.hoyoverse.com/en-us/news/165369?catchSpider=1'

const officialSources: GameData31SourceNode[] = [
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

const affectedBaseline = (entityId: string, path: string) => {
  if (entityId === 'enemies-and-modes' && path.startsWith('mode.'))
    return {
      change: 'change' as const,
      currentApplicability: 'affected_unverified' as const,
      reason: '3.1 已确认玩法范围变化；该玩法字段必须按 3.1 重新核验。',
      sourceRefs: ['official-3.1-deadly-assault'],
    }
  if (path.includes('potential_overlay'))
    return {
      change: 'potential_overlay' as const,
      currentApplicability: 'affected_unverified' as const,
      reason: '潜能是独立 overlay；只使声明字段待核验，不使整名代理人或其他历史字段失效。',
      sourceRefs: ['official-3.1-launch'],
    }
  return null
}

function carryBaselineFields(): GameData31CanonicalField[] {
  return canonicalBaseline30.flatMap((entity) =>
    entity.fields.map((field) => {
      const affected = affectedBaseline(entity.stableId, field.path)
      const originalSourceVersion = field.sourceVersion
      const sourceRefs = [
        ...(field.sourceId ? [field.sourceId] : []),
        ...(affected?.sourceRefs ?? []),
      ]
      const status: GameData31FieldStatus = affected ? 'missing' : field.status
      const currentApplicability: GameData31CurrentApplicability = affected
        ? affected.currentApplicability
        : field.status === 'missing'
          ? 'missing'
          : 'continuous'
      return {
        id: `${entity.stableId}.${field.path}`,
        entityId: entity.stableId,
        entityType: entity.entityType,
        path: field.path,
        value: null,
        status,
        change: affected?.change ?? (field.status === 'missing' ? 'missing' : 'carry_forward'),
        originalSourceVersion,
        lastChangeVersion: originalSourceVersion,
        currentApplicability,
        sourceRefs,
        affectedCalculationKinds:
          entity.entityType === 'build_knowledge'
            ? ['guidance', 'warehouse']
            : entity.entityType === 'combat_rule'
              ? ['damage']
              : entity.entityType === 'enemy_or_mode'
                ? ['rotation', 'damage']
                : ['guidance', 'warehouse', 'damage'],
        reason:
          affected?.reason ??
          (field.status === 'missing'
            ? field.reason
            : `${field.reason} 未发现 3.1 对应变更证据；保留原始来源版本，不宣称由 3.1 重新核验。`),
      }
    }),
  )
}

function catalogEntityType(domain: GameData31CatalogEntity['domain']) {
  if (domain === 'enemy_mode') return 'enemy_or_mode' as const
  return domain
}

function intakeFields(): GameData31CanonicalField[] {
  return gameData31CatalogIntake.entities.flatMap((entity) => {
    const common = {
      entityId: entity.id,
      entityType: catalogEntityType(entity.domain),
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      sourceRefs: [entity.source.id],
      affectedCalculationKinds:
        entity.domain === 'enemy_mode'
          ? (['rotation', 'damage'] as const)
          : entity.domain === 'wengine' || entity.domain === 'drive_disc_set'
            ? (['guidance', 'warehouse', 'damage'] as const)
            : (['guidance', 'warehouse'] as const),
    }
    const identityStatus: GameData31FieldStatus =
      entity.identity.projectStableId || entity.identity.gameStableId ? 'candidate' : 'missing'
    return [
      {
        ...common,
        id: `${entity.id}.identity.stable`,
        path: 'identity.stable',
        value: entity.identity.projectStableId ?? entity.identity.gameStableId ?? null,
        status: identityStatus,
        change: identityStatus === 'missing' ? ('missing' as const) : ('add' as const),
        currentApplicability:
          identityStatus === 'missing' ? ('missing' as const) : ('verified_current' as const),
        reason:
          identityStatus === 'missing'
            ? '来源没有可追溯稳定映射，不能写入当前目录。'
            : '来源页直接暴露项目或游戏证据稳定标识；仍保持 candidate，不冒充官方事实。',
      },
      ...Object.entries(entity.fields).map(([path, value]) => ({
        ...common,
        id: `${entity.id}.${path}`,
        path,
        value,
        status: (value === null ? 'missing' : entity.status) as GameData31FieldStatus,
        change: (value === null ? 'missing' : 'add') as GameData31FieldChange,
        currentApplicability: (value === null
          ? 'missing'
          : 'verified_current') as GameData31CurrentApplicability,
        reason:
          value === null
            ? entity.gaps.join('；')
            : '同版本候选字段可用于目录或候选约束；不是 formal 战斗事实。',
      })),
    ]
  })
}

const versionFields: GameData31CanonicalField[] = [
  {
    id: 'game-version.current',
    entityId: 'game-version',
    entityType: 'version',
    path: 'current',
    value: '3.1',
    status: 'formal',
    change: 'change',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    sourceRefs: ['official-3.1-launch', 'official-3.1-live-scope'],
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage', 'rotation'],
    reason: '官方公告证明 3.1 于 2026-07-29 上线，且同版本活动已进入更新后范围。',
  },
  {
    id: 'game-version.release-date',
    entityId: 'game-version',
    entityType: 'version',
    path: 'releaseAt',
    value: '2026-07-29',
    status: 'formal',
    change: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    sourceRefs: ['official-3.1-launch'],
    affectedCalculationKinds: [],
    reason: '官方 3.1 上线日期。',
  },
  {
    id: 'official-3.1-agent-remielle.identity.name',
    entityId: 'official-3.1-agent-remielle',
    entityType: 'agent',
    path: 'identity.name',
    value: '蕾米埃尔',
    status: 'formal',
    change: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    sourceRefs: ['official-3.1-launch'],
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    reason: '官方 3.1 公告确认的新增代理人名称；稳定游戏 ID 与战斗字段仍独立核验。',
  },
  {
    id: 'official-3.1-agent-sigrid.identity.name',
    entityId: 'official-3.1-agent-sigrid',
    entityType: 'agent',
    path: 'identity.name',
    value: 'Sigrid',
    status: 'formal',
    change: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    sourceRefs: ['official-3.1-launch'],
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    reason: '官方 3.1 前瞻确认的新增代理人名称；中文名、稳定游戏 ID 与战斗字段仍独立核验。',
  },
  {
    id: 'enemy-mode.deadly-assault.scope',
    entityId: 'enemies-and-modes',
    entityType: 'enemy_or_mode',
    path: 'mode.deadly_assault.scope',
    value: '3.1-system-change',
    status: 'formal',
    change: 'change',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    sourceRefs: ['official-3.1-deadly-assault'],
    affectedCalculationKinds: ['rotation', 'damage'],
    reason: '官方只确认 3.1 玩法变化范围；敌人、数值和轮换字段仍由独立 missing 字段约束。',
  },
]

const conflictFields: GameData31CanonicalField[] = canonicalFieldConflictLedger.map((conflict) => ({
  id: `conflict:${conflict.fieldPath}`,
  entityId: conflict.fieldPath.split('.')[0] ?? 'unknown',
  entityType: 'combat_rule',
  path: conflict.fieldPath,
  value: conflict.adopted,
  status: conflict.decision === 'adopted' ? 'formal' : 'candidate',
  change: 'conflict',
  originalSourceVersion: conflict.values[0]?.sourceVersion ?? null,
  lastChangeVersion: null,
  currentApplicability: conflict.decision === 'adopted' ? 'continuous' : 'affected_unverified',
  sourceRefs: conflict.values.map((item) => item.sourceId),
  affectedCalculationKinds: ['damage'],
  reason: conflict.reason,
}))

export const gameData31CurrentFields: GameData31CanonicalField[] = [
  ...versionFields,
  ...carryBaselineFields(),
  ...intakeFields(),
  ...conflictFields,
]

const deltaEntriesCore: GameData31DeltaEntry[] = [
  {
    id: 'official-3.1-current-version',
    domain: 'combat_rule',
    effect: 'change',
    status: 'formal',
    displayName: '当前正式版本 3.1',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165249-2026-07-17',
    licenseBoundary: '仅保存官方版本与日期事实。',
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage', 'rotation'],
    note: '3.1 是当前运行版本；字段可信度仍逐项判断。',
  },
  {
    id: 'official-3.1-agent-remielle',
    domain: 'agent',
    effect: 'add',
    status: 'formal',
    displayName: '蕾米埃尔（官方公告新增代理人）',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165249-2026-07-17',
    licenseBoundary: '官方公告只用于版本内新增身份事实；稳定游戏 ID 与战斗字段另行逐项核验。',
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    note: '新增身份是 formal；非官方稳定 ID 与数值仍保持 candidate/missing。',
  },
  {
    id: 'official-3.1-agent-sigrid',
    domain: 'agent',
    effect: 'add',
    status: 'formal',
    displayName: 'Sigrid（官方前瞻新增代理人）',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165248-2026-07-17',
    licenseBoundary: '官方前瞻只确认版本内新增身份；中文名、稳定 ID 与战斗字段逐项核验。',
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    note: '新增身份是 formal；其余字段不随版本上线自动升格。',
  },
  {
    id: 'official-3.1-wengine-fields',
    domain: 'wengine',
    effect: 'add',
    status: 'missing',
    displayName: '3.1 新增音擎战斗字段',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165249-2026-07-17',
    licenseBoundary: '公告不提供逐把稳定 ID、基础属性或被动。',
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    note: '等待同版本官方图鉴或可核验游戏内字段。',
  },
  {
    id: 'official-3.1-bangboo-fields',
    domain: 'bangboo',
    effect: 'add',
    status: 'missing',
    displayName: '3.1 邦布战斗字段',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165249-2026-07-17',
    licenseBoundary: '当前官方公告未提供可归一化的邦布数值字段。',
    affectedCalculationKinds: ['guidance', 'warehouse', 'damage'],
    note: '候选游戏证据可读，但不能自动成为 formal。',
  },
  {
    id: 'official-3.1-drive-disc-fields',
    domain: 'drive_disc_set',
    effect: 'change',
    status: 'missing',
    displayName: '3.1 驱动盘套装与词条规则',
    sourceUrl: announcementUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165249-2026-07-17',
    licenseBoundary: '当前公告没有逐套装/词条规则。',
    affectedCalculationKinds: ['warehouse', 'damage'],
    note: '3.0 未受影响规则连续适用；3.1 新套装字段保持 candidate/missing。',
  },
  {
    id: 'official-3.1-deadly-assault',
    domain: 'enemy_mode',
    effect: 'change',
    status: 'formal',
    displayName: '3.1 危局绝境模式范围',
    sourceUrl: deadlyAssaultUrl,
    sourceVersion: '3.1',
    sourceCheckedAt: checkedAt,
    sourceContentIdentity: 'official-news-165369-2026-07-27',
    licenseBoundary: '官方系统说明只证明玩法范围；不提供固定敌人 DEF/RES/失衡和轮换完整字段。',
    affectedCalculationKinds: ['rotation', 'damage'],
    note: '范围变化是 formal；危局数值上下文仍 missing，相关结果 stale。',
  },
]

const catalogEntries: GameData31DeltaEntry[] = gameData31CatalogIntake.entities.map((entity) => ({
  id: entity.id,
  domain: entity.domain,
  effect: entity.domain === 'enemy_mode' ? 'change' : 'add',
  status: entity.status,
  displayName: entity.displayName,
  sourceUrl: entity.source.url,
  sourceVersion: '3.1',
  sourceCheckedAt: entity.source.checkedAt,
  sourceContentIdentity: entity.source.contentHash,
  licenseBoundary: entity.source.licenseBoundary,
  affectedCalculationKinds:
    entity.domain === 'enemy_mode'
      ? ['rotation', 'damage']
      : entity.domain === 'drive_disc_set' || entity.domain === 'wengine'
        ? ['guidance', 'warehouse', 'damage']
        : ['guidance', 'warehouse'],
  note:
    entity.identity.kind === 'project_catalog'
      ? `已映射项目目录 ${entity.identity.projectStableId}；${entity.gaps.join('；')}`
      : `仅有来源页稳定定位，不冒充官方数值事实；${entity.gaps.join('；')}`,
}))

export const gameData31DeltaEntries = [...deltaEntriesCore, ...catalogEntries]

function countBy<T extends string>(items: T[]) {
  return Object.fromEntries(
    [...new Set(items)].map((item) => [item, items.filter((value) => value === item).length]),
  ) as Record<T, number>
}

const catalogEntityTypes = new Set(['agent', 'wengine', 'bangboo', 'drive_disc_set'])
const catalogFields = gameData31CurrentFields.filter((field) =>
  catalogEntityTypes.has(field.entityType),
)
const currentCoverage = {
  fields: gameData31CurrentFields.length,
  byStatus: countBy(gameData31CurrentFields.map((field) => field.status)),
  byApplicability: countBy(gameData31CurrentFields.map((field) => field.currentApplicability)),
  byEntityType: countBy(gameData31CurrentFields.map((field) => field.entityType)),
  capabilities: {
    catalogFormal: new Set(
      catalogFields
        .filter((field) => field.path === 'identity.name' && field.status === 'formal')
        .map((field) => field.entityId),
    ).size,
    catalogCandidate: new Set(
      catalogFields
        .filter((field) => field.path.startsWith('identity.') && field.status === 'candidate')
        .map((field) => field.entityId),
    ).size,
    buildReadable: new Set(
      gameData31CurrentFields
        .filter(
          (field) =>
            field.entityType === 'build_knowledge' &&
            (field.status === 'formal' || field.status === 'candidate'),
        )
        .map((field) => field.entityId),
    ).size,
    candidateWarehouse:
      candidateWarehouseConstraints30.filter((constraint) => constraint.status === 'candidate')
        .length + gameData31CatalogIntake.coverage.candidateWarehouseConstraints,
    formalDamage: 0,
  },
  directDamageGaps: directDamageGapChecklist.map((gap) => gap.id),
  contentHash: stableContentHash(gameData31CurrentFields),
}

const changedFields = gameData31CurrentFields
  .filter((field) => field.change === 'change' || field.change === 'potential_overlay')
  .map((field) => field.id)
const missingFields = gameData31CurrentFields
  .filter((field) => field.status === 'missing')
  .map((field) => field.id)

const deltaCore = {
  id: 'game-data-3.1-current-canonical.1',
  schemaVersion: 2,
  previousFormal: canonicalBaselinePack30.id,
  gameVersion: '3.1' as const,
  currentVersion: '3.1' as const,
  status: 'current' as const,
  createdAt: checkedAt,
  sourceSnapshotIds: officialSources.map((source) => source.id),
  sourceGraph: gameData31SourceGraph,
  fields: gameData31CurrentFields,
  entries: gameData31DeltaEntries,
  delta: {
    added: gameData31CurrentFields
      .filter((field) => field.change === 'add')
      .map((field) => field.id),
    changed: changedFields,
    carriedForward: gameData31CurrentFields
      .filter((field) => field.change === 'carry_forward')
      .map((field) => field.id),
    conflicts: gameData31CurrentFields
      .filter((field) => field.change === 'conflict')
      .map((field) => field.id),
    missing: missingFields,
    deprecated: gameData31CurrentFields
      .filter((field) => field.change === 'deprecate')
      .map((field) => field.id),
  },
  coverage: currentCoverage,
  affectedCalculations: {
    staleFieldIds: gameData31CurrentFields
      .filter((field) => field.currentApplicability === 'affected_unverified')
      .map((field) => field.id),
    guidance: changedFields.filter((id) =>
      gameData31CurrentFields
        .find((field) => field.id === id)
        ?.affectedCalculationKinds.includes('guidance'),
    ),
    warehouse: changedFields.filter((id) =>
      gameData31CurrentFields
        .find((field) => field.id === id)
        ?.affectedCalculationKinds.includes('warehouse'),
    ),
    damage: changedFields.filter((id) =>
      gameData31CurrentFields
        .find((field) => field.id === id)
        ?.affectedCalculationKinds.includes('damage'),
    ),
    rotation: changedFields.filter((id) =>
      gameData31CurrentFields
        .find((field) => field.id === id)
        ?.affectedCalculationKinds.includes('rotation'),
    ),
  },
  deadlyAssaultScenario: {
    id: gameData31DeadlyAssaultScenario.id,
    status: gameData31DeadlyAssaultScenario.status,
    contextStatus: gameData31DeadlyAssaultScenario.calculationContext.status,
    contentHash: gameData31DeadlyAssaultScenario.contentHash,
  },
  billySingleAction: {
    status: 'unsupported' as const,
    affectedBy31:
      '未发现 3.1 对比利既有动作字段的变更证据，历史字段可逐项连续；原有敌人、循环与倍率缺口仍不能被版本上线补足。',
    requiredGaps: directDamageGapChecklist.map((item) => item.id),
  },
  rollback: {
    target: canonicalBaselinePack30.id,
    targetVersion: '3.0' as const,
    rule: '3.1 current view 校验失败时返回可验证的 3.0 canonical 快照；只切换数据引用，不修改玩家资产。',
  },
  boundary:
    '3.1 是当前版本，不再作为整体 future candidate；formal/candidate/missing 由字段决定，版本上线本身不会升格战斗字段。',
}

export const gameData31CanonicalDelta = {
  ...deltaCore,
  contentHash: stableContentHash(deltaCore),
} as const

export function validateGameData31CanonicalDelta(input: unknown) {
  if (!input || typeof input !== 'object')
    return { success: false as const, error: '3.1 current canonical 格式无效。' }
  const current = input as typeof gameData31CanonicalDelta
  const expectedHash = stableContentHash({ ...current, contentHash: undefined })
  if (current.contentHash !== expectedHash)
    return { success: false as const, error: '3.1 current canonical 校验失败。' }
  if (
    current.status !== 'current' ||
    current.currentVersion !== '3.1' ||
    current.previousFormal !== canonicalBaselinePack30.id ||
    !current.fields.length ||
    !current.sourceGraph.nodes.length
  )
    return { success: false as const, error: '3.1 current canonical 不完整。' }
  return { success: true as const, current }
}

export function activateGameData31Current(input: unknown) {
  const checked = validateGameData31CanonicalDelta(input)
  if (!checked.success)
    return {
      activated: false as const,
      reason: checked.error,
      fallbackVersion: '3.0' as const,
      fallbackPack: canonicalBaselinePack30,
    }
  return {
    activated: true as const,
    gameVersion: '3.1' as const,
    status: 'current' as const,
    rollbackTo: checked.current.previousFormal,
    coverage: checked.current.coverage,
    staleFieldIds: checked.current.affectedCalculations.staleFieldIds,
    directDamage: checked.current.billySingleAction,
  }
}

/** @deprecated Use activateGameData31Current; kept only for old callers during migration. */
export const activateGameData31Candidate = activateGameData31Current

export function rollbackGameData31Current(input: unknown) {
  const checked = validateGameData31CanonicalDelta(input)
  return {
    rolledBack: true as const,
    fromVersion: checked.success ? checked.current.currentVersion : null,
    activeVersion: '3.0' as const,
    activePack: canonicalBaselinePack30,
    playerAssetsChanged: false as const,
  }
}
