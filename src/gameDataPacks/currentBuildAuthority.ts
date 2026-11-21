import { resolveReviewedBuildFieldContinuity33 } from './reviewedBuildFieldContinuity33'
import { getAgentProfile, type AgentProfileField } from './agentProfile'
import {
  currentAgentEventContracts,
  baseCurrentAgentMechanicIdentity,
} from '../calculation/currentAgentMechanicContracts'
import { currentPanelData } from './panel/currentPanelData'
import {
  remielleCurrentProgressionEvidence32,
  remielleCurrentTeamBangbooGuidance32,
} from './currentCommunityBuildGuidance32'
import { currentAssetProjection } from './currentAssetProjection'
import { currentVersionProjection } from './currentVersionProjection'
import { getReviewedBuildVersionImpact32 } from './reviewedBuildVersionImpact32'
import { stableContentHash } from './types'
import { isPotentialGuideReference } from './reviewedPotentialGuideReferences'
import {
  applyReviewedTargetObservationCorrection,
  reviewedTargetPanelGuidance,
} from './reviewedTargetPanelGuidance'
import { resolveReviewedZhaoHpTarget } from './reviewedZhaoSupportTarget'
import { resolveReviewedContextualTargetPanel } from './reviewedContextualTargetPanel'
import { projectedReviewedBuild32Fields } from './agentProfileFieldProjection'
import { reviewedBuildFieldReferenceContinuity32 } from './reviewedReferenceSupportContinuity32'
import { getRemielleSkillGuidanceCandidate } from './remielleGuidanceCandidate'
import { getReviewedSkillCoreCinemaContinuityField32 } from './reviewedSkillCoreCinemaContinuity32'
import { getCandidateWarehouseConstraintForTeam } from './candidateWarehouseConstraints'
import { currentTeamGuidanceField } from './currentTeamGuidanceField'
import { getAgentAscensionMaterialFacts } from '../calculation/agentAscensionMaterials32'
import { reviewedBuildApplicabilityExpansion32 } from './reviewedBuildApplicabilityExpansion32'
import { getReviewedHoyoBuildDriveDiscSets32 } from './reviewedHoyoBuildDriveDiscSets32'
import {
  getReviewedHoyoBuildMiyabiMainSubStats32,
  getReviewedHoyoBuildMiyabiTargetPanel32,
} from './reviewedHoyoBuildMiyabiPanels32'
import { getReviewedHoyoBuildCurrentSkillGuidance32 } from './reviewedHoyoBuildCurrentSkillGuidance32'
import { getReviewedPotentialOverlayGuidance32 } from './reviewedPotentialOverlayGuidance32'
import { getGameData33BuildGuidanceFields } from './gameData33BuildGuidance'
import {
  getReviewedPhoenixTeam33,
  getReviewedCurrentWEngineRecommendation33,
} from './reviewedCurrentGuidance33'

import {
  currentBuildFieldIds,
  currentCalculationAccountFieldIds,
} from './currentBuildAuthorityTypes'
import type {
  CurrentBuildFieldId,
  CurrentBuildFieldState,
  CurrentBuildAuthoritySourceTier,
  CurrentBuildAuthorityField,
  CurrentCalculationAccountField,
  CurrentBuildTargetPanelContext,
} from './currentBuildAuthorityTypes'
export {
  currentBuildFieldIds,
  currentCalculationAccountFieldIds,
} from './currentBuildAuthorityTypes'
export type {
  CurrentBuildFieldId,
  CurrentBuildFieldState,
  CurrentBuildAuthoritySourceTier,
  CurrentBuildAuthorityField,
  CurrentCalculationAccountField,
  CurrentBuildTargetPanelContext,
} from './currentBuildAuthorityTypes'
import {
  remielleWEngineGuidanceField,
  remielleTargetPanelGuidanceField,
  sigridWEngineGuidanceField,
  remielleCurrentSkillCoreCinemaGuidance32,
  currentVersionPotentialAbsence,
  potentialSourceCommit,
} from './currentBuildAuthoritySourceFields'
import { reviewedMiyabiTraditionalPanel32 } from './currentBuildAuthorityMiyabiPanel32'

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
        // The 3.2 continuity ledger binds the historical selected value. Current
        // replacements are separately reviewed and must not rewrite that history.
        return [
          {
            ...selected,
            value:
              adopted.wEngineReference ||
              (adopted.value &&
                typeof adopted.value === 'object' &&
                'observationCorrection' in adopted.value)
                ? selected.value
                : adopted.value,
            authorityState: adopted.state,
          },
        ]
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
        sourceVersion:
          contract.source.provider === 'nanoka'
            ? '3.3'
            : baseCurrentAgentMechanicIdentity.gameVersion,
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
  if (
    currentVersionProjection.gameVersion === '3.3' &&
    (agentId === 'agent-phoenix' || agentId === 'agent-severian')
  )
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
  const existing =
    selectedGuidanceField(fieldId, getAgentProfile(agentId).fields, agentId)?.sourceRefs ?? []
  const team =
    currentVersionProjection.gameVersion === '3.3' && fieldId === 'build.team_bangboo_scenario'
      ? getReviewedPhoenixTeam33(agentId)
      : undefined
  const engine =
    fieldId === 'build.wengines' ? getReviewedCurrentWEngineRecommendation33(agentId) : undefined
  return [...existing, ...(team?.sources ?? []), ...(engine?.sources ?? [])]
}

function authorityField(
  fieldId: CurrentBuildFieldId,
  fields: readonly AgentProfileField[],
  agentId: string,
): CurrentBuildAuthorityField {
  const field = selectedGuidanceField(fieldId, fields, agentId)
  const teamReference =
    currentVersionProjection.gameVersion === '3.3' && fieldId === 'build.team_bangboo_scenario'
      ? getReviewedPhoenixTeam33(agentId)
      : undefined
  const wEngineReference =
    fieldId === 'build.wengines' ? getReviewedCurrentWEngineRecommendation33(agentId) : undefined
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
        : currentVersionProjection.gameVersion === '3.3' &&
            (agentId === 'agent-phoenix' || agentId === 'agent-severian')
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
  const targetCorrection =
    fieldId === 'build.target_panel' && state === 'ready'
      ? applyReviewedTargetObservationCorrection(
          agentId,
          field?.value,
          field?.sourceRefs.map((source) => source.id) ?? [],
        )
      : null
  return {
    fieldId,
    lane: 'guidance',
    sourceTier,
    ...(rederivedVersionImpact ? { derivation: 'rederived_current' as const } : {}),
    ...(continuity ? { referenceContinuity: continuity } : {}),
    state,
    sourceStatus: field?.status ?? 'missing',
    ...(teamReference ? { teamReferences: [teamReference] } : {}),
    ...(wEngineReference ? { wEngineReference } : {}),
    ...(wEngineReference ? { currentReviewDisposition: 'replaced' as const } : {}),
    value:
      state === 'ready'
        ? wEngineReference && Array.isArray(field?.value)
          ? [
              wEngineReference.engineId,
              ...field.value.filter((item) => item !== wEngineReference.engineId),
            ]
          : (targetCorrection?.value ?? rederivedVersionImpact ?? field?.value ?? null)
        : partialKnownFacts,
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
            ...(targetCorrection ? [targetCorrection.condition] : []),
            ...(wEngineReference ? [wEngineReference.note] : []),
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
