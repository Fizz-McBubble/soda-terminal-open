import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { PlayerBuildSource } from './playerBuildProfiles'
import { stableContentHash } from './types'
import {
  officialChineseCatalog,
  gachabaseAgent,
  gachabaseSet312,
  gachabaseSet314,
  gachabaseWEngine,
  gameWithBuild,
  gamelandBuild,
  chineseNames,
  sources,
  fields,
} from './gameData31RemielleEquipmentFacts'
import {
  remielleEquipmentIntakeVersion,
  remielleEquipmentIntakeSchema,
  type IntakeSource,
} from './remielleEquipmentIntakeSchema'
export {
  remielleEquipmentIntakeVersion,
  remielleEquipmentIntakeSchema,
} from './remielleEquipmentIntakeSchema'

const sourceById = new Map(sources.map((item) => [item.id, item]))
for (const item of fields)
  for (const sourceRef of item.sourceRefs)
    if (!sourceById.has(sourceRef)) throw new Error(`未知R1F来源引用：${sourceRef}`)

function asPlayerBuildSource(item: IntakeSource): PlayerBuildSource {
  return {
    id: item.id,
    url: item.url,
    sourceVersion: item.sourceVersion,
    checkedAt: item.checkedAt,
    contentHash: item.contentIdentityHash,
    licenseBoundary: item.license.boundary,
    verified: true,
  }
}

const warehouseConstraintCore: Omit<CandidateWarehouseConstraint, 'contentHash'> = {
  agentId: 'candidate-3.1-agent-remielle',
  agentName: '蕾米埃尔·丹',
  gameVersion: '3.1',
  status: 'candidate',
  sources: [gameWithBuild, gamelandBuild, gachabaseSet314, gachabaseWEngine].map(
    asPlayerBuildSource,
  ),
  setIds: [
    'set-34100',
    'set-freedom-blues',
    'set-chaos-jazz',
    'set-hormone-punk',
    'set-astral-voice',
  ],
  setPlanReadiness: {
    status: 'executable',
    pattern: '4+2',
    primarySetIds: ['set-34100'],
    secondarySetIds: [
      'set-freedom-blues',
      'set-chaos-jazz',
      'set-hormone-punk',
      'set-astral-voice',
    ],
  },
  mainStats: {
    '4': ['anomaly_proficiency', 'atk_percent'],
    '5': ['atk_percent'],
    '6': ['atk_percent'],
  },
  subStatWeights: { atk_percent: 1, anomaly_proficiency: 0.88, atk_flat: 0.76 },
  wEngineDirections: [
    '空羽复归之诗（wengine-14158，P1与P5为候选；P2–P4资料待补齐）',
    '双生泣星、嵌合编译器或触电唇彩仅作候选替代方向',
  ],
  teamAndBangbooPreconditions: ['优先三名异常代理人；当前目标面板按攻击力4000候选前提解释。'],
  progressionDirection: ['先满足攻击力目标，再比较异常精通；不把候选仓库分解释为伤害。'],
  gaps: [
    '专属音擎P2–P4没有直接证据，禁止推算。',
    '角色/套装/音擎的数值来源仍为candidate/reference-only，不能进入formal或DPS。',
  ],
  boundary:
    '候选仓库评分只消费逐字段来源化的套装、主副词条与目标面板；不是DPS、最高伤害、正式最优，也不写玩家资产。',
}

export const remielleCandidateWarehouseConstraint31: CandidateWarehouseConstraint = {
  ...warehouseConstraintCore,
  contentHash: stableContentHash(warehouseConstraintCore),
}

const deltas = [
  {
    id: 'r1f-add-remielle-warehouse-fields',
    entityId: 'candidate-3.1-agent-remielle',
    operation: 'add' as const,
    fieldPaths: fields
      .filter((item) => item.path.startsWith('agent-1581.'))
      .map((item) => item.path),
    sourceRefs: [officialChineseCatalog.id, gachabaseAgent.id, gameWithBuild.id, gamelandBuild.id],
    rollbackRef: 'game-data-3.1-catalog-intake',
    affects: ['catalog', 'warehouse'] as const,
    note: '只新增候选仓库字段，不替换3.0 rollback或任何玩家资产。',
  },
  {
    id: 'r1f-change-set-34100-two-piece',
    entityId: 'set-34100',
    operation: 'change' as const,
    fieldPaths: ['set-34100.effect.two_piece'],
    sourceRefs: [gachabaseSet312.id, gachabaseSet314.id, gameWithBuild.id],
    rollbackRef: gachabaseSet312.id,
    affects: ['warehouse', 'damage'] as const,
    note: '保留3.1.2旧值，当前候选采用3.1.4且不宣称formal。',
  },
  {
    id: 'r1f-add-wengine-14158-fields',
    entityId: 'wengine-14158',
    operation: 'add' as const,
    fieldPaths: fields
      .filter((item) => item.path.startsWith('wengine-14158.'))
      .map((item) => item.path),
    sourceRefs: [gachabaseWEngine.id, gameWithBuild.id, gamelandBuild.id, chineseNames.id],
    rollbackRef: 'game-data-3.1-catalog-intake',
    affects: ['catalog', 'warehouse', 'damage'] as const,
    note: 'P2–P4保持missing，任何伤害能力仍由既有formal gate阻断。',
  },
]

const conflicts = [
  {
    id: 'set-34100-two-piece-beta-revision',
    fieldPath: 'set-34100.effect.two_piece',
    status: 'resolved' as const,
    candidateValues: [
      { sourceRef: gachabaseSet312.id, value: { atkPercent: 10 } },
      { sourceRef: gachabaseSet314.id, value: { anomalyProficiency: 30 } },
    ],
    resolution: '采用时间更后的3.1.4修订，并由3.1当前GameWith页面交叉；旧值保留为回滚证据。',
  },
]

const gaps = (['p2', 'p3', 'p4'] as const).map((refinement) => ({
  fieldPath: `wengine-14158.passive.refinement_${refinement}`,
  status: 'missing' as const,
  checkedSourceRefs: [gachabaseWEngine.id, gameWithBuild.id],
  nextEvidence: `需同版本游戏内或明确逐档资料直接列出${refinement.toUpperCase()}，不得由P1/P5推算。`,
}))

const intakeCore = {
  version: remielleEquipmentIntakeVersion,
  gameVersion: '3.1' as const,
  status: 'candidate' as const,
  sources,
  fields,
  deltas,
  conflicts,
  gaps,
  warehouseConstraintHash: remielleCandidateWarehouseConstraint31.contentHash,
  rollback: {
    previousCatalogIntake: 'game-data-3.1-catalog-intake' as const,
    rule: '新字段包校验或hash失败时保留原3.1候选目录/约束；不修改玩家资产。',
  },
  boundary:
    '多社区一致最多verified_candidate；只有官方/游戏内同版本字段可formal。candidate不得进入D0、DPS、最高或资产写入。',
}

const normalizedIntakeCore = remielleEquipmentIntakeSchema
  .omit({ contentHash: true })
  .parse(intakeCore)

export const gameData31RemielleEquipmentIntake = remielleEquipmentIntakeSchema.parse({
  ...normalizedIntakeCore,
  contentHash: stableContentHash(normalizedIntakeCore),
})

export function getRemielleEquipmentField(path: string) {
  return gameData31RemielleEquipmentIntake.fields.find((item) => item.path === path) ?? null
}

export function validateRemielleEquipmentIntake(input: unknown) {
  const parsed = remielleEquipmentIntakeSchema.safeParse(input)
  if (!parsed.success)
    return {
      success: false as const,
      reason: 'R1F字段包结构或完整性无效，保留上一候选目录。',
    }
  const { contentHash, ...content } = parsed.data
  if (contentHash !== stableContentHash(content))
    return {
      success: false as const,
      reason: 'R1F字段包hash不匹配，保留上一候选目录。',
    }
  return { success: true as const, intake: parsed.data }
}
