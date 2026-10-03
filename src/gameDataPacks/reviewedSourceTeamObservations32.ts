import { stableContentHash } from './types'

/** Original author comparison setups support exact membership discovery only. */
export const reviewedSourceTeamObservations32 = [
  {
    id: 'prydwen-claret32-author-comparison-setup',
    memberIds: ['agent-claret', 'agent-norma', 'agent-rina'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    sourceVersion: '3.2',
    sourceUpdatedAt: '2026-09-30',
    checkedAt: '2026-10-01',
    observationRole: 'author_comparison_setup',
    locator: 'Full Team calculations; rendered lines 506–511; W-Engine comparison teammates',
    conditions: [
      '作者音擎比较场景：克拉蕾 + 诺姆 + 丽娜；诺姆装备 Chief Sidekick，丽娜装备 Weeping Cradle。',
      '仅支持精确三人成员观察；不证明推荐、强度档位、邦布默认、Formal 伤害或完整固定轴。',
    ],
    equipmentConditions: [
      { agentId: 'agent-norma', sourceEquipmentName: 'Chief Sidekick' },
      { agentId: 'agent-rina', sourceEquipmentName: 'Weeping Cradle' },
    ],
    scenario: 'author_full_team_wengine_comparison',
  },
  {
    id: 'prydwen-roxy32-author-comparison-setup',
    memberIds: ['agent-roxy', 'agent-claret', 'agent-rina'],
    sourceUrl: 'https://www.prydwen.gg/zenless/characters/roxy',
    sourceVersion: '3.2',
    sourceUpdatedAt: '2026-09-30',
    checkedAt: '2026-10-01',
    observationRole: 'author_comparison_setup',
    locator: 'Full Team calculations; rendered lines 415–420; W-Engine comparison teammates',
    conditions: [
      '作者音擎比较场景：洛克茜 + 克拉蕾 + 丽娜；克拉蕾装备 Crimson Thirst，丽娜装备 Weeping Cradle。',
      '仅支持精确三人成员观察；不证明推荐、强度档位、邦布默认、Formal 伤害或完整固定轴。',
    ],
    equipmentConditions: [
      { agentId: 'agent-claret', sourceEquipmentName: 'Crimson Thirst' },
      { agentId: 'agent-rina', sourceEquipmentName: 'Weeping Cradle' },
    ],
    scenario: 'author_full_team_wengine_comparison',
  },
] as const

/** Lightweight identity for result fingerprints; neither hash claims original HTML bytes. */
export const reviewedSourceTeamObservations32Identity = Object.freeze({
  id: 'reviewed-source-team-observations-3.2-v1',
  sourceVersion: '3.2',
  contentHash: stableContentHash(reviewedSourceTeamObservations32),
  retainedExtractionSha256: 'ef69572bf7f6d60750ddea6769025a461dcf863eea60fe4b5ce9464b7ed3b5b6',
  evidenceId: 'reviewed-source-team-original-facts-3.2-v1',
  hashDefinition:
    'Semantic observations and retained minimal fact extraction; not raw HTML hashes.',
})
