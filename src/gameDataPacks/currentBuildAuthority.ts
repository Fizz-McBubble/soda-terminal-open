import {
  currentAgentNumericContracts,
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  sourceBoundPotentialAbsence,
} from '../calculation/currentAgentNumericContracts'
import {
  resolveReviewedBuildFieldContinuity33,
  resolveReviewedContextualTargetPanelContinuity33,
} from './reviewedBuildFieldContinuity33'
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
  remielleHoyoBuild32Source,
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
import { getReviewedSkillCoreCinemaContinuityField32 } from './reviewedSkillCoreCinemaContinuity32'
import { getCandidateWarehouseConstraintForTeam } from './candidateWarehouseConstraints'
import { currentTeamGuidanceField } from './currentTeamGuidanceField'
import { getAgentAscensionMaterialFacts } from '../calculation/agentAscensionMaterials32'
import { reviewedBuildApplicabilityExpansion32 } from './reviewedBuildApplicabilityExpansion32'
import {
  reviewedTeamDiscDirections,
  type ReviewedTeamDiscConditionContext,
} from './reviewedTeamDiscConditions'
import type { CandidateSetPlanEligibilityContext } from './candidateSetPlanEligibility'
import { getReviewedHoyoBuildDriveDiscSets32 } from './reviewedHoyoBuildDriveDiscSets32'
import {
  getReviewedHoyoBuildMiyabiMainSubStats32,
  getReviewedHoyoBuildMiyabiTargetPanel32,
} from './reviewedHoyoBuildMiyabiPanels32'
import { getReviewedHoyoBuildCurrentSkillGuidance32 } from './reviewedHoyoBuildCurrentSkillGuidance32'
import { getReviewedPotentialOverlayGuidance32 } from './reviewedPotentialOverlayGuidance32'
import { getGameData33BuildGuidanceFields } from './gameData33BuildGuidance'

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

export type CurrentBuildAuthoritySourceTier =
  | 'direct_current_3_2'
  | 'direct_current_3_3'
  | 'continuity_reviewed'
  | 'not_applicable'
  | 'incomplete'

export type CurrentBuildAuthorityField = {
  fieldId: CurrentBuildFieldId
  lane: 'guidance'
  state: CurrentBuildFieldState
  /**
   * Provenance tier, not a strength or accuracy claim.
   * Ready fields are split between a direct current-version source and the
   * explicitly bounded 3.1 -> 3.2 continuity review.
   */
  sourceTier: CurrentBuildAuthoritySourceTier
  derivation?: 'rederived_current'
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
  referenceContinuity?:
    | NonNullable<ReturnType<typeof reviewedBuildFieldReferenceContinuity32>>
    | NonNullable<ReturnType<typeof resolveReviewedBuildFieldContinuity33>>
  /** A selected, already reviewed branch; never part of context-free coverage. */
  contextualApplicability?: { directionId: string; constraintContentHash: string }
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

function remielleCurrentSkillCoreCinemaGuidance32(): AgentProfileField {
  const candidate = getRemielleSkillGuidanceCandidate('agent-remielle')
  if (!candidate) throw new Error('Remielle skill guidance candidate is missing.')
  const explicitMaximumSource = candidate.explicitTargets.source
  return {
    group: 'build_guidance',
    path: 'progression.skill_core_cinema',
    value: {
      kind: 'current_skill_core_cinema',
      skillTargets: {
        basic: { value: 12, targetType: 'paid_base_maximum' },
        dodge: {
          value: 7,
          targetType: 'low_investment_budget',
          basis: 'user budget default; source says the skill may be left low',
        },
        assist: { value: 12, targetType: 'paid_base_maximum' },
        special: { value: 12, targetType: 'paid_base_maximum' },
        chain: { value: 12, targetType: 'paid_base_maximum' },
        core: { value: 7, display: 'F', targetType: 'exact_integer' },
      },
      skillPriorityBySource: {
        'miyoushe-77017654': candidate.primaryPriority,
        [remielleHoyoBuild32Source.id]: remielleCurrentProgressionEvidence32.skillPriorityCandidate,
        status: 'source_order_conflict_preserved',
      },
      cinema: {
        recommendedLevels: remielleCurrentProgressionEvidence32.mindscapePriorityCandidate.map(
          (item) => item.level,
        ),
        pullOrder: ['0+0', '0+1', '1+1', '2+1', '6+1'],
        status: 'author_stated',
      },
    },
    status: 'verified_candidate',
    gameVersion: '3.2',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous',
    sourceRefs: [
      {
        id: explicitMaximumSource.id,
        url: explicitMaximumSource.url,
        sourceVersion: explicitMaximumSource.sourceVersion,
        originalSourceVersion: explicitMaximumSource.sourceVersion,
        checkedAt: explicitMaximumSource.checkedAt,
        contentHash: explicitMaximumSource.contentHash,
        licenseBoundary: '只采用作者原文明确的战斗技升满、核心F目标与定位，不复制正文或媒体。',
      },
      {
        id: 'miyoushe-77017654-gold-cinema-pull-order',
        url: 'https://www.miyoushe.com/zzz/article/77017654',
        sourceVersion: '3.1',
        originalSourceVersion: '3.1',
        checkedAt: '2026-10-19',
        contentHash: 'A1D88414AE02CB2F67A1B8CB1D11E8F56ADFE017EDA44C138D31ACB4FA23A43B',
        licenseBoundary:
          '只保留作者明确的影画关键等级与抽取顺序，不复制正文或媒体，不扩张到未来版本。',
      },
      { ...remielleHoyoBuild32Source },
    ],
    verifiedAt: '2026-10-20',
    conflict: null,
    reason:
      '复用已接受的3.1技能上限、核心、影画与抽取顺序，并以当前3.2来源补齐技能顺序；两种来源顺序并存，不选伪造的全局排序。',
    conditions: [
      '付费基础上限12级；实际有效等级仍须按账号影画换算，不由攻略目标替代。',
      '闪避7级是既有用户预算默认，并非作者给出的精确目标。',
      '3.1 Miyoushe与3.2 HoyoBuild技能顺序不同，两者均保留且不宣称单一全局顺序。',
      '影画等级与抽取顺序仅作指导，不推断账号持有、抽卡预算或未来版本不变。',
      '本字段不创建账号技能、影画、库存或计划DPS事实。',
    ],
  }
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
// The old 60-row GO proof remains complete; Nanoka has its own negative source fact.
const nanokaPotentialAbsence = new Map(
  sourceBoundPotentialAbsence.map((entry) => {
    const numeric = getCurrentAgentNumericContract(entry.stableId)
    if (
      !numeric ||
      !isReviewedPhoenixNumericContract(numeric) ||
      entry.externalId !== numeric.externalId ||
      !entry.potentialEmpty ||
      !entry.potentialDetailEmpty ||
      stableContentHash(entry.source) !== stableContentHash(numeric.source)
    )
      throw new Error(`Nanoka potential source binding mismatch: ${entry.stableId}`)
    return [entry.stableId, entry] as const
  }),
)
const allPotentialIdentities = new Set([
  ...currentAgentEventContracts.map((contract) => contract.stableId),
  ...nanokaPotentialAbsence.keys(),
])
if (
  allPotentialIdentities.size !== currentAgentNumericContracts.length ||
  currentAgentNumericContracts.some((contract) => !allPotentialIdentities.has(contract.stableId)) ||
  currentAssetProjection.agents.length !== allPotentialIdentities.size ||
  currentAssetProjection.agents.some((agent) => !allPotentialIdentities.has(agent.stableId))
)
  throw new Error('Current potential source population differs from released numeric identities.')

function currentVersionPotentialAbsence(agentId: string) {
  const nanoka = nanokaPotentialAbsence.get(agentId)
  if (nanoka)
    return {
      externalId: nanoka.externalId,
      sourceVersion: '3.3',
      evaluatedForVersion: '3.3',
      upstreamPath: nanoka.source.url,
      sourceStatsSha256: nanoka.source.rawSha256,
      provider: 'nanoka' as const,
      locator: nanoka.source.locators.potential,
      providerManifestSha256: nanoka.source.providerManifestSha256,
    }
  const go = currentVersionPotentialNotApplicableIds.get(agentId)
  return go ? { ...go, provider: 'genshin_optimizer' as const } : undefined
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
  if (fieldId === 'progression.potential_overlay')
    return getReviewedPotentialOverlayGuidance32(agentId)
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
  if (fieldId === 'build.drive_disc_sets') return getReviewedHoyoBuildDriveDiscSets32(agentId)
  if (fieldId === 'build.main_sub_stats' && agentId === 'agent-miyabi')
    return getReviewedHoyoBuildMiyabiMainSubStats32()
  if (fieldId === 'build.target_panel' && agentId === 'agent-miyabi')
    return getReviewedHoyoBuildMiyabiTargetPanel32()
  if (fieldId === 'progression.skill_core_cinema' && agentId === 'agent-remielle')
    return remielleCurrentSkillCoreCinemaGuidance32()
  if (fieldId === 'progression.skill_core_cinema')
    return (
      getReviewedHoyoBuildCurrentSkillGuidance32(agentId) ??
      getReviewedSkillCoreCinemaContinuityField32(agentId)
    )
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

export function selectedGuidanceField(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
): AgentProfileField | undefined {
  if (currentVersionProjection.gameVersion === '3.3' && agentId === 'agent-phoenix')
    return getGameData33BuildGuidanceFields(agentId).find((field) => field.path === fieldId)
  if (fieldId === 'progression.lv60_and_ascension') {
    const materials = getAgentAscensionMaterialFacts(agentId)
    const panel = partialCurrentFieldFacts(fieldId, fields, agentId, '3.2')
    const contract = currentAgentEventContracts.find((row) => row.stableId === agentId)
    if (materials?.status === 'supported' && panel && 'source' in panel && contract)
      return {
        group: 'build_guidance',
        path: fieldId,
        value: {
          ...panel,
          kind: 'current_level60_and_ascension_facts',
          completion: 'static_panel_and_ascension_material_facts_known',
          ascensionMaterials: materials,
        },
        status: 'verified_candidate',
        gameVersion: '3.2',
        originalSourceVersion: materials.source.sourceVersion,
        lastChangeVersion: '3.2',
        currentApplicability: 'continuous',
        sourceRefs: [
          {
            id: panel.source.id,
            url: `https://github.com/frzyc/genshin-optimizer/blob/${contract.source.commit}/${contract.source.statsPath}`,
            sourceVersion: panel.source.sourceVersion,
            checkedAt: null,
            contentHash: panel.source.contentHash,
            licenseBoundary: '既有锁定静态成长数据；不投影账户已达成。',
          },
          {
            id: `nanoka-3.2-ascension-materials:${materials.gameId}`,
            url: materials.source.url,
            sourceVersion: materials.source.sourceVersion,
            checkedAt: null,
            contentHash: materials.source.sha256,
            licenseBoundary:
              '逐角色已锁定原始 JSON SHA 与身份核验，采用 level[1..5].materials 最小事实。',
          },
        ],
        verifiedAt: null,
        conflict: null,
        conditions: [
          'LV60/A5静态成长及逐次突破材料；当前等级、突破与材料持有量仍来自账户。',
          '突破成本保留真实材料ID和丁尼，不包含角色等级经验材料或完整培养总成本。',
        ],
        reason: '复用已锁定的逐角色突破成本，与当前成长数据及正式身份共同采用。',
      }
    // Static growth without the exact source-bound ascension transitions does
    // not close the field by itself.
    return undefined
  }
  const currentTeamScenario =
    fieldId === 'build.team_bangboo_scenario' ? currentTeamGuidanceField(agentId) : undefined
  const adopted = adoptedCurrentField(agentId, fieldId)
  const field =
    (adopted?.gameVersion === '3.2' ? adopted : undefined) ??
    (currentTeamScenario?.currentApplicability === 'continuous'
      ? currentTeamScenario
      : undefined) ??
    projectedReviewedBuild32Fields(agentId).find((field) => field.path === fieldId) ??
    adopted ??
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
  const targetVersion = currentVersionProjection.gameVersion
  const continuity =
    targetVersion === '3.3'
      ? resolveReviewedBuildFieldContinuity33({
          agentId,
          targetVersion,
          field,
          formulaSha256: currentAgentEventContracts.find((row) => row.stableId === agentId)?.source
            .formulaSha256,
        })
      : reviewedBuildFieldReferenceContinuity32({ agentId, targetVersion, field })
  const state: CurrentBuildFieldState = !potentialApplicable
    ? 'not_applicable'
    : continuity
      ? 'ready'
      : fieldState(field, targetVersion)
  const rederivedVersionImpact =
    fieldId === 'build.version_change_impact' &&
    targetVersion === '3.3' &&
    continuity &&
    field?.value &&
    typeof field.value === 'object'
      ? {
          ...(field.value as Record<string, unknown>),
          targetVersion: '3.3',
          disposition: 'rederived_current_reference_continuity',
          historicalVersionImpact: {
            sourceReviewVersion: field.gameVersion,
            targetVersion: (field.value as Record<string, unknown>).targetVersion,
            disposition: (field.value as Record<string, unknown>).disposition,
            contentHash: stableContentHash(field.value),
          },
          currentEvaluation: {
            kind: 'rederived_current',
            scope: 'formed_generic_guidance_reference',
            sourceDeltaHash: 'DD6B87A5CBFBB965726D2C79297F630EBCA85187AF09F7802A6F4D0D5B3A0AE0',
            fieldBindingHash: continuity.referenceContentHash,
            runtimePromotion: false,
            formalPromotion: false,
            importPromotion: false,
            strengthPromotion: false,
            boundary:
              '原3.2字段值、来源及角色公式逐字段绑定后派生3.3一般参考延续；不证明热修复运行时或meta优劣。',
          },
        }
      : null
  const sourceTier: CurrentBuildAuthoritySourceTier =
    state === 'not_applicable'
      ? 'not_applicable'
      : state !== 'ready'
        ? 'incomplete'
        : currentVersionProjection.gameVersion === '3.3' && agentId === 'agent-phoenix'
          ? 'direct_current_3_3'
          : continuity
            ? 'continuity_reviewed'
            : (field?.reviewedSourceTier ?? 'direct_current_3_2')
  const reason = field?.reason ?? `${fieldId} 缺少可追溯的当前版本构筑字段。`
  const partialKnownFacts =
    state === 'missing' ? partialCurrentFieldFacts(fieldId, fields, agentId, targetVersion) : null
  const sourceRefs = potentialAbsence
    ? [
        {
          id:
            potentialAbsence.provider === 'nanoka'
              ? `nanoka-potential-empty:${potentialAbsence.externalId}:${potentialAbsence.locator}:provider-${potentialAbsence.providerManifestSha256}`
              : `current-raw-potential-empty:${potentialAbsence.externalId}:${potentialAbsence.upstreamPath}@${potentialSourceCommit}`,
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
    sourceTier,
    ...(rederivedVersionImpact ? { derivation: 'rederived_current' as const } : {}),
    ...(continuity ? { referenceContinuity: continuity } : {}),
    state,
    sourceStatus: field?.status ?? 'missing',
    value: state === 'ready' ? (rederivedVersionImpact ?? field?.value ?? null) : partialKnownFacts,
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
            potentialAbsence?.provider === 'nanoka'
              ? `Nanoka 3.3 身份/raw/provider SHA已绑定，${potentialAbsence.locator}均为空；潜能不适用，不推断账户状态。`
              : `当前锁定上游快照 ${potentialAbsence?.upstreamPath}（${potentialAbsence?.sourceVersion}，按 ${potentialAbsence?.evaluatedForVersion} 评估）与机制目录 SHA 一致，且原始 potentialParams 明确为空；该字段不适用，不推断账号激活状态。`,
          ]
        : [
            ...(field?.conditions ?? []),
            ...(continuity && 'boundary' in continuity ? [continuity.boundary] : []),
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
    gameVersion: currentVersionProjection.gameVersion,
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
    /** Compatibility count only; provenance must be read from the tier fields below. */
    guidanceFieldsReady: profiles.reduce(
      (count, profile) =>
        count + profile.guidance.fields.filter((field) => field.state === 'ready').length,
      0,
    ),
    guidanceFieldsDirectCurrent: profiles.reduce(
      (count, profile) =>
        count +
        profile.guidance.fields.filter(
          (field) =>
            field.sourceTier === 'direct_current_3_2' || field.sourceTier === 'direct_current_3_3',
        ).length,
      0,
    ),
    guidanceFieldsContinuityReviewed: profiles.reduce(
      (count, profile) =>
        count +
        profile.guidance.fields.filter((field) => field.sourceTier === 'continuity_reviewed')
          .length,
      0,
    ),
    guidanceFieldsNotApplicable: profiles.reduce(
      (count, profile) =>
        count + profile.guidance.fields.filter((field) => field.state === 'not_applicable').length,
      0,
    ),
    guidanceFieldsIncomplete: profiles.reduce(
      (count, profile) =>
        count + profile.guidance.fields.filter((field) => field.sourceTier === 'incomplete').length,
      0,
    ),
    guidanceFieldsAll: profiles.length * currentBuildFieldIds.length,
    /** Applicable denominator: all fields minus source-proven not-applicable fields. */
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

export type CurrentBuildAuthorityProfile = (typeof profiles)[number]

export function getCurrentBuildAuthorityProfile(
  stableId: string,
  context?: CurrentBuildTargetPanelContext,
): CurrentBuildAuthorityProfile | null {
  const profile =
    currentBuildAuthority.profiles.find((profile) => profile.stableId === stableId) ?? null
  if (!profile || !context) return profile
  const observedMindscape = context.agentStateById?.[stableId]?.mindscape
  if (
    context.mindscape !== undefined &&
    context.agentStateById?.[stableId] &&
    Object.hasOwn(context.agentStateById[stableId], 'mindscape') &&
    context.mindscape !== observedMindscape
  )
    return profile
  const expansion = reviewedBuildApplicabilityExpansion32(
    stableId,
    context,
    profile.guidance.fields,
  )
  const replacements = expansion?.fields ? [...expansion.fields] : []
  const target = getCurrentBuildTargetPanel(stableId, context)
  const baseTarget = profile.guidance.fields.find(
    (field) => field.fieldId === 'build.target_panel',
  )!
  if (stableId === 'agent-miyabi') {
    const targetChangesField =
      target &&
      (target.value !== baseTarget.value ||
        target.status !== baseTarget.sourceStatus ||
        target.sourceRefs !== baseTarget.sourceRefs ||
        target.conditions !== baseTarget.conditions)
    if (targetChangesField)
      replacements.push({
        ...baseTarget,
        state: 'ready',
        sourceTier: target.sourceRefs.some((source) =>
          source.id.startsWith('miyabi-traditional-panel-local-review32-'),
        )
          ? 'continuity_reviewed'
          : 'direct_current_3_2',
        sourceStatus: target.status,
        value: target.value,
        sourceRefs: target.sourceRefs,
        conditions: target.conditions,
        blockers: [],
        nextEvidence: [],
      })
    else if (expansion?.constraint.targetPanelApplicability)
      replacements.push({
        ...baseTarget,
        state: 'missing',
        sourceTier: 'incomplete',
        sourceStatus: 'missing',
        value: null,
        sourceRefs: [...baseTarget.sourceRefs, expansion.sourceRef],
        conditions: [expansion.constraint.targetPanelApplicability.reason],
        blockers: ['该精通分支没有已采用的目标面板；传统双暴参考不适用于此玩法。'],
        nextEvidence: ['仅在取得该精通分支的独立目标面板来源后补充，不沿用传统毕业数值。'],
        contextualApplicability: expansion.contextualApplicability,
      })
  }
  if (!replacements.length) return profile
  const fields = profile.guidance.fields.map(
    (field) => replacements.find((replacement) => replacement.fieldId === field.fieldId) ?? field,
  )
  const core = {
    ...profile,
    guidance: {
      state: fields.every((field) => field.state === 'ready' || field.state === 'not_applicable')
        ? ('ready' as const)
        : ('partial' as const),
      fields,
    },
  }
  return { ...core, contentHash: stableContentHash({ ...core, contentHash: undefined }) }
}

/** Historical, conditional reading only. Does not open the calculation/solver gate. */
export function getCurrentPotentialSkillReference(stableId: string) {
  const profile = getCurrentBuildAuthorityProfile(stableId)
  if (!profile) return null
  const field = profile.guidance.fields.find(
    (item) => item.fieldId === 'progression.potential_overlay',
  )
  if (
    !field ||
    field.state !== 'ready' ||
    field.sourceStatus !== 'verified_candidate' ||
    !field.sourceRefs.length ||
    !isPotentialGuideReference(field.value)
  )
    return null
  return {
    conditionLabel: '潜能6/6参考（未用于当前方案）',
    skillDirections: field.value.skillDirections,
  }
}

export type CurrentBuildTargetPanelContext = Omit<ReviewedTargetContext, 'agentId'> &
  ReviewedTeamDiscConditionContext &
  CandidateSetPlanEligibilityContext

/** Local 3.2 review retains the author's traditional numerical references. It
 * does not turn an older build calculation into a current graduation threshold. */
function reviewedMiyabiTraditionalPanel32(context: CurrentBuildTargetPanelContext | undefined) {
  const members = context?.memberIds
  if (!members || members.length !== 3 || new Set(members).size !== 3) return null
  const sourceTeam = [
    ['agent-miyabi', 'agent-lycaon', 'agent-soukaku'],
    ['agent-miyabi', 'agent-remielle', 'agent-burnice'],
  ].find((team) => team.every((id) => members.includes(id)))
  if (!sourceTeam || !['3.2', '3.3'].includes(currentVersionProjection.gameVersion)) return null
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
  const panel = {
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
  if (currentVersionProjection.gameVersion === '3.2') return panel
  const referenceContinuity = resolveReviewedContextualTargetPanelContinuity33({
    targetVersion: currentVersionProjection.gameVersion,
    memberIds: members,
    ...panel,
    formulaBindings: members.flatMap((agentId) => {
      const actor = currentAgentEventContracts.find((row) => row.stableId === agentId)
      return actor ? [{ agentId, formulaSha256: actor.source.formulaSha256 }] : []
    }),
  })
  return referenceContinuity
    ? {
        ...panel,
        gameVersion: '3.3',
        referenceContinuity,
        evaluatedForVersion: '3.3',
        sourceReviewVersion: '3.2',
      }
    : null
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
  if (stableId === 'agent-miyabi') {
    const traditional = reviewedMiyabiTraditionalPanel32(context)
    if (traditional) return traditional
    if (context?.memberIds) return null
  }
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
