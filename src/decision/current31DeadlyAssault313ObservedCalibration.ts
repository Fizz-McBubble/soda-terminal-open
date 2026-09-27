export const current31DeadlyAssault313ObservedCalibrationContractId =
  'soda-current-3.1.3-deadly-assault-observed-calibration/v1' as const

export type Current31DeadlyAssaultBoss = 'boss-1' | 'boss-2' | 'boss-3'

export type Current31DeadlyAssaultObservedTeam = {
  observationId: string
  stage: Current31DeadlyAssaultBoss
  split: 'cross_mode_holdout'
  rank: number
  appearanceRatePercent: number
  averageScore: number
  memberIds: readonly [string, string, string]
}

function observation(
  stage: Current31DeadlyAssaultBoss,
  rank: number,
  appearanceRatePercent: number,
  averageScore: number,
  memberIds: readonly [string, string, string],
  suffix = '',
): Current31DeadlyAssaultObservedTeam {
  return {
    observationId: `3.1.3-da-${stage}-r${rank}${suffix}`,
    stage,
    split: 'cross_mode_holdout',
    rank,
    appearanceRatePercent,
    averageScore,
    memberIds,
  }
}

const observedTeams = [
  observation('boss-1', 1, 28.55, 32394, ['agent-miyabi', 'agent-nangong', 'agent-yuzuha']),
  observation('boss-1', 2, 6.17, 22692, ['agent-miyabi', 'agent-vivian', 'agent-yuzuha']),
  observation('boss-1', 3, 5.68, 28053, ['agent-yixuan', 'agent-dialyn', 'agent-lucia']),
  observation('boss-1', 4, 4.02, 25900, ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia']),
  observation('boss-1', 5, 2.65, 35699, ['agent-sigrid', 'agent-norma', 'agent-astra']),
  observation('boss-1', 6, 1.72, 30505, ['agent-pyrois', 'agent-norma', 'agent-astra']),
  observation('boss-1', 7, 1.45, 27833, ['agent-miyabi', 'agent-nangong', 'agent-astra']),
  observation('boss-1', 8, 1.43, 23062, ['agent-miyabi', 'agent-yanagi', 'agent-yuzuha']),
  observation('boss-1', 9, 1.21, 30376, ['agent-miyabi', 'agent-yuzuha', 'agent-soukaku']),
  observation('boss-1', 10, 1.16, 31635, ['agent-sigrid', 'agent-dialyn', 'agent-astra']),
  observation('boss-2', 1, 17.37, 34100, ['agent-remielle', 'agent-jane', 'agent-velina']),
  observation('boss-2', 2, 11.04, 41080, ['agent-remielle', 'agent-aria', 'agent-velina']),
  observation('boss-2', 3, 8.05, 38811, ['agent-remielle', 'agent-promeia', 'agent-velina']),
  observation('boss-2', 4, 6.14, 40349, ['agent-remielle', 'agent-burnice', 'agent-velina']),
  observation('boss-2', 5, 3.69, 39030, ['agent-remielle', 'agent-alice', 'agent-velina']),
  observation('boss-2', 6, 1.58, 25735, ['agent-remielle', 'agent-jane', 'agent-vivian']),
  observation('boss-2', 7, 0.96, 24571, ['agent-remielle', 'agent-jane', 'agent-burnice']),
  observation('boss-2', 8, 0.85, 34456, ['agent-remielle', 'agent-piper', 'agent-velina']),
  observation('boss-2', 9, 0.77, 29539, ['agent-remielle', 'agent-alice', 'agent-jane'], 'a'),
  observation('boss-2', 9, 0.77, 32065, ['agent-remielle', 'agent-alice', 'agent-vivian'], 'b'),
  observation('boss-3', 1, 31.46, 28376, ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao']),
  observation('boss-3', 2, 24.64, 32084, ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna']),
  observation('boss-3', 3, 17.74, 27175, ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao']),
  observation('boss-3', 4, 3.06, 24287, ['agent-ye-shunguang', 'agent-astra', 'agent-zhao']),
  observation('boss-3', 5, 0.96, 25781, ['agent-nekomata', 'agent-dialyn', 'agent-sunna']),
  observation('boss-3', 6, 0.84, 20924, ['agent-starlight-billy', 'agent-dialyn', 'agent-lucia']),
  observation('boss-3', 7, 0.76, 22215, ['agent-nekomata', 'agent-dialyn', 'agent-astra'], 'a'),
  observation('boss-3', 7, 0.76, 25133, ['agent-ye-shunguang', 'agent-dialyn', 'agent-astra'], 'b'),
  observation('boss-3', 9, 0.58, 22941, ['agent-ye-shunguang', 'agent-trigger', 'agent-zhao']),
  observation('boss-3', 10, 0.53, 20653, [
    'agent-soldier-0-anby',
    'agent-orphie-magus',
    'agent-trigger',
  ]),
] as const satisfies readonly Current31DeadlyAssaultObservedTeam[]

export const current31DeadlyAssault313ObservedCalibration = Object.freeze({
  contract: current31DeadlyAssault313ObservedCalibrationContractId,
  gameVersion: '3.1.3',
  observedAt: '2026-08-29',
  source: {
    sourceId: 'prydwen-deadly-assault-3.1.3-2026-08-29',
    url: 'https://www.prydwen.gg/zenless/deadly-assault',
    reportedPlayerCount: 13_609,
    configuration: 'M0 S-rank agents and all W-Engines',
    stages: {
      'boss-1': 'Dead End Butcher',
      'boss-2': 'Girtablullu',
      'boss-3': 'Primordial Nightmare: The Creator',
    },
    rankMeaning: 'page rank within the selected boss and configuration',
    scoreMeaning: 'average in-game score reported by the source',
    upstreamPools: ['Prydwen', 'StarDB', 'HoyoBuddy', 'Interknot', 'Random'],
  },
  observations: observedTeams,
  crossModeHoldout: observedTeams,
  sourceIndependentHoldoutCount: 0,
  boundary:
    '该数据与 Shiyu 是不同玩法、敌人与样本池，可作为跨玩法失败诊断和 holdout。但页面方法和展示仍来自同一站点，不得冒充 source-independent holdout；页面排名不进入公式、不代表跨 Boss 全序或账号培养优先级。',
})
