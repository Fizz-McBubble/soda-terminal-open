import { currentDataAuthorityProjection } from '../gameDataPacks/currentDataAuthorityProjection'
import { currentN4DataCompletenessGate } from '../gameDataPacks/currentN4DataCompletenessGate'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { currentFieldAuthority } from '../gameDataPacks/currentFieldAuthority'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { candidateWarehouseConstraints31 } from '../gameDataPacks/gameData31CatalogIntake'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import {
  currentN4FrontendCapabilityDataValidation,
  isFrontendCapabilityFullyValidated,
} from './currentN4FrontendCapabilityDataValidation'
import { currentN4ProductionAdapterInventory } from './currentN4ProductionAdapterInventory'

export const currentN4DataManagementGateContract = 'soda-n4-data-management-gate/v1' as const

type DataManagementState = 'ready' | 'needs_attention' | 'blocked'

function item(input: {
  id: string
  label: string
  state: DataManagementState
  summary: string
  blockers?: readonly string[]
  evidenceRefs: readonly string[]
}) {
  return Object.freeze({ ...input, blockers: input.blockers ?? [] })
}

const validatedCapabilityCount = currentN4FrontendCapabilityDataValidation.fullyValidated
const rollbackReplayReady = currentN4ProductionAdapterInventory.filter(
  (row) => row.remainingProof.length === 0,
).length
const panelAgentCount = Object.keys(currentPanelData.agents).length
const panelWEngineCount = Object.keys(currentPanelData.wEngines).length
const sigridPhaseTwoConstraint = candidateWarehouseConstraints31.find(
  (constraint) => resolveCurrentReleasedIdentity(constraint.agentId) === 'agent-sigrid',
)
const sigridLiveGuideCount =
  sigridPhaseTwoConstraint?.sources.filter((source) =>
    /prydwen|icy-veins|hoyolab|miyoushe/.test(source.id),
  ).length ?? 0

const areas = Object.freeze([
  item({
    id: 'base_facts',
    label: '游戏资料',
    state: 'needs_attention',
    summary: `当前目录 ${currentAssetProjection.entries.length} 类资产；局外面板的 60级/5突破锚点已登记 ${panelAgentCount}/${currentAssetProjection.agents.length} 名代理人和 ${panelWEngineCount}/${currentAssetProjection.wEngines.length} 件音擎。`,
    blockers: [
      ...(currentN4DataCompletenessGate.sourceAndEntityCalculationComplete
        ? []
        : ['当前目录或实体计算覆盖尚未完成。']),
      ...(currentFieldAuthority.coverage.stale === 0
        ? []
        : [`${currentFieldAuthority.coverage.stale} 个字段仍需确认当前版本适用性。`]),
      '局外面板只支持角色与音擎均为 60级/5突破的已登记组合；非满级账户状态不推算。',
      '核心技 1 对应的上游零档尚未登记，保持不支持而不猜测面板。',
    ],
    evidenceRefs: [
      'src/gameDataPacks/currentAssetProjection.ts',
      'src/gameDataPacks/currentFieldAuthority.ts',
      'src/gameDataPacks/panel/currentPanelData.ts',
    ],
  }),
  item({
    id: 'current_increment',
    label: '本期更新',
    state: 'needs_attention',
    summary: `3.1 下半已接入希格莉德、骁骑礼赞及 ${sigridLiveGuideCount} 个当期攻略来源；驱动盘、主词条、音擎、队伍与邦布已共用同一候选输入。`,
    blockers: [
      '希格莉德目标面板现为单一实装后攻略参考区间；已显示来源化范围，但不升级为 Formal 或唯一毕业线。',
      '四件套与 5 号位会随队伍变化，当前保留条件分支，不压成唯一答案。',
    ],
    evidenceRefs: [
      'src/gameDataPacks/gameData31CatalogIntake.ts',
      'src/gameDataPacks/currentBuildAuthority.ts',
      "soda-source-ref:9c971051ba8e56ca1c261fbfed557530",
    ],
  }),
  item({
    id: 'recommendation_inputs',
    label: '攻略覆盖',
    state:
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceReady ===
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.total
        ? 'ready'
        : 'needs_attention',
    summary: `${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsTotal} 项建议中已有 ${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceFieldsReady} 项本期依据；${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidanceReady}/${currentDataAuthorityProjection.currentBuildKnowledge.coverage.total} 名代理人的建议全部齐全。`,
    blockers:
      currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidancePartial > 0
        ? [
            `${currentDataAuthorityProjection.currentBuildKnowledge.coverage.guidancePartial} 名代理人仍有字段级构筑缺口。`,
          ]
        : [],
    evidenceRefs: [
      'src/gameDataPacks/currentBuildAuthority.ts',
      'docs/data/production/current-consumer-adoption.v1.json',
    ],
  }),
  item({
    id: 'independent_validation',
    label: '功能检查',
    state:
      validatedCapabilityCount === currentN4FrontendCapabilityDataValidation.registered
        ? 'ready'
        : 'blocked',
    summary: `${validatedCapabilityCount}/${currentN4FrontendCapabilityDataValidation.registered} 项玩家功能完成数据联系、质量基线和最终页面复验。`,
    blockers: currentN4FrontendCapabilityDataValidation.rows
      .filter((row) => !isFrontendCapabilityFullyValidated(row))
      .map((row) => `${row.label}：${row.primaryGap}`),
    evidenceRefs: [
      'src/validation/currentN4FrontendCapabilityDataValidation.ts',
      'src/validation/currentN4CapabilityValidationMatrix.ts',
    ],
  }),
  item({
    id: 'version_and_rollback',
    label: '更新安全',
    state: rollbackReplayReady === currentN4ProductionAdapterInventory.length ? 'ready' : 'blocked',
    summary: `${rollbackReplayReady}/${currentN4ProductionAdapterInventory.length} 项推荐已验证旧结果会失效、回退后会重算。`,
    blockers: currentN4ProductionAdapterInventory
      .filter((row) => row.remainingProof.length > 0)
      .map((row) => row.remainingProof),
    evidenceRefs: ['src/validation/currentN4ProductionAdapterInventory.ts'],
  }),
  item({
    id: 'real_account_validation',
    label: '实盘检查',
    state: 'blocked',
    summary: '已有只读代表账户证据，但本轮变更后的完整旅程与清理安全尚未重新通过。',
    blockers: [
      '需要在真实账户复验推荐、求解、保存、仓库影响和失效重算的连续旅程。',
      '需要以独立人工标签测量误清理率和有价值资产保留率。',
    ],
    evidenceRefs: [
      'src/validation/representativeWarehouseValidation.ts',
      'src/warehouse/discWarehouseAnalysis.ts',
    ],
  }),
])

const core = {
  contract: currentN4DataManagementGateContract,
  gameVersion: currentDataAuthorityProjection.currentVersion.gameVersion,
  purpose: '统一观察数据事实、推荐依据、独立验证、版本回退和真实账户证据；不参与推荐排序。',
  flow: ['source', 'canonical', 'derived', 'calculation', 'decision', 'consumer'] as const,
  areas,
  status: areas.every((area) => area.state === 'ready') ? ('ready' as const) : ('blocked' as const),
  blocksProductAcceptance: areas.some((area) => area.state === 'blocked'),
  boundary:
    '该门是现有权威与验证结果的只读汇总，不是第二数据源；任一能力的已通过证据不得外推到其他能力。',
}

export const currentN4DataManagementGate = Object.freeze({
  ...core,
  fingerprint: stableContentHash(core),
})
