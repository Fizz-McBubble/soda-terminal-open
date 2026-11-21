import {
  currentAgentNumericContracts,
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
  isReviewedSeverianNumericContract,
  sourceBoundPotentialAbsence,
} from '../calculation/currentAgentNumericContracts'
import { type AgentProfileField } from './agentProfile'
import {
  baseCurrentAgentEventContracts,
  baseCurrentAgentMechanicIdentity,
} from '../calculation/currentAgentMechanicContracts'
import {
  remielleCurrentProgressionEvidence32,
  remielleHoyoBuild32Source,
} from './currentCommunityBuildGuidance32'
import { currentAssetProjection } from './currentAssetProjection'
import { gameData31RemielleEquipmentIntake } from './gameData31RemielleEquipmentIntake'
import { getGameData31CatalogEntity } from './gameData31CatalogIntake'
import currentDecisionMechanicSupplements from './data/current-agent-decision-mechanic-supplements.3.1.json'
import potentialApplicability from './generated/current-potential-applicability-32.v1.json'
import { stableContentHash } from './types'
import { getRemielleSkillGuidanceCandidate } from './remielleGuidanceCandidate'
import { reviewedRemielleBuildReference33 } from './reviewedRemielleBuildReference33'

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
export const remielleWEngineGuidanceField: AgentProfileField = {
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

export function remielleCurrentSkillCoreCinemaGuidance32(): AgentProfileField {
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

// Current guide observations replace the active target field only. The3.1
// source capsule and saved facts remain historical inputs; they are not reloaded
// or mixed into this current same-build pair.
const remielleTargetObservation33 = reviewedRemielleBuildReference33.observation

export const remielleTargetPanelGuidanceField: AgentProfileField = {
  group: 'build_guidance',
  path: 'build.target_panel',
  value: {
    ...remielleTargetObservation33.observed,
    targetSemantics: {
      atk: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
      anomalyProficiency: {
        requirement: 'required',
        boundary: 'minimum',
        observation: 'reference',
      },
    },
  },
  status: 'candidate',
  gameVersion: '3.3',
  originalSourceVersion: 'live guide / 2026-11-01',
  lastChangeVersion: '3.3',
  currentApplicability: 'continuous',
  sourceRefs: [reviewedRemielleBuildReference33.source],
  verifiedAt: remielleTargetObservation33.checkedAt,
  conflict: null,
  reason:
    '当前GameWith同一专武配方的3855攻击／430异常精通观测；不与旧归档4000／412拼成新门槛，未知影画及精炼不补默认。',
  conditions: [reviewedRemielleBuildReference33.condition],
}

export const potentialSourceCommit = baseCurrentAgentMechanicIdentity.upstreamCommit
if (
  potentialApplicability.schema !== 'soda-current-potential-applicability/v1' ||
  potentialApplicability.targetVersion !== '3.2' ||
  potentialApplicability.evaluatedForVersion !== '3.2' ||
  potentialApplicability.entries.length !== baseCurrentAgentEventContracts.length ||
  potentialApplicability.source.commit !== potentialSourceCommit ||
  potentialApplicability.summary.total !== baseCurrentAgentEventContracts.length ||
  potentialApplicability.summary.withPotential + potentialApplicability.summary.withoutPotential !==
    baseCurrentAgentEventContracts.length
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
for (const contract of baseCurrentAgentEventContracts) {
  const entry = potentialApplicabilityByExternalId.get(contract.externalId)
  if (
    !entry ||
    entry.upstreamKey !== contract.upstreamKey ||
    entry.upstreamPath !== contract.source.statsPath ||
    entry.sourceStatsSha256 !== contract.source.statsSha256 ||
    entry.sourceVersion !== baseCurrentAgentMechanicIdentity.gameVersion ||
    entry.evaluatedForVersion !== '3.2' ||
    entry.hasPotential !== entry.potentialParamRows > 0
  )
    throw new Error(`Current potential source identity mismatch for ${contract.stableId}.`)
  if (!entry.hasPotential && entry.potentialParamRows === 0)
    currentVersionPotentialNotApplicableIds.set(contract.stableId, entry)
}
if (potentialApplicabilityByExternalId.size !== baseCurrentAgentEventContracts.length)
  throw new Error('Current potential projection contains unknown or duplicate source identities.')
// The old 60-row GO proof remains complete; Nanoka has its own negative source fact.
const nanokaPotentialAbsence = new Map(
  sourceBoundPotentialAbsence.map((entry) => {
    const numeric = getCurrentAgentNumericContract(entry.stableId)
    if (
      !numeric ||
      !(isReviewedPhoenixNumericContract(numeric) || isReviewedSeverianNumericContract(numeric)) ||
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
  ...baseCurrentAgentEventContracts.map((contract) => contract.stableId),
  ...nanokaPotentialAbsence.keys(),
])
if (
  allPotentialIdentities.size !== currentAgentNumericContracts.length ||
  currentAgentNumericContracts.some((contract) => !allPotentialIdentities.has(contract.stableId)) ||
  currentAssetProjection.agents.length !== allPotentialIdentities.size ||
  currentAssetProjection.agents.some((agent) => !allPotentialIdentities.has(agent.stableId))
)
  throw new Error('Current potential source population differs from released numeric identities.')

export function currentVersionPotentialAbsence(agentId: string) {
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
export const sigridWEngineGuidanceField: AgentProfileField = {
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
