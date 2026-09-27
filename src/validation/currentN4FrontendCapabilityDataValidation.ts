import { current31TeamRatingCoverage } from './current31TeamRatingCoverage'

export const currentN4FrontendCapabilityDataValidationContract =
  'soda-n4-frontend-capability-data-validation/v1' as const

export type FrontendCapabilityEvidenceStatus =
  | 'pass'
  | 'limited'
  | 'missing'
  | 'unknown'
  | 'not_applicable'

export type FrontendCapabilityEvidence = {
  sourceAndAccountAuthority: FrontendCapabilityEvidenceStatus
  canonicalAndDerivedLineage: FrontendCapabilityEvidenceStatus
  upstreamAndDownstreamHandoff: FrontendCapabilityEvidenceStatus
  qualityMetricWithDenominator: FrontendCapabilityEvidenceStatus
  missingConflictStaleBehavior: FrontendCapabilityEvidenceStatus
  rollbackOrRecovery: FrontendCapabilityEvidenceStatus
  representativePageState: FrontendCapabilityEvidenceStatus
  unexpectedWriteCheck: FrontendCapabilityEvidenceStatus
}

export type FrontendCapabilityDataValidationRow = {
  capabilityId: string
  label: string
  routes: readonly string[]
  modelCapabilityIds: readonly string[]
  candidateReview: 'bounded_ready' | 'evidence_pending' | 'blocked'
  evidence: FrontendCapabilityEvidence
  evidenceRefs: readonly string[]
  primaryGap: string
}

const unreviewedEvidence = {
  sourceAndAccountAuthority: 'unknown',
  canonicalAndDerivedLineage: 'unknown',
  upstreamAndDownstreamHandoff: 'unknown',
  qualityMetricWithDenominator: 'unknown',
  missingConflictStaleBehavior: 'unknown',
  rollbackOrRecovery: 'unknown',
  representativePageState: 'unknown',
  unexpectedWriteCheck: 'unknown',
} as const satisfies FrontendCapabilityEvidence

function capability(
  input: Omit<FrontendCapabilityDataValidationRow, 'evidence'> & {
    evidence?: Partial<FrontendCapabilityEvidence>
  },
): FrontendCapabilityDataValidationRow {
  return Object.freeze({
    ...input,
    evidence: Object.freeze({ ...unreviewedEvidence, ...input.evidence }),
  })
}

export const currentN4FrontendCapabilityDataValidationRows = Object.freeze([
  capability({
    capabilityId: 'system_readiness_and_home_journey',
    label: '首页状态与下一步',
    routes: ['/'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: { representativePageState: 'limited' },
    evidenceRefs: [
      'src/appCapabilityHealth.ts',
      'src/pages/DashboardPage.tsx',
      'src/pages/DashboardPage.test.tsx',
    ],
    primaryGap:
      '原桌面KV尺寸及窄屏排布已修，图片管理仅下载加载和删除缓存。真实账户删除后重新下载、素材源不可用下服务重启与新页面四类图片冷读已通过；账户与方案保持。首页主观接受仍待用户，Windows重启或整机断网未测试，不将其混称已完成。',
  }),
  capability({
    capabilityId: 'account_lifecycle',
    label: '账户选择、切换、备份与恢复',
    routes: ['/assets/account', '/system/data'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'pass',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      "soda-source-ref:28586429008b586fd8029751db7782f0",
      "soda-source-ref:55599cac1d6cd3f0e4510f26917d406c",
      "soda-source-ref:2b70acbad500659c302b21a578b45733",
      'src/accounts/backup.ts',
      'src/accounts/repository.ts',
      'src/pages/AssetCenterPage.tsx',
      'src/components/assets/r6/Account.tsx',
      'src/accounts/backup.test.ts',
      'src/accounts/n4RealAccountRecovery.test.ts',
      'src/components/assets/r6/AssetMaintenanceGolden.test.tsx',
    ],
    primaryGap:
      '历史32代理人/492盘/5份方案的恢复与兼容证据保留；当前只读回放为33代理人/452盘/11份方案，不能沿用旧分母。历史集中导出核对账户、养成、偏好和旧方案逐字段守恒；当前输入未写入。真实异常恢复页面仍缺。',
  }),
  capability({
    capabilityId: 'scanner_capture',
    label: '扫描执行与结果状态',
    routes: ['/system/scanner'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      sourceAndAccountAuthority: 'pass',
      canonicalAndDerivedLineage: 'pass',
      upstreamAndDownstreamHandoff: 'pass',
      missingConflictStaleBehavior: 'pass',
      unexpectedWriteCheck: 'pass',
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'pass',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      'src/scanner/runtime.ts',
      'src/scanner/distribution.ts',
      'src/pages/ScannerAssistantPage.tsx',
      'src/pages/ScannerAssistantPage.test.tsx',
      'src/scanner/runtime.test.ts',
      'scripts/scanner-native-wiring.test.mjs',
    ],
    primaryGap:
      '历史实机扫描492张完整成功，failed=0、partial=false；当前账户只读回放为452盘，不把旧扫描数当当前仓库分母。既有停止恢复与任务隔离证据保留；本轮没有重新扫描，真实Helper旅程和异常恢复不能由组件测试代替。',
  }),
  capability({
    capabilityId: 'scan_review_and_import',
    label: '扫描审阅、预检与导入',
    routes: ['/system/scanner', '/system/data/import-discs'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      sourceAndAccountAuthority: 'pass',
      canonicalAndDerivedLineage: 'pass',
      upstreamAndDownstreamHandoff: 'pass',
      missingConflictStaleBehavior: 'pass',
      unexpectedWriteCheck: 'pass',
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'pass',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      "soda-source-ref:6589953f7f7f883f921fb8dc5a0e27c9",
      "soda-source-ref:f6bc88049e7b0f70e2f305784b6e8aca",
      'src/domain/scanImportStaging.ts',
      'src/db/database.ts',
      'src/pages/FormalDiscImportPage.tsx',
      'src/pages/ScannerAssistantPage.tsx',
      'src/testing/realReviewExperience.test.ts',
      'src/pages/FormalDiscImportPage.test.tsx',
    ],
    primaryGap:
      '历史492条扫描结果的正式导入与字段守恒证据保留；当前账户只读回放为452盘，本轮没有再次导入。一次确认、完成刷新、18盘及仓库消费、新方案保存和重启回读的历史证据有效；真实账户异常恢复页面仍缺，隔离事务/失败回滚证据不冒充真实故障。',
  }),
  capability({
    capabilityId: 'agent_asset_maintenance',
    label: '代理人资产维护',
    routes: ['/assets/agents'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'pass',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      "soda-source-ref:28586429008b586fd8029751db7782f0",
      'src/pages/AssetCenterPage.tsx',
      'src/components/assets/r6/AgentEditor.tsx',
      'src/accounts/wEngineAssignment.ts',
      'src/pages/AgentDevelopmentWorkbenchPage.tsx',
      'src/decision/accountDecisionFingerprint.ts',
      'src/warehouse/discWarehouseAnalysis.ts',
      'src/pages/AssetCenterPage.r6-adapter.test.tsx',
      'src/decision/accountDecisionFingerprintBoundary.test.ts',
    ],
    primaryGap:
      '等级、潜能、技能、音擎与六盘的同源名册及隔离保存、跨账户、过期和保护证据保留。本次导入后养成事实逐字段守恒，真实团队已消费并显示当前音擎缺失与方案音擎差异；这不等于本次真实编辑代理人并保存，剩余编辑异常和最终页面接受按相应旅程核验。',
  }),
  capability({
    capabilityId: 'disc_inventory_maintenance',
    label: '驱动盘库存维护',
    routes: ['/assets/discs'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'pass',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      'src/pages/AssetCenterPage.tsx',
      'src/components/assets/r6/CatalogWorkspace.tsx',
      'src/components/assets/r6/SecondaryEditors.tsx',
      'src/accounts/repository.ts',
      'src/accounts/repository.delete.test.ts',
      'src/pages/AssetCenterPage.r6-adapter.test.tsx',
    ],
    primaryGap:
      '历史492盘导入与18盘引用一致证据保留；当前只读仓库为452盘，最终页面投影118保留/67观察/267清理复核，不能沿用旧r3.18统计。并发事务证据来自隔离测试，不在真实账户制造删除竞争；真实手动编辑后异常恢复仍未覆盖。',
  }),
  capability({
    capabilityId: 'catalog_and_media',
    label: '音擎、邦布与图形目录',
    routes: ['/assets/wengines', '/assets/bangboos'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'pass',
      rollbackOrRecovery: 'not_applicable',
      representativePageState: 'limited',
    },
    evidenceRefs: [
      "soda-source-ref:78532ddff9d4d83f50f7e93619375c7f",
      'src/gameDataPacks/currentAssetProjection.ts',
      'src/gameDataPacks/currentWEngineStaticCatalog.ts',
      'src/gameDataPacks/currentBangbooNumericCatalog.ts',
      'src/assets/visualAssets.ts',
      'src/assets/visualAssetSlots.ts',
      'src/components/VisualEntityImage.tsx',
      'src/validation/catalogAndMediaIntegration.test.ts',
      'tests/n1c-visual-regression.spec.ts',
    ],
    primaryGap:
      '95音擎/41邦布与计算目录同源，图形校验后本地缓存无运行时热链。真实删除并重新下载、58代理人图片解码恢复、素材源不可用下服务重启及新页面读取四类图片通过；缓存删除不改账户。不是Windows重启或整机断网；最终视觉接受仍待用户，图包导入导出已退出玩家验收任务。',
  }),
  capability({
    capabilityId: 'agent_progression_and_skill',
    label: '代理人养成与技能建议',
    routes: ['/development', '/development/:agentId'],
    modelCapabilityIds: ['agent_skill_recommendation'],
    candidateReview: 'bounded_ready',
    evidence: { qualityMetricWithDenominator: 'missing' },
    evidenceRefs: [
      'src/calculation/skillInvestmentPolicy.ts',
      'src/validation/currentN4CapabilityValidationMatrix.ts',
    ],
    primaryGap: '技能顺序与目标等级仍缺独立样本和留出验证。',
  }),
  capability({
    capabilityId: 'agent_build_recommendation_and_panel',
    label: '音擎、驱动盘、配队与面板建议',
    routes: ['/development/:agentId'],
    modelCapabilityIds: [
      'w_engine_recommendation',
      'graduation_panel',
      'disc_build_recommendation',
    ],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'missing',
      canonicalAndDerivedLineage: 'limited',
      upstreamAndDownstreamHandoff: 'limited',
    },
    evidenceRefs: [
      "soda-source-ref:4316429f3c69a3b354ec860dd997f224",
      'src/gameDataPacks/currentBuildAuthority.ts',
      'src/gameDataPacks/panel/currentPanelData.ts',
    ],
    primaryGap:
      '58人来源化面板、技能指导及条件化盘参考已接入；有限成员/潜能/邦布星级条件复核通过。柚叶3000攻击后AP已消费于单人、团队、替代搜索和保存重放；真实18盘方案2921攻击/248AP诚实显示未达标。仅具名支持参数和有界候选，完整独立质量/留出验证仍缺，不外推全角色或统一毕业最优。',
  }),
  capability({
    capabilityId: 'single_agent_warehouse_compare_save',
    label: '单人仓库匹配、比较与保存',
    routes: ['/development/:agentId', '/development/:agentId/loadouts'],
    modelCapabilityIds: ['single_agent_warehouse_ranking'],
    candidateReview: 'bounded_ready',
    evidence: { qualityMetricWithDenominator: 'pass' },
    evidenceRefs: [
      "soda-source-ref:4316429f3c69a3b354ec860dd997f224",
      "soda-source-ref:6e1e0c46db8a2235195049f4bad499f0",
      "soda-source-ref:ff6ef60ffbf6c4a7f2fc9f793fe4cdc4",
      'src/accounts/n4RealAccountRecovery.test.ts',
      'src/optimizer/candidateWarehouseSolver.ts',
      'src/validation/warehouseSolverRegretAudit.test.ts',
      'src/validation/n4RealWarehouseOracle.test.ts',
    ],
    primaryGap:
      '当前具名备份的452张实体盘在生产Query中给出10个合法六盘候选；0张已记录实装不阻断方案查看、面板和显式保存。隔离账户以当前实体方案保存后，旧快照失效、重查按具名保存方案比较且历史方案与资产不变。真实实装六盘相对变化分支无输入，保持未验证；旧492盘模板分和旧混合音擎Delta不作为当前证据。',
  }),
  capability({
    capabilityId: 'box_team_bangboo_recommendation',
    label: 'BOX、队伍与邦布建议',
    routes: ['/loadouts/team', '/loadouts/team/:teamKey'],
    modelCapabilityIds: ['team_and_bangboo'],
    candidateReview: 'bounded_ready',
    evidence: {
      qualityMetricWithDenominator: 'limited',
      upstreamAndDownstreamHandoff: 'limited',
      missingConflictStaleBehavior: 'limited',
    },
    evidenceRefs: [
      'src/decision/current31MainstreamAuthorityEvaluationGate.ts',
      'src/decision/bangbooRecommendationAuthority.ts',
      'src/decision/current31RatingVisibilityAudit.test.ts',
      'src/validation/current31TeamRatingCoverage.ts',
      "soda-source-ref:15174216b02e8bb8766b034ba309e965",
    ],
    primaryGap: (() => {
      const rating = current31TeamRatingCoverage()
      const summary =
        rating.status === 'measured'
          ? `当前来源目录${rating.uniqueTeams}个精确三人方向，索引评级分类：有依据${rating.counts.reviewed}、规则推导${rating.counts.ruleDerived}、模型参考${rating.counts.modelInferred}、初步方向${rating.counts.preliminary}、未定档${rating.counts.unrated}、硬拒绝${rating.counts.hardInvalid}、计算受阻${rating.counts.blocked}。`
          : `当前来源评级统计未完成：${rating.issues.slice(0, 3).join('；')}；不可将缺失结果算作未知强度。`
      return (
        summary +
        '完整发布夹具的默认可见性与搜索分流见现有回读；来源连通不等于独立实战准确率。有限成员/潜能/邦布激活及真实BOX18盘已有有界证据；六个历史组合独立强度及独立Top-K质量仍缺。'
      )
    })(),
  }),
  capability({
    capabilityId: 'team_joint_and_portfolio_assignment',
    label: '单队联合配装与历史方案兼容',
    routes: ['/loadouts/team/:teamKey'],
    modelCapabilityIds: ['team_joint_disc_assignment', 'portfolio_coordination'],
    candidateReview: 'bounded_ready',
    evidence: { qualityMetricWithDenominator: 'limited' },
    evidenceRefs: [
      'src/decision/teamExecutionProjection.ts',
      'src/validation/warehouseSolverSampledRegret.test.ts',
      "soda-source-ref:6e1e0c46db8a2235195049f4bad499f0",
    ],
    primaryGap:
      '当前备份经生产Query得到1支队伍、3名已拥有成员、18张互异且均属当前账户仓库的实体盘，各成员1–6槽完整；历史新增单队方案保存、刷新及重开证据继续有效。有界求解不代表真实大仓全局最优，历史多队方案兼容不授权恢复多队UI。',
  }),
  capability({
    capabilityId: 'value_benchmark',
    label: '同条件方案比较',
    routes: ['/development/:agentId/loadouts', '/loadouts/team/:teamKey'],
    modelCapabilityIds: ['value_benchmark'],
    candidateReview: 'bounded_ready',
    evidence: {
      sourceAndAccountAuthority: 'limited',
      canonicalAndDerivedLineage: 'pass',
      upstreamAndDownstreamHandoff: 'pass',
      qualityMetricWithDenominator: 'limited',
      missingConflictStaleBehavior: 'pass',
      rollbackOrRecovery: 'limited',
      representativePageState: 'limited',
      unexpectedWriteCheck: 'pass',
    },
    evidenceRefs: [
      "soda-source-ref:6e1e0c46db8a2235195049f4bad499f0",
      "soda-source-ref:ff6ef60ffbf6c4a7f2fc9f793fe4cdc4",
      'src/calculation/valueBenchmarkComparison.ts',
      'src/calculation/valueBenchmarkComparison.test.ts',
      'src/decision/developmentValueBenchmark.test.ts',
      'src/calculation/currentWEnginePersonalPlanningEffects.test.ts',
      'src/decision/accountDecisionFingerprintBoundary.test.ts',
      'src/pages/AgentLoadoutComparisonPage.decision-surface.test.tsx',
      'src/validation/currentN4CapabilityValidationMatrix.ts',
    ],
    primaryGap:
      'F05固定上下文与计算指纹继续约束双侧。当前账户0张已记录实装；原Query以具名保存方案六盘按当前资产重算，对10个候选给出10项计算范围内可比较数值，未声称相对游戏实装提升。方案间及缺第二方案、缺音擎、部分实装均有独立反例；覆盖不足只保留固定事件差值，不推整体优劣。真实实装相对变化与外部误差仍未验证，不能称实战伤害优势。',
  }),
  capability({
    capabilityId: 'disc_analysis_and_cleanup_review',
    label: '驱动盘分析与清理复核',
    routes: ['/warehouse/discs'],
    modelCapabilityIds: ['warehouse_cleanup'],
    candidateReview: 'bounded_ready',
    evidence: { qualityMetricWithDenominator: 'limited' },
    evidenceRefs: [
      "soda-source-ref:6e1e0c46db8a2235195049f4bad499f0",
      "soda-source-ref:7141fa41a63fe2bbee42ae8b6c142af4",
      "soda-source-ref:67e86c5a1f37084a3eeb4abba0347714",
      'src/warehouse/discWarehouseAnalysis.ts',
      'src/warehouse/discWarehouseAnalysis.boundaries.test.ts',
      'src/warehouse/discWarehouseRealInput.test.ts',
    ],
    primaryGap:
      '当前452盘只读生产Query的最终页面投影为118保留/67观察/267清理复核；逐盘核对当前仓库实装与保存引用保护、替代存活、同时需求和清理理由。唯一不在现仓的引用属历史单人方案且盘在扫描归档。独立15组42张隔离反例仍只证明有界安全；总体误清/漏筛/过度保留率未获独立估计，清理只供人工复核，不自动删除。',
  }),
  capability({
    capabilityId: 'version_update_quarantine_rollback',
    label: '版本更新、隔离与回退',
    routes: ['/system/data/review-dev'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      missingConflictStaleBehavior: 'pass',
      rollbackOrRecovery: 'limited',
      unexpectedWriteCheck: 'pass',
    },
    evidenceRefs: [
      'src/gameDataPacks/currentFieldAuthority.ts',
      'src/validation/currentN4CapabilityQuarantineRehearsal.test.ts',
      'src/validation/n4CurrentOutputRecovery.test.ts',
      'src/validation/n4CurrentOutputRecovery.team-portfolio.test.ts',
      'src/gameDataPacks/runtimeSelection.test.ts',
    ],
    primaryGap:
      '当前编译3.1包的隔离回归已覆盖10项能力指纹门，以及实际Query的单人候选、单队18盘比较、双队历史兼容、来源评级、仓库输出：切到不匹配旧包时旧run和新计算均拒绝，修复配套包后输出及指纹复现，隔离账户资产与方案不变。此为当前版本消费者的有界恢复证据，不代表未来3.2逐能力真实迁移或生产账户回退。历史未检出希格莉德实装后具名官方热修，其更新状态仍未核实。',
  }),
  capability({
    capabilityId: 'cross_module_stale_and_recovery',
    label: '跨模块失效与恢复',
    routes: ['all production routes'],
    modelCapabilityIds: [],
    candidateReview: 'bounded_ready',
    evidence: {
      sourceAndAccountAuthority: 'limited',
      canonicalAndDerivedLineage: 'pass',
      upstreamAndDownstreamHandoff: 'pass',
      qualityMetricWithDenominator: 'limited',
      missingConflictStaleBehavior: 'pass',
      rollbackOrRecovery: 'limited',
      representativePageState: 'limited',
      unexpectedWriteCheck: 'pass',
    },
    evidenceRefs: [
      "soda-source-ref:55599cac1d6cd3f0e4510f26917d406c",
      'src/validation/currentN4ProductionAdapterInventory.ts',
      'src/decision/accountDecisionService.ts',
      'src/decision/accountDecisionFingerprintBoundary.test.ts',
      'src/pages/AgentDevelopmentWorkbenchPage.test.tsx',
      'src/performance/n4RealAccountLifecycle.test.ts',
      'src/accounts/n4RealAccountRecovery.test.ts',
      "soda-source-ref:50347eb92e044be6e2b1c9f0bc56054b",
    ],
    primaryGap:
      '当前备份33代理人/452盘/11方案的隔离回放完成首次Query与5次热刷新，旧句柄均拒绝且当前句柄可用；隔离恢复完整分区守恒及故障事务原子回退通过。比较证据政策变化后的旧快照禁存与重新匹配可存已有隔离页面回归；有限样本耗时不外推长期P95或真实生产故障恢复。',
  }),
] as const satisfies readonly FrontendCapabilityDataValidationRow[])

export function isFrontendCapabilityFullyValidated(row: FrontendCapabilityDataValidationRow) {
  return Object.values(row.evidence).every(
    (status) => status === 'pass' || status === 'not_applicable',
  )
}

export function summarizeFrontendCapabilityValidation(
  rows: readonly FrontendCapabilityDataValidationRow[],
) {
  const fullyValidated = rows.filter(isFrontendCapabilityFullyValidated).length
  const boundedReady = rows.filter((row) => row.candidateReview === 'bounded_ready').length
  const evidencePending = rows.filter((row) => row.candidateReview === 'evidence_pending').length
  const blocked = rows.filter((row) => row.candidateReview === 'blocked').length
  return {
    registered: rows.length,
    fullyValidated,
    boundedReady,
    evidencePending,
    blocked,
    status:
      blocked > 0
        ? ('release_blocked' as const)
        : rows.length > 0 && evidencePending === 0
          ? ('ready_for_product_review' as const)
          : ('evidence_open' as const),
  }
}

export const currentN4FrontendCapabilityDataValidation = Object.freeze({
  contract: currentN4FrontendCapabilityDataValidationContract,
  gameVersion: '3.1-phase-ii' as const,
  rows: currentN4FrontendCapabilityDataValidationRows,
  ...summarizeFrontendCapabilityValidation(currentN4FrontendCapabilityDataValidationRows),
  boundary:
    '这是玩家能力验收投影，不参与推荐、排序、求解、清理或账户写入；旧 10 项模型矩阵仅作对应能力的专项证据。',
})
