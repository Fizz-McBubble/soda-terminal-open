export const current31ReferencePerformanceSourceAuditContractId =
  'soda-current-3.1-reference-performance-source-audit/v1' as const

export type ReferencePerformanceSourceAuditRow = {
  sourceId: string
  sourceClass: 'published_character_calculation' | 'observed_mode_statistics' | 'simulator'
  revision: string
  fixedTeammatesDisclosed: boolean
  exactThreeAgentsIdentified: boolean
  bangbooVariantIdentified: boolean
  commonCrossTeamBaseline: boolean
  completeTeamOutput: boolean
  actionDurationAvailable: boolean
  teamSpecificUncertaintyAvailable: boolean
  current31PilotCoverage: boolean
  acceptedUse: readonly string[]
  rejectedUse: readonly string[]
  referencePerformanceEligible: false
  explanation: string
}

const rows = [
  {
    sourceId: 'prydwen-ye-shunguang-team-buffed-calculations',
    sourceClass: 'published_character_calculation',
    revision: '2026-08-19',
    fixedTeammatesDisclosed: true,
    exactThreeAgentsIdentified: true,
    bangbooVariantIdentified: false,
    commonCrossTeamBaseline: false,
    completeTeamOutput: false,
    actionDurationAvailable: false,
    teamSpecificUncertaintyAvailable: false,
    current31PilotCoverage: false,
    acceptedUse: ['W-Engine policy calibration', 'teammate buff-assumption inspection'],
    rejectedUse: ['cross-team Reference Performance', 'Team Strength ranking'],
    referencePerformanceEligible: false,
    explanation:
      '页面披露 Dialyn + Zhao 固定队友，并比较叶瞬光不同音擎的相对表现；百分比基线是同一角色的音擎方案，不是整队跨阵容统一输出，且没有邦布和动作时长。',
  },
  {
    sourceId: 'prydwen-yixuan-team-buffed-calculations',
    sourceClass: 'published_character_calculation',
    revision: '2026-08-19',
    fixedTeammatesDisclosed: true,
    exactThreeAgentsIdentified: true,
    bangbooVariantIdentified: false,
    commonCrossTeamBaseline: false,
    completeTeamOutput: false,
    actionDurationAvailable: false,
    teamSpecificUncertaintyAvailable: false,
    current31PilotCoverage: false,
    acceptedUse: ['W-Engine policy calibration', 'teammate buff-assumption inspection'],
    rejectedUse: ['cross-team Reference Performance', 'Team Strength ranking'],
    referencePerformanceEligible: false,
    explanation:
      '页面披露 Ju Fufu + Lucia 固定队友，并比较仪玄不同音擎；角色内百分比不能与叶瞬光等其他角色页面横向拼接，且不含邦布、整队输出或统一 Rotation 时长。',
  },
  {
    sourceId: 'prydwen-shiyu-da-3.1.3-observed-statistics',
    sourceClass: 'observed_mode_statistics',
    revision: '2026-08-29',
    fixedTeammatesDisclosed: true,
    exactThreeAgentsIdentified: true,
    bangbooVariantIdentified: false,
    commonCrossTeamBaseline: false,
    completeTeamOutput: true,
    actionDurationAvailable: false,
    teamSpecificUncertaintyAvailable: false,
    current31PilotCoverage: false,
    acceptedUse: ['contextual reality calibration', 'model violation diagnosis'],
    rejectedUse: ['Reference Performance', 'direct Team Strength input'],
    referencePerformanceEligible: false,
    explanation:
      '观测分数混合玩家操作、构筑、敌人和关卡条件；只展示各场景 Top 10，缺邦布、队伍级样本量和方差，不能代表受控同 baseline 性能。',
  },
  {
    sourceId: 'ZSim-Dev/ZSim',
    sourceClass: 'simulator',
    revision: 'e248e9f149a6b889290579d8e673e132be9bde31',
    fixedTeammatesDisclosed: true,
    exactThreeAgentsIdentified: true,
    bangbooVariantIdentified: false,
    commonCrossTeamBaseline: true,
    completeTeamOutput: true,
    actionDurationAvailable: true,
    teamSpecificUncertaintyAvailable: false,
    current31PilotCoverage: false,
    acceptedUse: [
      'legacy timing differential',
      'simulation architecture reference',
      'Zhu Yuan-Qingyi-Astra member implementation differential',
    ],
    rejectedUse: ['current 3.1 Reference Performance runtime', 'current 3.1 Team Strength'],
    referencePerformanceEligible: false,
    explanation:
      '模拟器具备 60 tick/s 时间线和整队输出框架；锁定 revision 有 18 个专属角色实现、8 份队伍 APL，朱鸢·青衣·耀嘉音是唯一三人均有专属实现的当前 pilot，但仍没有该精确三人 APL、3.1 交叉验证或邦布事件，不能直接生成当前版本可比输出。',
  },
] as const satisfies readonly ReferencePerformanceSourceAuditRow[]

export const current31ReferencePerformanceSourceAudit = Object.freeze({
  contract: current31ReferencePerformanceSourceAuditContractId,
  gameVersion: '3.1',
  rows,
  auditedSourceCount: rows.length,
  eligibleSourceCount: rows.filter((row) => row.referencePerformanceEligible).length,
  boundary:
    '三人参考表现要求精确成员、统一 baseline、完整三人输出和可复核轮转；邦布不作为三人评级门。角色内音擎百分比、未经控制的实战榜单或旧版本模拟不能直接升级为当前整队强度。',
})
