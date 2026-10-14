import editorialDataset from '../gameDataPacks/data/reviewed-team-analysis.3.1.json'
import {
  current31StrengthGoldSet,
  resolveCurrent31StrengthGoldTeamCalibration,
} from './current31StrengthGoldSet'
import {
  reviewedTeamPublishedStrength,
  resolveReviewedTeamPublishedStrength,
} from './reviewedTeamPublishedStrength'

type ActivatedAgentConfig = {
  agentId: string
  requirementSource: string
  minimumDemonstratedLevel: number | null
  demonstrationEvidence: string | null
  evidenceRefs: readonly string[]
}

export const editorialRecords = editorialDataset.records.filter(
  (record) => !('withdrawn' in record && record.withdrawn),
)
export const editorialRecordsByTeamKey = new Map(
  editorialRecords.map((record) => [[...record.memberIds].sort().join('|'), record]),
)
export const nekomataPotentialSixKeys = new Set(
  [
    ['agent-nekomata', 'agent-norma', 'agent-sunna'],
    ['agent-nekomata', 'agent-norma', 'agent-astra'],
    ['agent-nekomata', 'agent-dialyn', 'agent-sunna'],
    ['agent-nekomata', 'agent-dialyn', 'agent-astra'],
  ].map((ids) => ids.sort().join('|')),
)
export const nekomataPotentialSixConditions = {
  potentialByAgentId: { 'agent-nekomata': 6 },
  evidenceRefs: [
    'https://www.miyoushe.com/zzz/article/76994144',
    'current31StrengthGoldSet:reviewedMetaSupplements:explicit-default-potential-6',
  ],
}

// Derive only membership and conditions provenance; no parallel band table.
const sourceMembers = [
  ...current31StrengthGoldSet.cases.map((record) => record.memberIds),
  ...current31StrengthGoldSet.versionedTeamStrengthSupplements.map((record) => record.memberIds),
  ...reviewedTeamPublishedStrength.facts
    .filter((fact) => !fact.withdrawn)
    .map((fact) => fact.memberIds),
]
export const nonEditorialTrainingTeams = [
  ...new Map(
    sourceMembers.map((memberIds) => {
      const gold = resolveCurrent31StrengthGoldTeamCalibration(memberIds)
      const published = resolveReviewedTeamPublishedStrength(memberIds, '3.1')
      const authority = gold ? ('strength_gold' as const) : ('single_publisher_tier' as const)
      const evidenceRefs = gold?.evidenceRefs ?? published.evidenceRefs
      const key = [...memberIds].sort().join('|')
      // Keep references to canonical adjudication/locator text, not another label copy.
      const sourceContext = gold
        ? {
            cases: gold.cases,
            supplement:
              current31StrengthGoldSet.versionedTeamStrengthSupplements.find(
                (record) => [...record.memberIds].sort().join('|') === key,
              ) ?? null,
          }
        : reviewedTeamPublishedStrength.facts.filter(
            (fact) => !fact.withdrawn && [...fact.memberIds].sort().join('|') === key,
          )
      return [key, { key, memberIds, authority, evidenceRefs, sourceContext }] as const
    }),
  ).values(),
]
export const nonEditorialTrainingTeamsByKey = new Map(
  nonEditorialTrainingTeams.map((row) => [row.key, row]),
)

/** Explicit review of activation subjects, not a keyword-derived numeric level. */
export const activatedEditorialConfigs: Record<string, readonly ActivatedAgentConfig[]> = {
  'reviewed-analysis-3.1-03': [
    {
      agentId: 'agent-rina',
      requirementSource: '采用潜能强化后的丽娜，增益覆盖零号安比主要追击。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-10': [
    {
      agentId: 'agent-grace',
      requirementSource: '按当前潜能强化版本使用格莉丝及柏妮思，管理异常交替与能量。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76913946'],
    },
    {
      agentId: 'agent-burnice',
      requirementSource: '按当前潜能强化版本使用格莉丝及柏妮思，管理异常交替与能量。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76913946'],
    },
  ],
  'reviewed-analysis-3.1-13': [
    {
      agentId: 'agent-jane',
      requirementSource: '采用当前简潜能，按支援顺序完成柚叶染色。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76957755'],
    },
  ],
  'reviewed-analysis-3.1-15': [
    {
      agentId: 'agent-rina',
      requirementSource: '采用潜能丽娜并核实席德先锋目标。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-16': [
    {
      agentId: 'agent-rina',
      requirementSource: '采用潜能丽娜，增益覆盖悠真失衡爆发。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-20': [
    {
      agentId: 'agent-nekomata',
      requirementSource: '解锁猫又潜能，正确衔接妮可支援及琉音失衡窗口。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76994144'],
    },
  ],
  'reviewed-analysis-3.1-21': [
    {
      agentId: 'agent-rina',
      requirementSource: '按当前潜能及支援顺序使用丽娜和艾莲。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
    {
      agentId: 'agent-ellen',
      requirementSource: '按当前潜能及支援顺序使用丽娜和艾莲。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-24': [
    {
      agentId: 'agent-grace',
      requirementSource: '格莉丝和丽娜采用当前潜能，控制脉冲消费及支援。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
    {
      agentId: 'agent-rina',
      requirementSource: '格莉丝和丽娜采用当前潜能，控制脉冲消费及支援。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-25': [
    {
      agentId: 'agent-rina',
      requirementSource: '采用当前潜能丽娜，青衣易伤与悠真爆发对齐。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: [
        'https://www.miyoushe.com/zzz/article/76913946',
        'https://www.miyoushe.com/zzz/article/76974843',
      ],
    },
  ],
  'reviewed-analysis-3.1-27': [
    {
      agentId: 'agent-lycaon',
      requirementSource: '若采用73045858的旧版培养条件，莱卡恩需达到该来源所述潜能激发状态。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: [
        'https://www.miyoushe.com/zzz/article/73045858',
        'https://www.miyoushe.com/zzz/article/76975934',
      ],
    },
  ],
  'reviewed-analysis-3.1-34': [
    {
      agentId: 'agent-soldier-0-anby',
      requirementSource: '零号·安比已达到来源所述潜能激发状态。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: [
        'https://www.miyoushe.com/zzz/article/69505810',
        'https://www.miyoushe.com/zzz/article/76975934',
      ],
    },
  ],
  'reviewed-analysis-3.1-38': [
    {
      agentId: 'agent-jane',
      requirementSource: '简已达到当前来源所述潜能激发状态；该条件与影画分开。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: [
        'https://www.miyoushe.com/zzz/article/76957755',
        'https://www.miyoushe.com/zzz/article/77017654',
      ],
    },
  ],
  'reviewed-analysis-3.1-47': [
    {
      agentId: 'agent-nekomata',
      requirementSource: '猫又与丽娜均达到当前来源所述潜能激发状态；这不是影画要求。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76994144'],
    },
    {
      agentId: 'agent-rina',
      requirementSource: '猫又与丽娜均达到当前来源所述潜能激发状态；这不是影画要求。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76974843'],
    },
  ],
  'reviewed-analysis-3.1-49': [
    {
      agentId: 'agent-jane',
      requirementSource: '简达到当前来源所述潜能激发状态；这不等同于影画门槛。',
      minimumDemonstratedLevel: null,
      demonstrationEvidence: null,
      evidenceRefs: ['https://www.miyoushe.com/zzz/article/76957755'],
    },
  ],
}
