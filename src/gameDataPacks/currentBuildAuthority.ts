import { getAgentProfile, type AgentProfileField } from './agentProfile'
import {
  currentAgentEventContracts,
  currentAgentMechanicIdentity,
  evaluateCurrentAgentTeamActivation,
} from '../calculation/currentAgentMechanicContracts'
import { currentPanelData } from './panel/currentPanelData'
import {
  remielleCurrentProgressionEvidence32,
  remielleCurrentTeamBangbooGuidance32,
} from './currentCommunityBuildGuidance32'
import { currentAssetProjection } from './currentAssetProjection'
import { currentVersionProjection } from './currentVersionProjection'
import {
  gameData31RemielleEquipmentIntake,
  getRemielleEquipmentField,
} from './gameData31RemielleEquipmentIntake'
import { getGameData31CatalogEntity } from './gameData31CatalogIntake'
import currentDecisionMechanicSupplements from './data/current-agent-decision-mechanic-supplements.3.1.json'
import potentialApplicability from './generated/current-potential-applicability-32.v1.json'
import { getReviewedBuildVersionImpact32 } from './reviewedBuildVersionImpact32'
import { stableContentHash } from './types'
import { isPotentialGuideReference } from './reviewedPotentialGuideReferences'
import { reviewedTargetPanelGuidance } from './reviewedTargetPanelGuidance'
import { resolveReviewedZhaoHpTarget } from './reviewedZhaoSupportTarget'
import {
  resolveReviewedContextualTargetPanel,
  type ReviewedTargetContext,
} from './reviewedContextualTargetPanel'
import { projectedReviewedBuild32Fields } from './agentProfileFieldProjection'
import { reviewedBuildFieldReferenceContinuity32 } from './reviewedReferenceSupportContinuity32'
import { getRemielleSkillGuidanceCandidate } from './remielleGuidanceCandidate'
import { getCandidateWarehouseConstraintForTeam } from './candidateWarehouseConstraints'
import { currentTeamGuidanceField } from './currentTeamGuidanceField'
import {
  reviewedTeamDiscDirections,
  type ReviewedTeamDiscConditionContext,
} from './reviewedTeamDiscConditions'

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

export type CurrentBuildFieldState = 'ready' | 'missing' | 'stale' | 'conflict' | 'not_applicable'

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
    supportedValues?: readonly string[]
    conditionsByValue?: Readonly<Record<string, readonly string[]>>
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

const potentialSourceCommit = currentAgentMechanicIdentity.upstreamCommit
if (
  potentialApplicability.schema !== 'soda-current-potential-applicability/v1' ||
  potentialApplicability.targetVersion !== '3.2' ||
  potentialApplicability.evaluatedForVersion !== '3.2' ||
  potentialApplicability.entries.length !== currentAgentEventContracts.length ||
  potentialApplicability.source.commit !== potentialSourceCommit ||
  potentialApplicability.summary.total !== currentAgentEventContracts.length ||
  potentialApplicability.summary.withPotential + potentialApplicability.summary.withoutPotential !==
    currentAgentEventContracts.length
)
  throw new Error(
    'Current potential applicability projection is not the pinned complete 3.2 snapshot.',
  )

/** Negative applicability is proved only by a current catalog source row whose
 * raw SHA was checked by the generator against the pinned upstream commit. */
const potentialApplicabilityByExternalId = new Map(
  potentialApplicability.entries.map((entry) => [entry.externalId, entry]),
)
const currentVersionPotentialNotApplicableIds = new Map<
  string,
  (typeof potentialApplicability.entries)[number]
>()
for (const contract of currentAgentEventContracts) {
  const entry = potentialApplicabilityByExternalId.get(contract.externalId)
  if (
    !entry ||
    entry.upstreamKey !== contract.upstreamKey ||
    entry.upstreamPath !== contract.source.statsPath ||
    entry.sourceStatsSha256 !== contract.source.statsSha256 ||
    entry.sourceVersion !== currentAgentMechanicIdentity.gameVersion ||
    entry.evaluatedForVersion !== '3.2' ||
    entry.hasPotential !== entry.potentialParamRows > 0
  )
    throw new Error(`Current potential source identity mismatch for ${contract.stableId}.`)
  if (!entry.hasPotential && entry.potentialParamRows === 0)
    currentVersionPotentialNotApplicableIds.set(contract.stableId, entry)
}
if (potentialApplicabilityByExternalId.size !== currentAgentEventContracts.length)
  throw new Error('Current potential projection contains unknown or duplicate source identities.')
if (
  currentAssetProjection.agents.length !== currentAgentEventContracts.length ||
  currentAssetProjection.agents.some(
    (agent) => !currentAgentEventContracts.some((contract) => contract.stableId === agent.stableId),
  )
)
  throw new Error('Current potential source population differs from released agent identities.')

function currentVersionPotentialAbsence(agentId: string) {
  return currentVersionPotentialNotApplicableIds.get(agentId)
}

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

function adoptedCurrentField(
  agentId: string,
  fieldId: CurrentBuildFieldId,
): AgentProfileField | undefined {
  if (fieldId === 'build.version_change_impact')
    return getReviewedBuildVersionImpact32(
      agentId,
      currentBuildFieldIds.flatMap((path) => {
        if (path === 'build.version_change_impact') return []
        const fields = getAgentProfile(agentId).fields
        const selected = selectedGuidanceField(path, fields, agentId)
        if (!selected) return []
        const adopted = authorityField(path, fields, agentId)
        return [{ ...selected, value: adopted.value, authorityState: adopted.state }]
      }),
    )
  if (fieldId === 'build.wengines' && agentId === 'agent-remielle')
    return remielleWEngineGuidanceField
  if (fieldId === 'build.wengines' && agentId === 'agent-sigrid') return sigridWEngineGuidanceField
  if (fieldId === 'build.target_panel' && agentId === 'agent-remielle')
    return remielleTargetPanelGuidanceField
  if (fieldId === 'build.team_bangboo_scenario' && agentId === 'agent-remielle')
    return remielleCurrentTeamBangbooGuidance32
  return undefined
}

function frozenTargetPanelGuidance(agentId: string) {
  const field = reviewedTargetPanelGuidance(agentId)
  return field ? { ...field, gameVersion: '3.1' } : undefined
}

function partialCurrentFieldFacts(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
  targetVersion: string,
) {
  if (fieldId === 'progression.lv60_and_ascension') {
    const panel = currentPanelData.agents[agentId]
    const contract = currentAgentEventContracts.find((item) => item.stableId === agentId)
    if (!panel || !contract) return null
    return {
      kind: 'partial_current_panel_facts' as const,
      level: panel.level,
      ascension: panel.ascension,
      ...(panel.kind === 'growth'
        ? {
            stats: panel.stats,
            core: panel.core,
            factRepresentation: 'current_panel_growth_projection' as const,
          }
        : {
            rawBaseStats: contract.baseStats,
            rawPromotionStatsAtAscension5: contract.promotionStats[5] ?? null,
            rawCoreStats: contract.coreStats,
            factRepresentation: 'mechanic_catalog_raw_growth_source' as const,
          }),
      completion: 'static_panel_known_ascension_material_facts_missing' as const,
      source: {
        id: `current-agent-stats:${contract.source.statsPath}@${contract.source.commit}`,
        sourceVersion: currentAgentMechanicIdentity.gameVersion,
        evaluatedForVersion: targetVersion,
        contentHash: contract.source.statsSha256.toLowerCase(),
      },
    }
  }
  if (fieldId !== 'progression.skill_core_cinema') return null

  if (agentId === 'agent-remielle')
    return {
      kind: 'partial_community_progression_evidence' as const,
      candidate: remielleCurrentProgressionEvidence32,
      explicitTargets: getRemielleSkillGuidanceCandidate(agentId)!.explicitTargets,
      sourceRefs: [
        ...remielleCurrentProgressionEvidence32.sourceRefs,
        getRemielleSkillGuidanceCandidate(agentId)!.explicitTargets.source,
      ],
      completion: 'explicit_maximum_targets_known_skill_priority_source_conflict' as const,
    }

  const progression = selectedGuidanceField('build.progression', fields, agentId)
  if (
    !progression ||
    progression.status === 'missing' ||
    progression.gameVersion !== targetVersion ||
    progression.currentApplicability !== 'continuous'
  )
    return null
  return {
    kind: 'partial_community_progression_evidence' as const,
    skillPriorityDirections: progression.value,
    sourceFieldId: 'build.progression' as const,
    sourceRefs: progression.sourceRefs,
    completion: 'cinema_and_skill_target_levels_not_in_source_field' as const,
  }
}

function partialFactSourceRefs(value: unknown): CurrentBuildAuthorityField['sourceRefs'] {
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  if (record.source && typeof record.source === 'object') {
    const source = record.source as Record<string, unknown>
    return [
      {
        id: String(source.id),
        sourceVersion: typeof source.sourceVersion === 'string' ? source.sourceVersion : null,
        evaluatedForVersion:
          typeof source.evaluatedForVersion === 'string' ? source.evaluatedForVersion : null,
        checkedAt: null,
        contentHash: typeof source.contentHash === 'string' ? source.contentHash : null,
      },
    ]
  }
  if (Array.isArray(record.sourceRefs))
    return record.sourceRefs.map((source) => ({
      id: source.id,
      sourceVersion: source.sourceVersion,
      evaluatedForVersion: source.sourceVersion === '3.2' ? '3.2' : null,
      checkedAt: source.checkedAt,
      contentHash: source.contentHash,
    }))
  const candidate = record.candidate as
    | { sourceRefs?: readonly AgentProfileField['sourceRefs'][number][] }
    | undefined
  if (candidate?.sourceRefs)
    return candidate.sourceRefs.map((source) => ({
      id: source.id,
      sourceVersion: source.sourceVersion,
      evaluatedForVersion: source.sourceVersion === '3.2' ? '3.2' : null,
      checkedAt: source.checkedAt,
      contentHash: source.contentHash,
    }))
  const sourceFieldId = record.sourceFieldId
  if (typeof sourceFieldId === 'string') return []
  return []
}

function selectedGuidanceField(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
): AgentProfileField | undefined {
  const currentTeamScenario =
    fieldId === 'build.team_bangboo_scenario' ? currentTeamGuidanceField(agentId) : undefined
  const field =
    (currentTeamScenario?.currentApplicability === 'continuous'
      ? currentTeamScenario
      : undefined) ??
    projectedReviewedBuild32Fields(agentId).find((field) => field.path === fieldId) ??
    adoptedCurrentField(agentId, fieldId) ??
    fields.find((candidate) => candidate.path === fieldId && candidate.status !== 'missing') ??
    (fieldId === 'build.target_panel' ? frozenTargetPanelGuidance(agentId) : undefined) ??
    fields.find((candidate) => candidate.path === fieldId)
  const mechanic =
    fieldId === 'build.target_panel' ? resolveReviewedZhaoHpTarget({ agentId }) : null
  if (!mechanic || !field?.value || typeof field.value !== 'object') return field
  // Adopt the skill target once for every consumer. The frozen guide observation
  // (25000+) and its payload hash stay intact in the source adapter.
  return {
    ...field,
    value: { ...field.value, hp: { min: mechanic.minimum } },
    sourceRefs: [...field.sourceRefs, mechanic.sourceRef],
    conditions: [
      ...(field.conditions ?? []),
      ...mechanic.conditions,
      '攻略的生命参考为25000+；毕业推荐采用追加能力的27000初始生命满档目标。',
    ],
  }
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
  const potentialAbsence =
    fieldId === 'progression.potential_overlay'
      ? currentVersionPotentialAbsence(agentId)
      : undefined
  const potentialApplicable = fieldId !== 'progression.potential_overlay' || !potentialAbsence
  const targetVersion =
    projectedReviewedBuild32Fields(agentId)[0]?.gameVersion ?? currentVersionProjection.gameVersion
  const continuity = reviewedBuildFieldReferenceContinuity32({ agentId, targetVersion, field })
  const state: CurrentBuildFieldState = !potentialApplicable
    ? 'not_applicable'
    : continuity
      ? 'ready'
      : fieldState(field, targetVersion)
  const reason = field?.reason ?? `${fieldId} 缺少可追溯的当前版本构筑字段。`
  const partialKnownFacts =
    state === 'missing' ? partialCurrentFieldFacts(fieldId, fields, agentId, targetVersion) : null
  const sourceRefs = potentialAbsence
    ? [
        {
          id: `current-raw-potential-empty:${potentialAbsence.externalId}:${potentialAbsence.upstreamPath}@${potentialSourceCommit}`,
          sourceVersion: potentialAbsence.sourceVersion,
          evaluatedForVersion: potentialAbsence.evaluatedForVersion,
          checkedAt: null,
          contentHash: potentialAbsence.sourceStatsSha256.toLowerCase(),
        },
      ]
    : [
        ...(field?.sourceRefs.map((source) => ({
          id: source.id,
          sourceVersion: source.sourceVersion,
          evaluatedForVersion:
            field.currentApplicability === 'continuous' ? field.gameVersion : null,
          checkedAt: source.checkedAt,
          contentHash: source.contentHash,
          ...(source.supportedValues ? { supportedValues: source.supportedValues } : {}),
          ...(source.conditionsByValue ? { conditionsByValue: source.conditionsByValue } : {}),
        })) ?? []),
        ...partialFactSourceRefs(partialKnownFacts),
      ].filter((source, index, all) => all.findIndex((other) => other.id === source.id) === index)
  const partialBlocker =
    fieldId === 'progression.lv60_and_ascension' && partialKnownFacts
      ? '当前机制目录已提供 LV60/A5 静态面板与成长数据；突破材料事实尚未闭合。'
      : fieldId === 'progression.skill_core_cinema' && partialKnownFacts
        ? agentId === 'agent-remielle'
          ? '已保留原文明示的战斗技升满与核心F目标；当前来源的技能优先顺序冲突、影画投资建议仍未闭合。'
          : '已保留当前来源的技能方向子项；技能等级目标、核心/影画投资建议或来源优先顺序冲突仍未闭合。'
        : reason
  return {
    fieldId,
    lane: 'guidance',
    ...(continuity ? { referenceContinuity: continuity } : {}),
    state,
    sourceStatus: field?.status ?? 'missing',
    value: state === 'ready' ? (field?.value ?? null) : partialKnownFacts,
    sourceRefs,
    blockers:
      state === 'ready' || state === 'not_applicable'
        ? []
        : [
            partialBlocker,
            ...(field && field.status !== 'missing' && field.gameVersion !== targetVersion
              ? [`该字段仅复核至 ${field.gameVersion}；${targetVersion} 适用性尚未闭合。`]
              : []),
          ],
    conditions:
      state === 'not_applicable'
        ? [
            `当前锁定上游快照 ${potentialAbsence?.upstreamPath}（${potentialAbsence?.sourceVersion}，按 ${potentialAbsence?.evaluatedForVersion} 评估）与机制目录 SHA 一致，且原始 potentialParams 明确为空；该字段不适用，不推断账号激活状态。`,
          ]
        : [
            ...(field?.conditions ?? []),
            ...(partialKnownFacts
              ? [
                  fieldId === 'progression.lv60_and_ascension'
                    ? '该值是当前来源的静态满级/满突破面板子事实，不是用户账号状态；没有据此填入突破材料、消耗或账户等级。'
                    : '该值保留来源明确的技能优先方向子事实；没有据此伪造技能目标等级或当前账号技能等级。',
                  ...(agentId === 'agent-remielle'
                    ? [remielleCurrentProgressionEvidence32.boundary]
                    : []),
                ]
              : []),
          ],
    nextEvidence:
      state === 'ready' || state === 'not_applicable'
        ? []
        : fieldId === 'build.version_change_impact'
          ? [
              `核对 ${targetVersion} 当前构筑字段与分支、热修复；已有历史构筑的代理人再做同字段值对比。`,
            ]
          : fieldId === 'progression.lv60_and_ascension' && partialKnownFacts
            ? ['补齐当前适用的突破材料和消耗事实；已知静态面板子事实见 value/sourceRefs。']
            : fieldId === 'progression.skill_core_cinema' && partialKnownFacts
              ? [
                  '闭合当前适用的技能优先、核心技/影画方向及来源冲突；已知子事实保留在 value/sourceRefs。',
                ]
              : [
                  `补齐 ${fieldId} 的 ${targetVersion} evaluated-for 证据并通过字段级 continuity gate.`,
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
      state: guidanceFields.every(
        (field) => field.state === 'ready' || field.state === 'not_applicable',
      )
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
  id: `current-build-authority-${currentVersionProjection.gameVersion}-r2`,
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
    guidanceFieldsNotApplicable: profiles.reduce(
      (count, profile) =>
        count + profile.guidance.fields.filter((field) => field.state === 'not_applicable').length,
      0,
    ),
    guidanceFieldsTotal:
      profiles.length * currentBuildFieldIds.length -
      profiles.reduce(
        (count, profile) =>
          count +
          profile.guidance.fields.filter((field) => field.state === 'not_applicable').length,
        0,
      ),
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

export type CurrentBuildTargetPanelContext = Omit<ReviewedTargetContext, 'agentId'> &
  ReviewedTeamDiscConditionContext

/** Local 3.2 review retains the author's traditional numerical references. It
 * does not turn an older build calculation into a current graduation threshold. */
function reviewedMiyabiTraditionalPanel32(context: CurrentBuildTargetPanelContext | undefined) {
  const members = context?.memberIds
  if (!members || members.length !== 3 || new Set(members).size !== 3) return null
  const sourceTeam = [
    ['agent-miyabi', 'agent-lycaon', 'agent-soukaku'],
    ['agent-miyabi', 'agent-remielle', 'agent-burnice'],
  ].find((team) => team.every((id) => members.includes(id)))
  if (!sourceTeam || currentVersionProjection.gameVersion !== '3.2') return null
  const state = context.agentStateById?.['agent-miyabi']
  const mindscape = state && Object.hasOwn(state, 'mindscape') ? state.mindscape : context.mindscape
  if (
    typeof mindscape !== 'number' ||
    !Number.isInteger(mindscape) ||
    mindscape < 0 ||
    mindscape > 6 ||
    (context.mindscape !== undefined && context.mindscape !== mindscape) ||
    context.selectedDirectionIdByAgentId?.['agent-miyabi']
  )
    return null
  const mechanic = currentAgentEventContracts.find((row) => row.stableId === 'agent-miyabi')
  if (
    mechanic?.source.formulaSha256.toLowerCase() !==
      '7c7e1f1aeda1d38976d4c0b47c111eb0b4fc76dfe0e6554b567d8260df8127f3' ||
    mechanic.source.statsSha256.toLowerCase() !==
      '1dbfcdce806774269df8e69837308bdaaf547928339ef8be8425cb34300f4443'
  )
    return null
  const activation = evaluateCurrentAgentTeamActivation({
    stableId: 'agent-miyabi',
    memberIds: members,
    agentState: { mindscape, potentialImage: state?.potentialImage },
  })
  if (activation.status !== 'supported' || !activation.active) return null
  const original = reviewedTargetPanelGuidance('agent-miyabi')
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  if (!original || !isRecord(original.value)) return null
  const originalValue = original.value
  const originalSourceMetadata = originalValue.sourceMetadata
  const targetSemantics = originalValue.targetSemantics
  if (
    !isRecord(originalSourceMetadata) ||
    originalSourceMetadata.sourceId !== 'prydwen-miyabi-current-2026-08-05' ||
    !isRecord(targetSemantics) ||
    Object.values(targetSemantics).some((semantic) => !isRecord(semantic))
  )
    return null
  const frozenPrydwenPayload = 'fnv1a-a275dbdf'
  const originalSource = original.sourceRefs.find(
    (source) => source.id === 'prydwen-miyabi-current-2026-08-05',
  )
  // The traditional numbers were reviewed as one frozen payload. Any source
  // edit invalidates the 3.2 team review until those numbers are reviewed again.
  if (
    originalSource?.contentHash?.toLowerCase() !== frozenPrydwenPayload ||
    typeof originalSourceMetadata.observedPayloadHash !== 'string' ||
    originalSourceMetadata.observedPayloadHash.toLowerCase() !== frozenPrydwenPayload
  )
    return null
  const conditions = [
    ...(original.conditions ?? []),
    '作者构筑复审为2.1、玩法复审为1.5；2026-09-30仅为页面更新。本地3.2按明确传统队与当前机制复核，数值仅作培养参考，不作为毕业硬门。',
    '暴击率75–95%、暴伤150–190%、攻击2500–3600及精通240等保留作者配装参考；80%仅为战斗霜染积蓄转换封顶，不假定影画与四件套窗口已激活。',
  ]
  const teamSource = members.includes('agent-remielle')
    ? reviewedTeamDiscDirections.find((row) => row.agentId === 'agent-miyabi')?.source
    : undefined
  if (members.includes('agent-remielle') && teamSource?.localReviewVersion !== '3.2') return null
  return {
    value: {
      ...originalValue,
      targetSemantics: Object.fromEntries(
        Object.entries(targetSemantics).map(([key, semantic]) => [
          key,
          { ...(semantic as Record<string, unknown>), observation: 'reference' as const },
        ]),
      ),
      cultivationReference: {
        keys: ['atk', 'critRate', 'critDamage', 'anomalyProficiency', 'anomalyMastery'],
        conditions,
        sourceVersion: original.gameVersion,
        level: 60,
      },
      sourceMetadata: {
        ...originalSourceMetadata,
        authorBuildReviewVersion: '2.1',
        authorGameplayReviewVersion: '1.5',
        authorProfileUpdatedAt: '2026-09-30',
        localReviewVersion: '3.2',
        localReviewedAt: '2026-10-19',
        localReviewScope: 'source_named_traditional_team_cultivation_reference_only',
      },
    },
    status: original.status,
    gameVersion: '3.2',
    sourceRefs: [
      ...original.sourceRefs.map((source) => ({ ...source, evaluatedForVersion: '3.1' })),
      {
        id: 'miyabi-traditional-panel-local-review32-20261019',
        sourceVersion: null,
        evaluatedForVersion: '3.2',
        checkedAt: '2026-10-19',
        contentHash: 'CF94D68F5AF17346B8CE30A353955B44E6F0517DA0596FC307A4364010F7F214',
      },
      ...(teamSource
        ? [
            {
              id: `miyoushe-${teamSource.postId}:text:0167`,
              sourceVersion: teamSource.sourceVersion,
              evaluatedForVersion: teamSource.localReviewVersion ?? null,
              checkedAt: teamSource.localReviewedAt ?? null,
              contentHash: teamSource.contentHash,
            },
          ]
        : []),
    ],
    conditions,
  }
}

/** Both player workbenches consume the adopted guidance, never a page-local fallback. */
export function getCurrentBuildTargetPanel(
  stableId: string,
  context?: CurrentBuildTargetPanelContext,
) {
  if (
    context?.memberIds &&
    getCandidateWarehouseConstraintForTeam(stableId, context)?.targetPanelApplicability
  )
    return null
  const profile = getCurrentBuildAuthorityProfile(stableId)
  const field = profile?.guidance.fields.find((item) => item.fieldId === 'build.target_panel')
  if (stableId === 'agent-miyabi' && field?.state === 'stale')
    return reviewedMiyabiTraditionalPanel32(context)
  if (!profile || !field || field.state !== 'ready') return null
  const panel = {
    value: field.value,
    status: field.sourceStatus,
    gameVersion: profile.gameVersion,
    sourceRefs: field.sourceRefs,
    conditions: field.conditions,
  }
  const mechanicContext =
    context &&
    ['coreLevel', 'specialLevel', 'engineId', 'engineRefinement', 'agentLevel', 'mindscape'].some(
      (key) => Object.hasOwn(context, key),
    )
  return mechanicContext
    ? resolveReviewedContextualTargetPanel(panel, { ...context, agentId: stableId })
    : panel
}
