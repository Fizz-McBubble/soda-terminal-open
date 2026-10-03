import { visualRefsFor } from './agentProfileVisualRefs'
import {
  buildField,
  projectBuildKnowledgeProfile,
  strings,
} from './agentProfileBuildKnowledgeProjection'
import { upstreamOptimizerBaseline } from './agentProfileFieldProjection'
export { upstreamOptimizerBaseline } from './agentProfileFieldProjection'
import { agentCatalog, getAgentName } from '../assault/catalog'
import { getVisualAssetCoverage } from '../assets/visualAssets'
import {
  canonicalBaseline30,
  canonicalFieldConflictLedger,
  canonicalSourceCensus,
  type CanonicalFieldStatus,
} from './canonicalBaseline'
import { getCandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import { combatFieldIntakes30 } from './combatFieldIntake'
import { directDamage30SourceLedger } from './directDamageLedger'
import { gameBase30FieldContinuityLedger } from './fieldContinuity'
import { projectedReviewedBuild32Fields } from './agentProfileFieldProjection'

// Frozen review identity of the existing adapter; a global title is not a new review.
const legacyProfileReviewVersion = '3.1'
import {
  playerBuildProfiles30,
  type PlayerBuildField,
  type PlayerBuildSource,
} from './playerBuildProfiles'
import { stableContentHash } from './types'
import { currentTeamGuidanceField } from './currentTeamGuidanceField'
import {
  getReviewedGuideBuildConditions,
  getReviewedHistoricalWEngineReferences,
} from './reviewedGuideBuildDirections'
import { getArchivedGuideSetSupplements } from './archivedGuideSetSections'
import {
  type AgentProfileFieldStatus,
  type AgentProfileSourceRef,
  type AgentProfileField,
  type UpstreamAgentProfileAdapter,
  type AgentProfile,
  type ProjectedBuildKnowledgeProfile,
  projectedCurrentConstraintFields,
} from './agentProfileFieldProjection'
export {
  agentProfileFieldStatuses,
  type AgentProfileFieldStatus,
  type AgentProfileSourceRef,
  type AgentProfileField,
  type AgentProfileVisualRef,
  type UpstreamCompatibilityRef,
  type UpstreamAgentProfileAdapter,
  type AgentProfile,
  type ProjectedBuildKnowledgeProfile,
} from './agentProfileFieldProjection'

function sourceRef(source: PlayerBuildSource | null): AgentProfileSourceRef[] {
  if (!source) return []
  return [
    {
      id: source.id,
      url: source.url,
      sourceVersion: source.sourceVersion,
      checkedAt: source.checkedAt,
      contentHash: source.contentHash,
      licenseBoundary: source.licenseBoundary,
    },
  ]
}

function canonicalStatus(status: CanonicalFieldStatus): AgentProfileFieldStatus {
  return status === 'formal' ? 'formal' : status
}

function conflictsFor(agentId: string, path: string) {
  return (
    canonicalFieldConflictLedger.find((item) => item.fieldPath === `${agentId}.${path}`) ?? null
  )
}

function playerFieldGroup(path: string): AgentProfileField['group'] {
  if (path === 'identity') return 'identity_version'
  if (path.startsWith('progression.')) return 'progression'
  if (path.startsWith('build.')) return 'build_guidance'
  return 'equipment_facts'
}

function projectedPlayerField(field: PlayerBuildField, agentId: string): AgentProfileField {
  const conflict = conflictsFor(agentId, field.path)
  const potentialAffected = field.path === 'progression.potential_overlay'
  const supplements = getReviewedGuideBuildConditions(agentId, field.path)
  const historicalWEngines =
    field.path === 'build.wengines' ? getReviewedHistoricalWEngineReferences(agentId) : []
  const conditions = [
    ...(agentId === 'agent-banyue' && field.path === 'build.drive_disc_sets'
      ? [
          '炎狱重金属2件是原文限定副词条优秀时的备选；尚未完成同面板比较，只保留来源参考，自动匹配保留折枝剑歌或啄木鸟电音副套。',
        ]
      : []),
    ...(agentId === 'agent-evelyn' && field.path === 'build.drive_disc_sets'
      ? [
          '自动匹配仍沿用已收录的2+2+2散搭候选；其他已归档配装与操作条件在历史参考中展示。可用不代表当前毕业或唯一优选，同面板收益及当前优先级仍待核验。',
        ]
      : []),
    ...(agentId === 'agent-nangong' && field.path === 'build.drive_disc_sets'
      ? [
          '单人可用法厄同4件搭配精通2件；爱芮队沿用该方向，其他异常输出与支援组队时可选静听4件，通过快速支援叠加效果。',
        ]
      : []),
    ...(agentId === 'agent-grace' && field.path === 'build.drive_disc_sets'
      ? [
          '雷暴重金属4件需要感电覆盖；当前未核验该条件，只保留来源参考，自动匹配沿用自由蓝调4件方向。',
        ]
      : []),
    ...supplements.flatMap((supplement) => supplement.conditions),
    ...historicalWEngines.flatMap((reference) => reference.conditions),
  ]
  const archivedSets =
    field.path === 'build.drive_disc_sets' ? getArchivedGuideSetSupplements(agentId) : null
  return {
    group: playerFieldGroup(field.path),
    path: field.path,
    value: archivedSets
      ? [
          ...strings(field.value),
          ...archivedSets.sets.map(
            (text) => `历史来源参考（当前适用性待核验，不参与自动配装）：${text}`,
          ),
        ]
      : field.value,
    status:
      field.status === 'candidate' && field.source?.verified && !conflict
        ? 'verified_candidate'
        : field.status,
    gameVersion: legacyProfileReviewVersion,
    originalSourceVersion: field.source?.sourceVersion ?? null,
    lastChangeVersion: potentialAffected ? '3.0' : null,
    currentApplicability: potentialAffected
      ? 'affected_pending'
      : field.status === 'missing' || !field.source?.verified
        ? 'unknown'
        : 'continuous',
    sourceRefs: [
      ...sourceRef(field.source),
      ...supplements.flatMap((supplement) => sourceRef(supplement.source)),
      ...sourceRef(archivedSets?.source ?? null),
      ...(archivedSets?.additionalSources ?? []).flatMap((source) => sourceRef(source)),
      ...historicalWEngines.flatMap((reference) => sourceRef(reference.source)),
    ],
    ...(conditions.length ? { conditions } : {}),
    verifiedAt: field.source?.checkedAt ?? null,
    conflict,
    reason: conflict ? `${field.reason}；存在来源差异，保留候选而不静默采用。` : field.reason,
  }
}

function canonicalFieldsFor(agentId: string): AgentProfileField[] {
  const entity = canonicalBaseline30.find((item) => item.stableId === agentId)
  if (!entity) return []
  return entity.fields.map((field) => {
    const source = field.sourceId
      ? canonicalSourceCensus.find((item) => item.id === field.sourceId)
      : undefined
    return {
      group: 'identity_version',
      path: field.path,
      value: null,
      status: canonicalStatus(field.status),
      gameVersion: field.sourceVersion ?? 'unknown',
      originalSourceVersion: field.sourceVersion,
      lastChangeVersion: null,
      currentApplicability: field.sourceVersion ? 'continuous' : 'unknown',
      sourceRefs: source
        ? [
            {
              id: source.id,
              url: source.url,
              sourceVersion: source.sourceVersion,
              checkedAt: source.checkedAt,
              contentHash: source.contentHash,
              licenseBoundary: source.licenseBoundary,
            },
          ]
        : [],
      verifiedAt: source?.checkedAt ?? null,
      conflict: conflictsFor(agentId, field.path),
      reason: field.reason,
    }
  })
}

function combatFieldsFor(agentId: string): AgentProfileField[] {
  const intake = combatFieldIntakes30.find((item) => item.agentId === agentId)
  if (!intake) return []
  return intake.fields.map((field) => ({
    group: 'damage_input',
    path: field.path,
    value: null,
    status: field.status,
    gameVersion: field.source.sourceVersion ?? 'unknown',
    originalSourceVersion: field.source.sourceVersion,
    lastChangeVersion: null,
    currentApplicability: 'unknown',
    sourceRefs: sourceRef(field.source),
    verifiedAt: field.source.checkedAt,
    conflict: conflictsFor(agentId, field.path),
    reason: field.reason,
  }))
}

function continuityFields(): AgentProfileField[] {
  return gameBase30FieldContinuityLedger.map((entry) => ({
    group: 'progression',
    path: `continuity.${entry.id}`,
    value: entry.affectedFieldIds,
    status: entry.status,
    gameVersion: entry.lastVerifiedVersion,
    originalSourceVersion: entry.introducedVersion,
    lastChangeVersion:
      entry.effect === 'changed' || entry.effect === 'potential' ? entry.lastVerifiedVersion : null,
    currentApplicability:
      entry.effect === 'changed' || entry.effect === 'potential'
        ? 'affected_pending'
        : entry.effect === 'unknown'
          ? 'unknown'
          : 'continuous',
    sourceRefs: [],
    verifiedAt: entry.source.checkedAt,
    conflict: null,
    reason: entry.source.evidence,
  }))
}

function directDamageStatus(agentId: string): AgentProfile['directDamageStatus'] {
  const slice = directDamage30SourceLedger.slices.find((item) => item.agentId === agentId)
  return slice?.status ?? 'missing'
}

function upstreamAdapterFor(agentId: string): UpstreamAgentProfileAdapter {
  const catalogEntry = agentCatalog.find(([id]) => id === agentId)
  const [, , specialty, catalogEntityId, , attribute] = catalogEntry ?? []
  return {
    baseline: upstreamOptimizerBaseline,
    agentId,
    upstreamIdentity: {
      stableAgentId: agentId,
      catalogEntityId: catalogEntityId ?? null,
      attribute: attribute ?? null,
      specialty: specialty ?? null,
    },
    levelRange: { min: 1, max: 60 },
    refinementRange: { min: 1, max: 5 },
    discSlots: [1, 2, 3, 4, 5, 6],
    refs: [
      {
        module: 'zzz-stats',
        status: catalogEntityId ? 'ready' : 'gap',
        sourcePaths: ['identity', 'progression.lv60_and_ascension', 'build.wengines'],
        mapping: '稳定代理人身份、等级范围与音擎/精炼语义可投给上游结构化数值层。',
        gap: catalogEntityId ? null : '目录缺少可映射的实体标识。',
      },
      {
        module: 'game-opt-solver',
        status: 'ready',
        sourcePaths: [
          'build.drive_disc_sets',
          'build.main_sub_stats',
          'build.team_bangboo_scenario',
        ],
        mapping: '六个盘位、候选套装/词条约束和方案输出可由适配层传入组合求解。',
        gap: null,
      },
      {
        module: 'zzz-formula',
        status: 'gap',
        sourcePaths: ['combat.*', 'progression.skill_core_cinema'],
        mapping: '保留角色等级、技能与计算字段的语义入口，不模拟上游公式字段名。',
        gap: '同版本动作倍率、敌人/循环与公式输入尚未完整核验，不能接入精确伤害。',
      },
      {
        module: 'pando-engine',
        status: 'gap',
        sourcePaths: ['combat.*'],
        mapping: '为后续已核验公式的表达式求值保留语义映射点。',
        gap: '尚未完成锁定提交的直接公式适配技术切片。',
      },
    ],
  }
}

function buildAgentProfile(agentId: string): AgentProfile {
  const player = playerBuildProfiles30.find((item) => item.agentId === agentId)
  const warehouse = getCandidateWarehouseConstraint(agentId)
  const fields = [
    ...canonicalFieldsFor(agentId),
    ...(player ? player.fields.map((field) => projectedPlayerField(field, agentId)) : []),
    ...(!player && warehouse ? projectedCurrentConstraintFields(warehouse) : []),
    ...combatFieldsFor(agentId),
    ...continuityFields(),
  ]
  const guidance32 = projectedReviewedBuild32Fields(agentId)
  for (const field of guidance32) {
    const index = fields.findIndex((existing) => existing.path === field.path)
    if (index < 0) fields.push(field)
    else fields[index] = field
  }
  const teamFieldIndex = fields.findIndex((field) => field.path === 'build.team_bangboo_scenario')
  if (teamFieldIndex < 0 || fields[teamFieldIndex].status === 'missing') {
    const adoptedTeamField = currentTeamGuidanceField(agentId)
    if (adoptedTeamField) {
      if (teamFieldIndex < 0)
        fields.push({ ...adoptedTeamField, gameVersion: legacyProfileReviewVersion })
      else fields[teamFieldIndex] = { ...adoptedTeamField, gameVersion: legacyProfileReviewVersion }
    }
  }
  const agentName = player?.agentName ?? getAgentName(agentId)
  const input = {
    agentId,
    agentName,
    gameVersion: guidance32[0]?.gameVersion ?? legacyProfileReviewVersion,
    fields,
    warehouseStatus: warehouse?.status ?? 'missing',
    directDamageStatus: directDamageStatus(agentId),
    visualRefs: visualRefsFor(agentId, agentName),
    upstreamAdapter: upstreamAdapterFor(agentId),
  }
  return { ...input, contentHash: stableContentHash(input) }
}

export const agentProfilesCurrent = agentCatalog
  .filter((item) => item[7] === 'released')
  .map(([agentId]) => buildAgentProfile(agentId))

export function getAgentProfile(agentId: string) {
  return (
    agentProfilesCurrent.find((profile) => profile.agentId === agentId) ??
    buildAgentProfile(agentId)
  )
}

/** Compatible page projection. It preserves partial sourced directions even when combat fields are missing. */

export function getProjectedBuildKnowledgeProfile(agentId: string): ProjectedBuildKnowledgeProfile {
  return projectBuildKnowledgeProfile(agentId, getAgentProfile(agentId))
}

export const projectedBuildKnowledgeProfilesCurrent = agentCatalog
  .filter((item) => item[7] === 'released')
  .map(([agentId]) => getProjectedBuildKnowledgeProfile(agentId))

export const agentProfileCoverageCurrent = {
  total: agentProfilesCurrent.length,
  formal: projectedBuildKnowledgeProfilesCurrent.filter((profile) => profile.status === 'formal')
    .length,
  candidate: projectedBuildKnowledgeProfilesCurrent.filter(
    (profile) => profile.status === 'candidate',
  ).length,
  missing: projectedBuildKnowledgeProfilesCurrent.filter((profile) => profile.status === 'missing')
    .length,
  identity: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'identity')?.status !== 'missing',
  ).length,
  lv60: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'progression.lv60_and_ascension')?.status !== 'missing',
  ).length,
  skillCore: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'progression.skill_core_cinema')?.status !== 'missing',
  ).length,
  potential: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'progression.potential_overlay')?.status !== 'missing',
  ).length,
  wEngines: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'build.wengines')?.status !== 'missing',
  ).length,
  driveDiscs: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'build.drive_disc_sets')?.status !== 'missing',
  ).length,
  mainSubStats: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'build.main_sub_stats')?.status !== 'missing',
  ).length,
  progression: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'build.progression')?.status !== 'missing',
  ).length,
  teamBangboo: agentProfilesCurrent.filter(
    (profile) => buildField(profile, 'build.team_bangboo_scenario')?.status !== 'missing',
  ).length,
  warehouseCandidate: agentProfilesCurrent.filter(
    (profile) => profile.warehouseStatus === 'candidate',
  ).length,
  directDamageFormal: agentProfilesCurrent.filter(
    (profile) => profile.directDamageStatus === 'formal',
  ).length,
  directDamageCandidate: agentProfilesCurrent.filter(
    (profile) => profile.directDamageStatus === 'candidate',
  ).length,
  continuousFields: agentProfilesCurrent
    .flatMap((profile) => profile.fields)
    .filter((field) => field.currentApplicability === 'continuous').length,
  affectedPendingFields: agentProfilesCurrent
    .flatMap((profile) => profile.fields)
    .filter((field) => field.currentApplicability === 'affected_pending').length,
  unknownContinuityFields: agentProfilesCurrent
    .flatMap((profile) => profile.fields)
    .filter((field) => field.currentApplicability === 'unknown').length,
  contentHash: stableContentHash(agentProfilesCurrent.map((profile) => profile.contentHash)),
} as const

/** Machine-readable field report for the 56-agent canonical projection. */
export const agentProfileCoverageReportCurrent = agentProfilesCurrent.map((profile) => ({
  agentId: profile.agentId,
  agentName: profile.agentName,
  gameVersion: profile.gameVersion,
  identity: profile.fields.filter((field) => field.group === 'identity_version'),
  lv60: buildField(profile, 'progression.lv60_and_ascension') ?? null,
  skillCore: buildField(profile, 'progression.skill_core_cinema') ?? null,
  potential: buildField(profile, 'progression.potential_overlay') ?? null,
  wEngines: buildField(profile, 'build.wengines') ?? null,
  driveDiscs: buildField(profile, 'build.drive_disc_sets') ?? null,
  mainSubStats: buildField(profile, 'build.main_sub_stats') ?? null,
  targetPanel: buildField(profile, 'build.target_panel') ?? null,
  teamBangboo: buildField(profile, 'build.team_bangboo_scenario') ?? null,
  damageInputs: profile.fields.filter((field) => field.group === 'damage_input'),
  warehouseStatus: profile.warehouseStatus,
  directDamageStatus: profile.directDamageStatus,
  visualRefs: profile.visualRefs,
  upstreamAdapter: profile.upstreamAdapter,
}))

/** Human-readable map of unified field groups to the locked upstream seams. */
export const agentProfileUpstreamCompatibilityReport = {
  baseline: upstreamOptimizerBaseline,
  mappings: [
    {
      target: 'zzz-stats',
      sourceFields: ['identity', 'progression.lv60_and_ascension', 'build.wengines'],
      status: 'ready' as const,
      note: '稳定身份、等级与音擎/精炼语义已具备适配入口。',
    },
    {
      target: 'game-opt-solver',
      sourceFields: [
        'build.drive_disc_sets',
        'build.main_sub_stats',
        'build.team_bangboo_scenario',
      ],
      status: 'ready' as const,
      note: '候选仓库约束、六盘位和方案输出可通过适配层进入求解。',
    },
    {
      target: 'zzz-formula',
      sourceFields: ['combat.*', 'progression.skill_core_cinema'],
      status: 'gap' as const,
      note: '缺少同版本完整动作、敌人、循环与公式输入核验；不产生精确伤害。',
    },
    {
      target: 'pando-engine',
      sourceFields: ['combat.*'],
      status: 'gap' as const,
      note: '等待锁定提交的公式适配技术切片；当前不猜测表达式结构。',
    },
  ],
} as const

export const agentProfileVisualCoverage30 = {
  ...getVisualAssetCoverage(),
  agentProfileRefs: agentProfilesCurrent.length,
  agentVisualVerified: agentProfilesCurrent.filter(
    (profile) =>
      profile.visualRefs.find((ref) => ref.entityType === 'agent')?.status === 'verified',
  ).length,
  agentVisualMissing: agentProfilesCurrent
    .filter(
      (profile) =>
        profile.visualRefs.find((ref) => ref.entityType === 'agent')?.status !== 'verified',
    )
    .map((profile) => profile.agentId),
  officialCacheBoundary:
    '仅使用 manifest→SHA-256→Cache Storage 的 explicit-personal-cache；页面不热链、不复制受限外部图片。',
} as const

/** @deprecated Compatibility exports; values are projected from the current 3.1 baseline. */
export const agentProfiles30 = agentProfilesCurrent
export const projectedBuildKnowledgeProfiles30 = projectedBuildKnowledgeProfilesCurrent
export const agentProfileCoverage30 = agentProfileCoverageCurrent
export const agentProfileCoverageReport30 = agentProfileCoverageReportCurrent
