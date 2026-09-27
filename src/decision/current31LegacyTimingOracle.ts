export const current31LegacyTimingOracleContractId =
  'soda-current-3.1-legacy-timing-oracle/v1' as const

const sourceRevision = 'e248e9f149a6b889290579d8e673e132be9bde31' as const
const tickRatePerSecond = 60 as const

type LegacyTimingRow = {
  agentId: string
  sourceCharacterName: string
  sourceSkillTag: string
  sourceSkillName: string
  ticks: number
  seconds: number
  hitCount: number
  swapCancelTicks: number
}

function timing(
  agentId: string,
  sourceCharacterName: string,
  sourceSkillTag: string,
  sourceSkillName: string,
  ticks: number,
  hitCount: number,
  swapCancelTicks = 0,
): LegacyTimingRow {
  return Object.freeze({
    agentId,
    sourceCharacterName,
    sourceSkillTag,
    sourceSkillName,
    ticks,
    seconds: Number((ticks / tickRatePerSecond).toFixed(4)),
    hitCount,
    swapCancelTicks,
  })
}

const zhuYuanQingyiAstraRows = Object.freeze([
  timing('agent-astra', '耀嘉音', '1311_E_A', '特殊技形态A', 85, 1, 56),
  timing('agent-astra', '耀嘉音', '1311_E_EX_A', '强化E形态A', 35, 1),
  timing('agent-astra', '耀嘉音', '1311_QTE', '连携技', 113, 1, 113),
  timing('agent-astra', '耀嘉音', '1311_Q', '终结技', 116, 4, 116),
  timing('agent-qingyi', '青衣', '1251_E_EX_FC', '强化特殊技（满）', 110, 1),
  timing('agent-qingyi', '青衣', '1251_NA_3_FC', '第3段普攻（满）', 260, 64),
  timing('agent-qingyi', '青衣', '1251_SNA_1', '第1段特殊普攻', 20, 3),
  timing('agent-qingyi', '青衣', '1251_SNA_2', '第2段特殊普攻', 82, 5),
  timing('agent-qingyi', '青衣', '1251_QTE', '连携技', 120, 1, 120),
  timing('agent-zhu-yuan', '朱鸢', '1241_E_EX', '强化特殊技', 86, 7),
  timing('agent-zhu-yuan', '朱鸢', '1241_QTE', '连携技', 91, 9, 55),
  timing('agent-zhu-yuan', '朱鸢', '1241_SNA_1', '第1段特殊普攻', 35, 3),
  timing('agent-zhu-yuan', '朱鸢', '1241_SNA_2', '第2段特殊普攻', 28, 3),
  timing('agent-zhu-yuan', '朱鸢', '1241_SNA_3', '第3段特殊普攻', 22, 3),
  timing('agent-zhu-yuan', '朱鸢', '1241_RA_S', '侧冲刺攻击', 31, 3),
])

export const current31LegacyTimingOracle = Object.freeze({
  contract: current31LegacyTimingOracleContractId,
  source: Object.freeze({
    repository: 'ZSim-Dev/ZSim',
    revision: sourceRevision,
    license: 'GPL-3.0',
    tickRatePerSecond,
  }),
  executableProbe: Object.freeze({
    status: 'passed_with_matching_legacy_fixture' as const,
    fixtureCharacterNames: ['薇薇安', '柳', '耀嘉音'] as const,
    stopTick: 60,
    mainLoopSeconds: 0.31,
    environmentScope: 'temporary_project_isolated_venv' as const,
    currentPilotValidated: false,
    explanation:
      '探针只证明锁定 revision 的 CLI 与其现成旧队 APL 可执行；运行阵容不是当前 pilot，不能验证朱鸢·青衣·耀嘉音或 3.1 语义。',
  }),
  cases: Object.freeze({
    'reference-zhu-yuan-qingyi-astra': Object.freeze({
      exactTeamAplPresent: false,
      current31Validated: false,
      bangbooTimelinePresent: false,
      actionDurationComplete: false,
      referencePerformanceEligible: false,
      rows: zhuYuanQingyiAstraRows,
      excludedSourceRows: Object.freeze([
        Object.freeze({
          sourceSkillTag: '1241_Q',
          reason: 'locked source records zero ticks, so it cannot be used as an action duration',
        }),
      ]),
      boundary:
        '这些行只允许对来源化动作序列做旧版本时长差分和异常发现；缺精确三人 APL、3.1 交叉验证、完整资源/效果窗口与邦布事件时，禁止生成或抬升 Output Index。',
    }),
  }),
})
