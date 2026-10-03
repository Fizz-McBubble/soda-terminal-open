import { getAgentProfile, type AgentProfileField } from './agentProfile'
import { currentAssetProjection } from './currentAssetProjection'
import { currentVersionProjection } from './currentVersionProjection'
import {
  gameData31RemielleEquipmentIntake,
  getRemielleEquipmentField,
} from './gameData31RemielleEquipmentIntake'
import { getGameData31CatalogEntity } from './gameData31CatalogIntake'
import currentDecisionMechanicSupplements from './data/current-agent-decision-mechanic-supplements.3.1.json'
import reviewedBuildPatchImpact from './data/reviewed-build-patch-impact.3.1.json'
import { stableContentHash } from './types'
import { isPotentialGuideReference } from './reviewedPotentialGuideReferences'
import { reviewedTargetPanelGuidance } from './reviewedTargetPanelGuidance'
import { projectedReviewedBuild32Fields } from './agentProfileFieldProjection'
import { reviewedBuildFieldReferenceContinuity32 } from './reviewedReferenceSupportContinuity32'

export const currentBuildFieldIds = [
  'progression.lv60_and_ascension',
  'progression.skill_core_cinema',
  'progression.potential_overlay',
  'build.wengines',
  'build.drive_disc_sets',
  'build.main_sub_stats',
  'build.progression',
  'build.team_bangboo_scenario',
  'build.target_panel',
  'build.version_change_impact',
] as const
export type CurrentBuildFieldId = (typeof currentBuildFieldIds)[number]

export const currentCalculationAccountFieldIds = [
  'account.agent.level_ascension',
  'account.agent.skill_core_cinema',
  'account.agent.potential_overlay',
  'account.wengine.instance',
  'account.drive_disc.instances',
  'account.final_stats',
] as const

export type CurrentBuildFieldState = 'ready' | 'missing' | 'stale' | 'conflict'

export type CurrentBuildAuthorityField = {
  fieldId: CurrentBuildFieldId
  lane: 'guidance'
  state: CurrentBuildFieldState
  sourceStatus: AgentProfileField['status'] | 'missing'
  value: unknown | null
  sourceRefs: ReadonlyArray<{
    id: string
    sourceVersion: string | null
    evaluatedForVersion: string | null
    checkedAt: string | null
    contentHash: string | null
  }>
  blockers: readonly string[]
  conditions: readonly string[]
  referenceContinuity?: NonNullable<ReturnType<typeof reviewedBuildFieldReferenceContinuity32>>
  nextEvidence: readonly string[]
}

export type CurrentCalculationAccountField = {
  fieldId: (typeof currentCalculationAccountFieldIds)[number]
  lane: 'calculation_account_snapshot'
  state: 'account_required'
  value: null
  reason: string
}

function fieldState(
  field: AgentProfileField | undefined,
  targetVersion: string,
): CurrentBuildFieldState {
  if (!field || field.status === 'missing') return 'missing'
  if (field.conflict) return 'conflict'
  if (field.currentApplicability !== 'continuous' || field.gameVersion !== targetVersion)
    return 'stale'
  return 'ready'
}

const reviewedImpactRows = new Map(
  reviewedBuildPatchImpact.rows.map((row) => [row.agentId, row] as const),
)
if (
  reviewedImpactRows.size !== reviewedBuildPatchImpact.rows.length ||
  reviewedBuildPatchImpact.rows.some((row) => !row.agentId)
) {
  throw new Error('Reviewed build patch impact does not cover the current agent projection.')
}

const reviewedImpactSources: AgentProfileField['sourceRefs'] = [
  {
    id: 'P31-en',
    url: 'https://zenless.gg/version-3-1-the-long-goodbye-update-announcement/',
    sourceVersion: '3.1',
    checkedAt: '2026-09-23',
    contentHash: null,
    licenseBoundary: 'Readable announcement reproduction; original publisher body was unavailable.',
  },
  {
    id: 'P31-zh',
    url: 'https://news.4399.com/jqlsy/zixun/m/1014339.html',
    sourceVersion: '3.1',
    checkedAt: '2026-09-23',
    contentHash: null,
    licenseBoundary: 'Second announcement reproduction; no copied prose or media.',
  },
  {
    id: 'R-inventory',
    url: "soda-source-ref:57603c053ba7c2130fbb8e786a0d3861",
    sourceVersion: '3.1',
    checkedAt: '2026-09-23',
    contentHash: null,
    licenseBoundary: 'Pinned repository baseline for current guidance scope, not game truth.',
  },
]

const reviewedImpactLabels: Record<string, string> = {
  '31-miyabi-activation': '额外能力队友条件扩展',
  '31-aria-activation': '额外能力队友条件扩展',
  '31-piper-activation': '额外能力队友条件扩展',
  '31-rina-timing': '技能衔接时序调整',
  '31-zero-anby-hit-fix': '终结技命中可靠性修正',
  '31-matrix-only-fixes': '零号空洞矩阵玩法限定修正',
  '31-minor-presentation': '表现或未指明动作修正',
  '31-new-agents': '3.1 新增代理人',
}

function reviewedVersionImpact(agentId: string): AgentProfileField | undefined {
  const row = reviewedImpactRows.get(agentId)
  if (!row) return undefined
  const introduced = row.directChangeIds.includes('31-new-agents')
  const named = row.directChangeIds.length > 0
  const impact = named
    ? row.directChangeIds.map((id) => reviewedImpactLabels[id] ?? id).join('、')
    : '已查公告指定章节未见具名代理人变化'
  return {
    group: 'build_guidance',
    path: 'build.version_change_impact',
    value: {
      baseVersion: introduced ? null : reviewedBuildPatchImpact.baseVersion,
      targetVersion: reviewedBuildPatchImpact.targetVersion,
      evidenceScope: reviewedBuildPatchImpact.evidenceScope,
      directChangeIds: row.directChangeIds,
    },
    status: 'candidate',
    gameVersion: reviewedBuildPatchImpact.targetVersion,
    originalSourceVersion: introduced ? null : reviewedBuildPatchImpact.baseVersion,
    lastChangeVersion: named ? reviewedBuildPatchImpact.targetVersion : null,
    currentApplicability: 'affected_pending',
    sourceRefs: reviewedImpactSources,
    verifiedAt: null,
    conflict: null,
    reason: introduced
      ? `${impact}；3.0 同角色字段对比不适用，3.1 当前构筑字段、分支和热修复仍待核验。`
      : `${impact}；尚缺 3.0→3.1 逐字段值、攻略分支排序和热修复核验，不能据此确认整套构筑未变。`,
    conditions: [
      introduced
        ? '新代理人没有 3.0 同角色构筑；仅核对 3.1 当前字段。'
        : '公告指定章节的有限核对不代表完整版本连续性。',
      ...(row.directChangeIds.includes('31-matrix-only-fixes')
        ? ['矩阵玩法限定修正不作为常规战斗数值增益。']
        : []),
    ],
  }
}

const remielleWEngineSourceIds = new Set([
  'gachabase-wengine-14158-3.1.12',
  'gameland-remielle-build-3.1',
  'mobalytics-remielle-build-3.1',
])

/**
 * This is a source-backed identity adoption, not an account equipment default.
 * The existing 3.1 intake names the W-Engine as `wengine-14158`; it remains
 * candidate guidance and never supplies a copyId, level, or refinement.
 */
const remielleWEngineGuidanceField: AgentProfileField = {
  group: 'build_guidance',
  path: 'build.wengines',
  value: ['wengine-14158'],
  status: 'verified_candidate',
  gameVersion: '3.1',
  originalSourceVersion: '3.1',
  lastChangeVersion: '3.1',
  currentApplicability: 'continuous',
  sourceRefs: gameData31RemielleEquipmentIntake.sources
    .filter((source) => remielleWEngineSourceIds.has(source.id))
    .map((source) => ({
      id: source.id,
      url: source.url,
      sourceVersion: source.sourceVersion,
      checkedAt: source.checkedAt,
      contentHash: source.contentIdentityHash,
      licenseBoundary: source.license.boundary,
    })),
  verifiedAt: '2026-07-30T00:00:00.000Z',
  conflict: null,
  reason:
    '3.1 候选来源已具名蕾米埃尔关联的 stable W-Engine identity；仅提供攻略方向，不推断账户副本或数值面板。',
}

function remielleIntakeGuidanceField(
  authorityPath: 'build.target_panel',
  intakePath: string,
): AgentProfileField | undefined {
  const intakeField = getRemielleEquipmentField(intakePath)
  if (!intakeField || intakeField.status === 'missing') return undefined
  const sources = gameData31RemielleEquipmentIntake.sources.filter((source) =>
    intakeField.sourceRefs.includes(source.id),
  )
  return {
    group: 'build_guidance',
    path: authorityPath,
    value: intakeField.value,
    status: intakeField.status === 'reference' ? 'candidate' : intakeField.status,
    gameVersion: '3.1',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'continuous',
    sourceRefs: sources.map((source) => ({
      id: source.id,
      url: source.url,
      sourceVersion: source.sourceVersion,
      checkedAt: source.checkedAt,
      contentHash: source.contentIdentityHash,
      licenseBoundary: source.license.boundary,
    })),
    verifiedAt: intakeField.verifiedAt,
    conflict: null,
    reason: intakeField.note,
  }
}

const remielleTargetPanelGuidanceField = remielleIntakeGuidanceField(
  'build.target_panel',
  'agent-1581.warehouse.target_panel',
)

const sigridMechanicSource = currentDecisionMechanicSupplements.resourceContracts.find(
  (contract) => contract.agentId === 'agent-sigrid',
)?.source
const sigridWEngineEntity = getGameData31CatalogEntity('candidate-3.1-wengine-knights-extolment')

if (!sigridMechanicSource || !sigridWEngineEntity) {
  throw new Error('Sigrid current W-Engine guidance sources are incomplete.')
}

/**
 * Same-version guide evidence names the released 14159 identity as Sigrid's
 * signature direction. This remains candidate guidance: it never claims the
 * account owns a copy or supplies level/refinement facts.
 */
const sigridWEngineGuidanceField: AgentProfileField = {
  group: 'build_guidance',
  path: 'build.wengines',
  value: ['wengine-14159'],
  status: 'verified_candidate',
  gameVersion: '3.1',
  originalSourceVersion: '3.1',
  lastChangeVersion: '3.1',
  currentApplicability: 'continuous',
  sourceRefs: [
    {
      id: sigridMechanicSource.sourceId,
      url: sigridMechanicSource.url,
      sourceVersion: '3.1',
      checkedAt: sigridMechanicSource.retrievedAt,
      contentHash: stableContentHash(sigridMechanicSource),
      licenseBoundary: 'Source-backed current guide reference; no copied prose or media.',
    },
    {
      id: sigridWEngineEntity.source.id,
      url: sigridWEngineEntity.source.url,
      sourceVersion: sigridWEngineEntity.source.sourceVersion,
      checkedAt: sigridWEngineEntity.source.checkedAt,
      contentHash: sigridWEngineEntity.source.contentHash,
      licenseBoundary: sigridWEngineEntity.source.licenseBoundary,
    },
  ],
  verifiedAt: '2026-08-31T00:00:00.000Z',
  conflict: null,
  reason:
    '3.1 当前攻略方向与已发布 stable W-Engine identity 14159 交叉一致；仅提供音擎方向，不推断账户副本、等级或精炼。',
}

function adoptedCurrentField(agentId: string, fieldId: CurrentBuildFieldId) {
  if (fieldId === 'build.version_change_impact') return reviewedVersionImpact(agentId)
  if (fieldId === 'build.wengines' && agentId === 'agent-remielle')
    return remielleWEngineGuidanceField
  if (fieldId === 'build.wengines' && agentId === 'agent-sigrid') return sigridWEngineGuidanceField
  if (fieldId === 'build.target_panel' && agentId === 'agent-remielle')
    return remielleTargetPanelGuidanceField
  return undefined
}

function frozenTargetPanelGuidance(agentId: string) {
  const field = reviewedTargetPanelGuidance(agentId)
  return field ? { ...field, gameVersion: '3.1' } : undefined
}

function selectedGuidanceField(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
) {
  return (
    projectedReviewedBuild32Fields(agentId).find((field) => field.path === fieldId) ??
    adoptedCurrentField(agentId, fieldId) ??
    fields.find((candidate) => candidate.path === fieldId && candidate.status !== 'missing') ??
    (fieldId === 'build.target_panel' ? frozenTargetPanelGuidance(agentId) : undefined) ??
    fields.find((candidate) => candidate.path === fieldId)
  )
}

/** Validation must trace the selected source, including adopted field overrides. */
export function getCurrentBuildFieldSourceRefs(agentId: string, fieldId: CurrentBuildFieldId) {
  return selectedGuidanceField(fieldId, getAgentProfile(agentId).fields, agentId)?.sourceRefs ?? []
}

function authorityField(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
): CurrentBuildAuthorityField {
  const field = selectedGuidanceField(fieldId, fields, agentId)
  const targetVersion =
    projectedReviewedBuild32Fields(agentId)[0]?.gameVersion ?? currentVersionProjection.gameVersion
  const continuity = reviewedBuildFieldReferenceContinuity32({ agentId, targetVersion, field })
  const state = continuity ? 'ready' : fieldState(field, targetVersion)
  const reason = field?.reason ?? `${fieldId} 缺少可追溯的当前版本构筑字段。`
  return {
    fieldId,
    lane: 'guidance',
    ...(continuity ? { referenceContinuity: continuity } : {}),
    state,
    sourceStatus: field?.status ?? 'missing',
    value: state === 'ready' ? (field?.value ?? null) : null,
    sourceRefs:
      field?.sourceRefs.map((source) => ({
        id: source.id,
        sourceVersion: source.sourceVersion,
        evaluatedForVersion: field.currentApplicability === 'continuous' ? field.gameVersion : null,
        checkedAt: source.checkedAt,
        contentHash: source.contentHash,
      })) ?? [],
    blockers:
      state === 'ready'
        ? []
        : [
            reason,
            ...(field && field.gameVersion !== targetVersion
              ? [`该字段仅复核至 ${field.gameVersion}；${targetVersion} 适用性尚未闭合。`]
              : []),
          ],
    conditions: field?.conditions ?? [],
    nextEvidence:
      state === 'ready'
        ? []
        : fieldId === 'build.version_change_impact'
          ? [
              `核对 ${targetVersion} 当前构筑字段与分支、热修复；已有历史构筑的代理人再做同字段值对比。`,
            ]
          : [
              `补齐 ${fieldId} 的 ${targetVersion} evaluated-for 证据并通过字段级 continuity gate。`,
            ],
  }
}

const calculationAccountFields: readonly CurrentCalculationAccountField[] =
  currentCalculationAccountFieldIds.map((fieldId) => ({
    fieldId,
    lane: 'calculation_account_snapshot' as const,
    state: 'account_required' as const,
    value: null,
    reason: '计算值只能来自具名真实账户快照；不得由攻略目标或全局等级/技能默认值补齐。',
  }))

function buildProfile(asset: (typeof currentAssetProjection.agents)[number]) {
  const source = getAgentProfile(asset.stableId)
  const guidanceFields = currentBuildFieldIds.map((fieldId) =>
    authorityField(fieldId, source.fields, asset.stableId),
  )
  const core = {
    stableId: asset.stableId,
    displayName: asset.playerName,
    gameVersion:
      projectedReviewedBuild32Fields(asset.stableId)[0]?.gameVersion ??
      currentVersionProjection.gameVersion,
    releaseState: asset.releaseState,
    accountOwnable: asset.accountOwnable,
    guidance: {
      state: guidanceFields.every((field) => field.state === 'ready')
        ? ('ready' as const)
        : ('partial' as const),
      fields: guidanceFields,
    },
    calculation: {
      state: 'account_snapshot_required' as const,
      fields: calculationAccountFields,
    },
    legacySources: {
      agentProfileId: source.contentHash,
      directDamageStatus: source.directDamageStatus,
      migrationBoundary:
        'Legacy profiles are source adapters only; this authority owns current guidance completeness and never supplies account calculation facts.',
    },
  }
  return { ...core, contentHash: stableContentHash(core) }
}

const profiles = currentAssetProjection.agents.map(buildProfile)
const authorityCore = {
  schema: 'soda-current-build-authority/v1' as const,
  id: 'current-build-authority-3.1-r1' as const,
  gameVersion: currentVersionProjection.gameVersion,
  scopeManifestId: currentAssetProjection.scopeManifestId,
  profiles,
  coverage: {
    total: profiles.length,
    unique: new Set(profiles.map((profile) => profile.stableId)).size,
    guidanceReady: profiles.filter((profile) => profile.guidance.state === 'ready').length,
    guidancePartial: profiles.filter((profile) => profile.guidance.state === 'partial').length,
    guidanceFieldsReady: profiles.reduce(
      (count, profile) =>
        count + profile.guidance.fields.filter((field) => field.state === 'ready').length,
      0,
    ),
    guidanceFieldsTotal: profiles.length * currentBuildFieldIds.length,
    calculationAccountSnapshotRequired: profiles.filter(
      (profile) => profile.calculation.state === 'account_snapshot_required',
    ).length,
  },
}

export const currentBuildAuthority = {
  ...authorityCore,
  contentHash: stableContentHash(authorityCore),
}

export function getCurrentBuildAuthorityProfile(stableId: string) {
  return currentBuildAuthority.profiles.find((profile) => profile.stableId === stableId) ?? null
}

/** Historical, conditional reading only. Does not open the calculation/solver gate. */
export function getCurrentPotentialSkillReference(stableId: string) {
  if (!getCurrentBuildAuthorityProfile(stableId)) return null
  const field = getAgentProfile(stableId).fields.find(
    (item) => item.path === 'progression.potential_overlay',
  )
  if (
    !field ||
    field.conflict ||
    field.status !== 'verified_candidate' ||
    !field.sourceRefs.length ||
    !isPotentialGuideReference(field.value)
  )
    return null
  return {
    conditionLabel: '潜能6/6历史参考（未用于当前方案）',
    skillDirections: field.value.skillDirections,
  }
}

/** Both player workbenches consume the adopted guidance, never a page-local fallback. */
export function getCurrentBuildTargetPanel(stableId: string) {
  const profile = getCurrentBuildAuthorityProfile(stableId)
  const field = profile?.guidance.fields.find((item) => item.fieldId === 'build.target_panel')
  if (!profile || !field || field.state !== 'ready') return null
  return {
    value: field.value,
    status: field.sourceStatus,
    gameVersion: profile.gameVersion,
    sourceRefs: field.sourceRefs,
    conditions: field.conditions,
  }
}
