import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'

export function evidence(
  patch: Partial<WarehouseAbsoluteRetentionEvidence> = {},
): WarehouseAbsoluteRetentionEvidence {
  return {
    disposition: 'observe',
    policyId: 'test-policy',
    policyCalibration: 'approved',
    sourceCoverage: 'complete',
    branchCount: 4,
    bestUseProfileId: 'p1',
    bestUseScore: 42,
    ownedUseAgentIds: ['agent-anby'],
    unownedUseAgentIds: [],
    leadingUses: [],
    reasonKind: 'quality_borderline',
    nextAction: {
      kind: 'review_quality',
      targetLevel: null,
      detail: '核对当前分数。',
      stopWhen: '确认保留线。',
    },
    blockedBy: [],
    witnessProfileIds: [],
    reviewedUseScope: '已支持构筑',
    ...patch,
  }
}

export function use(
  profileId: string,
  upper: number,
  current = 42,
): WarehouseAbsoluteRetentionEvidence['leadingUses'][number] {
  return {
    profileId,
    agentId: 'agent-anby',
    mainFit: 'valid',
    setFit: 'valid',
    twoPieceFit: 'valid',
    fourPieceFit: 'incompatible',
    currentScore: current,
    possibleFinalScore: { lower: current, upper },
    functionalMain: false,
    cutoffs: { cleanupBelow: 40, keepFrom: 60, premiumFrom: 85 },
    sourceIds: ['synthetic-source'],
    guidance: {
      mainStats: ['def_flat'],
      subStats: ['crit_rate', 'crit_dmg', 'def_percent'],
      matchedStats: ['crit_rate'],
      minorStats: [],
      unusedStats: ['hp_flat', 'anomaly_proficiency'],
      minimumLines: 2,
      minimumCoreLines: 1,
      twoPieceEffect: '防御力提升16%。',
      fourPieceEffect: '四件套需满足配装条件。',
      sources: [
        { label: 'BWIKI 构筑资料', url: 'https://wiki.biligame.com/zzz/本', sourceVersion: null },
      ],
    },
    investment: {
      policyId: 'synthetic-investment',
      qualified: false,
      meaningfulStats: [],
      coreStats: [],
      spentNodes: 2,
      remainingNodes: 3,
      nextLevel: 9,
      progressFloor: 50,
      potentialTarget: 60,
    },
  }
}
