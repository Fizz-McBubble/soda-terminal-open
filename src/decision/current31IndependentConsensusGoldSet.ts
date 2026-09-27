export const current31IndependentConsensusGoldSetContractId =
  'soda-current-3.1-independent-consensus-gold-set/v1' as const

type ConsensusEvidenceKind = 'current_team_analytics' | 'current_team_guidance'

function consensus(
  caseId: string,
  memberIds: readonly [string, string, string],
  icyVeinsSlug: string,
  prydwenSlug: string,
  prydwenEvidenceKind: ConsensusEvidenceKind = 'current_team_analytics',
) {
  return {
    observationId: `consensus-${caseId}`,
    stage: `consensus-${caseId}`,
    split: 'source_independent_holdout' as const,
    rank: 1,
    memberIds,
    labelScope: 'mainstream_recognition' as const,
    evidenceRefs: [
      {
        publisher: 'Icy Veins' as const,
        url: `https://www.icy-veins.com/zenless-zone-zero/${icyVeinsSlug}-teams`,
        locator: 'Version 3.1 Best Teams / recommended team composition.',
      },
      {
        publisher: 'Prydwen' as const,
        url: `https://www.prydwen.gg/zenless/characters/${prydwenSlug}`,
        locator:
          prydwenEvidenceKind === 'current_team_analytics'
            ? 'Patch 3.1 current Shiyu Defense or Deadly Assault team analytics.'
            : 'Patch 3.1 current Teams & Synergy guidance.',
      },
    ],
    calibrationEvidenceRefs: [
      {
        publisher: 'Prydwen' as const,
        url: `https://www.prydwen.gg/zenless/characters/${prydwenSlug}`,
        locator:
          prydwenEvidenceKind === 'current_team_analytics'
            ? 'Patch 3.1 current Shiyu Defense or Deadly Assault team analytics.'
            : 'Patch 3.1 current Teams & Synergy guidance.',
      },
    ],
    validationEvidenceRefs: [
      {
        publisher: 'Icy Veins' as const,
        url: `https://www.icy-veins.com/zenless-zone-zero/${icyVeinsSlug}-teams`,
        locator: 'Version 3.1 Best Teams / recommended team composition.',
      },
    ],
  }
}

const observations = [
  consensus(
    'yixuan-dialyn-lucia',
    ['agent-yixuan', 'agent-dialyn', 'agent-lucia'],
    'yixuan',
    'yixuan',
  ),
  consensus(
    'yixuan-ju-fufu-lucia',
    ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    'yixuan',
    'yixuan',
  ),
  consensus(
    'yixuan-lucia-astra',
    ['agent-yixuan', 'agent-lucia', 'agent-astra'],
    'yixuan',
    'yixuan',
  ),
  consensus(
    'yixuan-pulchra-lucia',
    ['agent-yixuan', 'agent-pulchra', 'agent-lucia'],
    'yixuan',
    'yixuan',
  ),
  consensus(
    'ye-dialyn-sunna',
    ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus(
    'ye-dialyn-zhao',
    ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus(
    'ye-sunna-zhao',
    ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus(
    'ye-astra-zhao',
    ['agent-ye-shunguang', 'agent-astra', 'agent-zhao'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus(
    'ye-trigger-zhao',
    ['agent-ye-shunguang', 'agent-trigger', 'agent-zhao'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus(
    'ye-seed-zhao',
    ['agent-ye-shunguang', 'agent-seed', 'agent-zhao'],
    'ye-shunguang',
    'ye-shunguang',
  ),
  consensus('aria-nangong-sunna', ['agent-aria', 'agent-nangong', 'agent-sunna'], 'aria', 'aria'),
  consensus('aria-nangong-yuzuha', ['agent-aria', 'agent-nangong', 'agent-yuzuha'], 'aria', 'aria'),
  consensus('aria-sunna-yuzuha', ['agent-aria', 'agent-sunna', 'agent-yuzuha'], 'aria', 'aria'),
  consensus(
    'aria-remielle-velina',
    ['agent-aria', 'agent-remielle', 'agent-velina'],
    'aria',
    'aria',
  ),
  consensus(
    'remielle-promeia-velina',
    ['agent-remielle', 'agent-promeia', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'promeia-velina-yuzuha',
    ['agent-promeia', 'agent-velina', 'agent-yuzuha'],
    'velina',
    'velina',
    'current_team_guidance',
  ),
  consensus(
    'remielle-jane-velina',
    ['agent-remielle', 'agent-jane', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'jane-velina-yuzuha',
    ['agent-jane', 'agent-velina', 'agent-yuzuha'],
    'velina',
    'velina',
    'current_team_guidance',
  ),
  consensus(
    'remielle-alice-velina',
    ['agent-remielle', 'agent-alice', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'alice-velina-yuzuha',
    ['agent-alice', 'agent-velina', 'agent-yuzuha'],
    'velina',
    'velina',
  ),
  consensus(
    'remielle-piper-velina',
    ['agent-remielle', 'agent-piper', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'piper-velina-yuzuha',
    ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    'velina',
    'velina',
    'current_team_guidance',
  ),
  consensus(
    'remielle-vivian-velina',
    ['agent-remielle', 'agent-vivian', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'remielle-burnice-velina',
    ['agent-remielle', 'agent-burnice', 'agent-velina'],
    'velina',
    'velina',
  ),
  consensus(
    'sigrid-norma-sunna',
    ['agent-sigrid', 'agent-norma', 'agent-sunna'],
    'sigrid',
    'sigrid',
  ),
  consensus(
    'sigrid-norma-astra',
    ['agent-sigrid', 'agent-norma', 'agent-astra'],
    'sigrid',
    'sigrid',
  ),
  consensus(
    'miyabi-nangong-yuzuha',
    ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
    'hoshimi-miyabi',
    'miyabi',
  ),
  consensus(
    'miyabi-vivian-yuzuha',
    ['agent-miyabi', 'agent-vivian', 'agent-yuzuha'],
    'hoshimi-miyabi',
    'miyabi',
  ),
  consensus(
    'miyabi-burnice-yuzuha',
    ['agent-miyabi', 'agent-burnice', 'agent-yuzuha'],
    'hoshimi-miyabi',
    'miyabi',
  ),
  consensus(
    'miyabi-yanagi-astra',
    ['agent-miyabi', 'agent-yanagi', 'agent-astra'],
    'hoshimi-miyabi',
    'miyabi',
  ),
] as const

export const current31IndependentConsensusGoldSet = Object.freeze({
  contract: current31IndependentConsensusGoldSetContractId,
  gameVersion: '3.1',
  labelScope: 'mainstream_recognition_only' as const,
  observations,
  sourceIndependentHoldoutCount: observations.length,
  sourceSplitCalibrationCount: observations.length,
  sourceSplitValidationCount: observations.length,
  bandLabelCount: 0,
  pairwiseLabelCount: 0,
  boundary:
    '每支队伍必须同时出现在 Icy Veins 3.1 推荐队伍与 Prydwen 3.1 当前队伍分析/指南中。运行时主流识别只读取 Prydwen calibrationEvidenceRefs，Icy Veins validationEvidenceRefs 保持独立验证；该 source split 不提供强度档位、全序或 Reference Performance。',
})
