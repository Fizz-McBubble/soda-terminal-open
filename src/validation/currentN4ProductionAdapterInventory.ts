import { stableContentHash } from '../gameDataPacks/types'
import type { N4ValidationCapabilityId } from './currentN4CapabilityValidationMatrix'

export const currentN4ProductionAdapterInventoryContract =
  'soda-n4-production-adapter-rollback-inventory/v1' as const

export type N4ProductionAdapterState =
  | 'underlying_pack_switch_verified_output_replay_missing'
  | 'current_output_recovery_partial'
  | 'manifest_rollback_only'
  | 'code_bound_no_versioned_adapter'

type InventoryRow = {
  capabilityId: N4ValidationCapabilityId
  adapterState: N4ProductionAdapterState
  adapterId: string | null
  isolatedEvidenceRefs: readonly string[]
  playerAssetBoundary: 'not_in_transaction' | 'not_applicable'
  remainingProof: string
}

const gameBaseAdapterEvidence = [
  'src/gameDataPacks/repository.ts',
  'src/gameDataPacks/repository.test.ts',
  'src/gameDataPacks/runtimeSelection.test.ts',
  'src/application/localCalculationQueryClient.test.ts',
  'src/application/accountDecisionWorld.test.tsx',
  'src/validation/n4CurrentOutputRecovery.test.ts',
] as const

export const currentN4ProductionAdapterInventory = Object.freeze([
  {
    capabilityId: 'agent_skill_recommendation',
    adapterState: 'current_output_recovery_partial',
    adapterId: 'game-base',
    isolatedEvidenceRefs: [
      'src/calculation/skillInvestmentPolicy.ts',
      'src/pages/AgentDevelopmentWorkbenchPage.tsx',
      'src/application/accountDecisionWorld.tsx',
      'src/pages/AgentDevelopmentGuidanceRecovery.test.tsx',
    ],
    playerAssetBoundary: 'not_in_transaction',
    remainingProof:
      '比利与蕾米埃尔实际技能区域已通过当前应用整页失配阻断及恢复比对；技能规则仍绑定代码，保留3.0旧资料fallback，尚缺独立正确性与历史版本adapter验证。',
  },
  {
    capabilityId: 'w_engine_recommendation',
    adapterState: 'current_output_recovery_partial',
    adapterId: 'game-base',
    isolatedEvidenceRefs: gameBaseAdapterEvidence,
    playerAssetBoundary: 'not_in_transaction',
    remainingProof:
      '隔离样本的音擎方向已通过当前版本恢复前后比对；尚缺更多适用场景及独立正确性验证，不支持任意旧版本计算。',
  },
  {
    capabilityId: 'graduation_panel',
    adapterState: 'current_output_recovery_partial',
    adapterId: 'game-base',
    isolatedEvidenceRefs: [
      'src/gameDataPacks/agentProfile.ts',
      'src/pages/agentDevelopmentWorkbenchViewModel.ts',
      'src/pages/AgentDevelopmentWorkbenchPage.tsx',
      'src/application/accountDecisionWorld.tsx',
      'src/pages/AgentDevelopmentGuidanceRecovery.test.tsx',
    ],
    playerAssetBoundary: 'not_in_transaction',
    remainingProof:
      '实际显示的蕾米埃尔毕业目标已通过整页失配阻断及恢复比对；未显示的graduation sidecar不是本项消费证据，仍缺其他角色、独立目标正确性与历史版本adapter验证。',
  },
  {
    capabilityId: 'disc_build_recommendation',
    adapterState: 'current_output_recovery_partial',
    adapterId: 'game-base',
    isolatedEvidenceRefs: gameBaseAdapterEvidence,
    playerAssetBoundary: 'not_in_transaction',
    remainingProof:
      '隔离样本的三人4+2及4/5/6主词条约束已通过当前版本恢复比对；尚缺独立正确性与真实账户覆盖，不代表旧版本可执行。',
  },
  ...(
    [
      'single_agent_warehouse_ranking',
      'team_and_bangboo',
      'team_joint_disc_assignment',
      'portfolio_coordination',
      'value_benchmark',
      'warehouse_cleanup',
    ] as const satisfies readonly N4ValidationCapabilityId[]
  ).map(
    (capabilityId): InventoryRow => ({
      capabilityId,
      adapterState: 'current_output_recovery_partial',
      adapterId: 'game-base',
      isolatedEvidenceRefs: gameBaseAdapterEvidence,
      playerAssetBoundary: 'not_in_transaction',
      remainingProof:
        capabilityId === 'single_agent_warehouse_ranking'
          ? '公开输入的合法4+2隔离样本产生3个完整六盘候选，已比对当前版本恢复输出；不代表真实账户覆盖或旧版本adapter可执行。'
          : capabilityId === 'team_and_bangboo'
            ? '隔离样本的队伍与邦布身份已通过当前版本恢复前后比对；不证明完整配装或独立推荐正确性。'
            : capabilityId === 'warehouse_cleanup'
              ? '隔离样本的400条仓库动作已通过当前版本恢复前后比对；尚缺独立清理标签与误判率，不代表可安全删除。'
              : capabilityId === 'team_joint_disc_assignment'
                ? '隔离样本的3人18张唯一实体盘已通过当前版本恢复比对；尚缺真实共享仓库差距及独立正确性验证。'
                : capabilityId === 'portfolio_coordination'
                  ? '隔离样本的双队6人36张唯一实体盘已通过当前版本恢复比对；尚缺真实多队仓库差距及独立正确性验证。'
                  : '隔离样本的当前与候选Benchmark均可计算，恢复后结果一致；同配装基线仅证明持平，不证明提升或默认音擎条件支持。',
    }),
  ),
] as const satisfies readonly InventoryRow[])

export const currentN4VerifiedProductionAdapters = Object.freeze([
  {
    adapterId: 'game-base',
    verification: 'isolated_database_switch_and_rollback_pass' as const,
    preservesPlayerAssets: true,
    failureModes: [
      'invalid_content_hash_preserves_active_baseline',
      'missing_rollback_target_preserves_active_state',
      'unbound_or_expired_package_blocks_current_runtime',
      'compiled_artifact_restore_recomputes_account_decision',
    ],
    evidenceRefs: gameBaseAdapterEvidence,
  },
])

export const currentN4RemainingValidationAcquisitionList = Object.freeze([
  {
    workId: 'independent-claim-labels',
    capabilityIds: [
      'agent_skill_recommendation',
      'w_engine_recommendation',
      'graduation_panel',
      'disc_build_recommendation',
    ] as const,
    requiredInput:
      'source-disjoint caseId, game/build/scenario grain, independent label, adjudicator version, hidden holdout partition',
    acceptance:
      'labels are non-runtime-readable; Gold/Holdout keys are unique and measured independently of production guidance',
  },
  {
    workId: 'capability-output-replay',
    capabilityIds: currentN4ProductionAdapterInventory.map((row) => row.capabilityId),
    requiredInput:
      'baseline package id, candidate package id, pre/post/rollback input and output fingerprints, stale disposition',
    acceptance:
      'invalid candidates preserve baseline; approved switch changes only declared outputs; rollback restores exact baseline fingerprints',
  },
  {
    workId: 'representative-warehouse-adjudication',
    capabilityIds: [
      'single_agent_warehouse_ranking',
      'team_joint_disc_assignment',
      'portfolio_coordination',
      'warehouse_cleanup',
    ] as const,
    requiredInput:
      'pseudonymous frozen account/warehouse fingerprints, independent candidate pool, case manifest, disc-level human labels',
    acceptance:
      'report regret distribution, false-cleanup rate, retained-value recall, uncertainty, and exact denominators without player writes',
  },
])

export const currentN4ProductionAdapterInventoryFingerprint = stableContentHash({
  rows: currentN4ProductionAdapterInventory,
  adapters: currentN4VerifiedProductionAdapters,
  acquisition: currentN4RemainingValidationAcquisitionList,
})
