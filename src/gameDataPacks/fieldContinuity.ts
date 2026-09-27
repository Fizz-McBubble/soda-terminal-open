import { z } from 'zod'

export const fieldChangeEffects = [
  'new',
  'changed',
  'potential',
  'text_only',
  'unchanged',
  'unknown',
] as const

export const fieldContinuityEntrySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  scope: z.string().min(1),
  introducedVersion: z.string().min(1),
  originalSourceVersion: z.string().min(1),
  lastChangeVersion: z.string().min(1),
  lastVerifiedVersion: z.string().min(1),
  currentApplicability: z.enum(['verified_current', 'continuous', 'stale', 'not_applicable']),
  affectedVersion: z.string().min(1).nullable(),
  continuityEvidence: z.string().min(1),
  effect: z.enum(fieldChangeEffects),
  status: z.enum(['formal', 'candidate', 'missing']),
  source: z.object({
    version: z.string().min(1),
    checkedAt: z.string().datetime(),
    contentHash: z.string().min(1),
    evidence: z.string().min(1),
  }),
  affectedFieldIds: z.array(z.string().min(1)),
  criticalForDirectDamage: z.boolean(),
})

export type FieldContinuityEntry = z.infer<typeof fieldContinuityEntrySchema>

/**
 * A deliberately small, versioned ledger. It records continuity claims, not combat values;
 * candidate values remain isolated in candidate data packages.
 */
export const gameBase30FieldContinuityLedger = fieldContinuityEntrySchema.array().parse([
  {
    id: 'catalog-identity-1.0-carried',
    displayName: '既有目录身份字段',
    scope: '角色、音擎与邦布的稳定目录身份',
    introducedVersion: '1.0',
    originalSourceVersion: '1.0',
    lastChangeVersion: '1.0',
    lastVerifiedVersion: '1.0',
    currentApplicability: 'continuous',
    affectedVersion: null,
    continuityEvidence:
      '3.1 增量账本未记录该字段组发生变化；保留 1.0 原始来源，不宣称由 3.1 重新核验。',
    effect: 'unchanged',
    status: 'formal',
    source: {
      version: '1.0',
      checkedAt: '2026-07-19T00:00:00.000Z',
      contentHash: 'continuity-original-1.0-fields',
      evidence:
        '当前 3.0 差异账本未记录这些字段受到补丁影响；沿用原始版本，不宣称已由 3.0 重新核验。',
    },
    affectedFieldIds: [],
    criticalForDirectDamage: false,
  },
  {
    id: 'potential-overlay-3.0',
    displayName: '潜能激发增量',
    scope: '潜能激发 overlay',
    introducedVersion: '3.0',
    originalSourceVersion: '3.0',
    lastChangeVersion: '3.0',
    lastVerifiedVersion: '3.0',
    currentApplicability: 'stale',
    affectedVersion: '3.1',
    continuityEvidence:
      '潜能是独立 overlay；3.1 当前视图只使 overlay 声明字段待核验，不改写影画、普通技能或基础面板。',
    effect: 'potential',
    status: 'missing',
    source: {
      version: '3.0',
      checkedAt: '2026-07-19T00:00:00.000Z',
      contentHash: 'continuity-potential-overlay-gap',
      evidence: '已确认潜能激发是独立增量，但尚无同版本逐字段数值与变更证据可用于正式直接伤害。',
    },
    affectedFieldIds: ['potential-overlay'],
    criticalForDirectDamage: true,
  },
  {
    id: 'community-direct-damage-1.0-candidate',
    displayName: '受限制社区候选字段',
    scope: '角色与音擎战斗数值',
    introducedVersion: '1.0',
    originalSourceVersion: '1.0',
    lastChangeVersion: '1.0',
    lastVerifiedVersion: '1.0',
    currentApplicability: 'continuous',
    affectedVersion: null,
    continuityEvidence:
      '当前差异账本没有记录这两个历史字段受到 3.1 补丁影响；社区候选强度保持不变，不自动转 formal。',
    effect: 'unknown',
    status: 'candidate',
    source: {
      version: '1.0',
      checkedAt: '2026-07-19T00:00:00.000Z',
      contentHash: 'community-candidate-page-level-1.0',
      evidence: '已保留页面级来源、更新时间、字段路径与哈希；没有同版本 3.0 变更核验。',
    },
    affectedFieldIds: ['agent-ellen.base-atk', 'wengine-14119.base-atk'],
    criticalForDirectDamage: true,
  },
  {
    id: 'deadly-assault-scenario-3.1-change',
    displayName: '3.1 危局绝境场景字段',
    scope: '固定敌人、轮换、增益、阶段与有效期',
    introducedVersion: '3.1',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    lastVerifiedVersion: '3.1',
    currentApplicability: 'stale',
    affectedVersion: '3.1',
    continuityEvidence:
      '官方来源确认玩法范围发生变化，但固定敌人 DEF/RES/失衡、阶段、轮换与增益没有形成完整同版本字段。',
    effect: 'changed',
    status: 'missing',
    source: {
      version: '3.1',
      checkedAt: '2026-07-30T00:00:00.000Z',
      contentHash: 'official-news-165369-2026-07-27-scope',
      evidence: '只使危局专用结果过期；普通候选仓库约束与未受影响历史字段继续有效。',
    },
    affectedFieldIds: [
      'mode.deadly_assault.enemy',
      'mode.deadly_assault.rotation',
      'mode.deadly_assault.buffs',
    ],
    criticalForDirectDamage: true,
  },
])

/** Current-version projection. Historical rows retain their original source and change versions. */
export const gameBase31FieldContinuityLedger = gameBase30FieldContinuityLedger

export const directDamageGapChecklist = [
  {
    id: 'agent-and-wengine-values',
    label: '角色与音擎战斗数值',
    recommendedSource: '同版本官方或游戏内核验',
    formalCondition: '等级、技能倍率、音擎基础与被动均有同版本可复核来源。',
  },
  {
    id: 'bangboo-scope',
    label: '邦布伤害范围',
    recommendedSource: '同版本官方或游戏内核验',
    formalCondition: '邦布伤害已完整纳入，或有明确、同版本的排除范围。',
  },
  {
    id: 'enemy-parameters',
    label: '敌人 DEF、RES 与失衡',
    recommendedSource: '正式玩法与敌人参数资料',
    formalCondition: '固定敌人、抗性和失衡参数可复核且与场景一致。',
  },
  {
    id: 'rotation-and-buffs',
    label: '循环与 Buff',
    recommendedSource: '同版本玩法规则与可复核动作记录',
    formalCondition: '动作、时长、Buff 覆盖与适用前提完整。',
  },
  {
    id: 'potential-overlay',
    label: '潜能激发 overlay',
    recommendedSource: '同版本官方或游戏内逐字段核验',
    formalCondition: '仅影响声明字段，并保留与普通技能、影画分离的变更证据。',
  },
  {
    id: 'formula-cross-check',
    label: '公式交叉验证',
    recommendedSource: '官方机制说明优先，独立公式候选仅作交叉验证',
    formalCondition: '公式、舍入与乘区经同版本来源核验。',
  },
  {
    id: 'mode-rotation',
    label: '玩法轮换',
    recommendedSource: '正式轮换与场景数据包',
    formalCondition: '当前轮换、敌人与限制已转正且未过期。',
  },
] as const

export function getContinuityGateInput(entries = gameBase30FieldContinuityLedger) {
  return {
    carriedForwardFieldIds: entries
      .filter((entry) => entry.effect === 'unchanged' && entry.status === 'formal')
      .map((entry) => entry.id),
    affectedUnverifiedFieldIds: entries
      .filter(
        (entry) =>
          entry.criticalForDirectDamage &&
          entry.affectedFieldIds.length > 0 &&
          (entry.status !== 'formal' || entry.effect === 'potential' || entry.effect === 'changed'),
      )
      .flatMap((entry) => entry.affectedFieldIds),
  }
}

export function applyPotentialOverlay<T extends Record<string, unknown>>(
  base: T,
  overlay: Record<string, unknown>,
  declaredFieldIds: readonly string[],
) {
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      declaredFieldIds.includes(key) && key in overlay ? overlay[key] : value,
    ]),
  ) as T
}

export const continuityPlayerStatus = {
  formalVersion: '3.0',
  pendingCount: gameBase30FieldContinuityLedger.filter(
    (entry) => entry.status !== 'formal' || entry.effect === 'potential',
  ).length,
  affectedScopes: ['潜能激发与候选战斗字段'],
  carriedForwardReason:
    '未发现补丁变更证据的历史字段继续沿用原始版本；这不表示已由当前版本重新核验。',
  candidateNotice: '候选版本只用于整理待核对范围，不参与精确伤害、DPS 或最高伤害排名。',
} as const
