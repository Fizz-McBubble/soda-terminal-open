export type L3BoxTeamSubstitution = {
  replacesAgentId: string
  alternativeAgentIds: readonly string[]
}

export {
  getL3TeamRecommendationPersonalizationInputs,
  getL3TeamRecommendationSeed,
  l3TeamRecommendationSeedProjectionIdentity,
  l3TeamRecommendationSeeds,
  listL3TeamRecommendationSeeds,
} from './l3TeamRecommendationSeedProjection'

export type L3BoxTeamTemplate = {
  templateId: string
  familyId: string
  label: string
  gameVersion: string
  coreAgentId: string
  members: readonly [
    { agentId: string; role: string },
    { agentId: string; role: string },
    { agentId: string; role: string },
  ]
  bangbooId: string | null
  substitutions: readonly L3BoxTeamSubstitution[]
  scenario: string | null
  formulaFamily: string | null
  strength: {
    status: 'candidate' | 'limited'
    boundary: string
  }
  source: {
    sourceIds: readonly string[]
    evidenceLocator: string
    sourceRevision: string
  }
}

/** The only adopted runtime source for source-constrained BOX templates. */
export const l3BoxTeamTemplateProjectionIdentity = {
  packageId: 'l3-40356c64ad0d6d5a5e01',
  manifestSha256: '58EBF42D1EFE23266FFDE5114738EBB4506239FC1F71B90E6E49E3B3565DDA02',
  partitions: {
    'teams-modes.ndjson': '207C6D5550F96D80A062B04F2F884488198A3F4AF8199E69AA7E79E4F6DA81A6',
    'team-recommendation-seeds.ndjson':
      '455E8B0F644FC99F095D63AA63E1A6413A0C6D93F9F1EDF6191549391E45D2CE',
    'candidate.ndjson': '56490981357608A2AA7E2543518078FCA056CA5BF668EA20DC5AD056F1C07F01',
    'gaps.ndjson': '85B6AC1DF81174226907A665FD437881C70B0949A05465AAEFB18AD95E54917B',
  },
} as const

/**
 * Generated from the adopted L3 `l3-40356c64ad0d6d5a5e01/teams-modes.ndjson`.
 * Runtime deliberately imports this closed projection instead of reading L1/L2/L3 files.
 */
export const l3BoxTeamTemplates: readonly L3BoxTeamTemplate[] = [
  {
    templateId: 'team-f4c1-billy-lucy-nicole',
    familyId: 'family-f4c1-billy-physical',
    label: '比利·露西·妮可候选阵容',
    gameVersion: '3.1',
    coreAgentId: 'agent-billy',
    members: [
      { agentId: 'agent-billy', role: '物理主输出' },
      { agentId: 'agent-lucy', role: '支援/队伍增益' },
      { agentId: 'agent-nicole', role: '以太支援/减防' },
    ],
    bangbooId: 'bangboo-amillion',
    substitutions: [],
    scenario: null,
    formulaFamily: 'direct_skill',
    strength: {
      status: 'limited',
      boundary: '有限判断（阵容结构有来源，场景或计算资料不足）。不参与模式、伤害或强度加分。',
    },
    source: {
      sourceIds: ['source-team-r8-billy'],
      evidenceLocator:
        'F4C1B1-P1 field-evidence-matrix#team-f4c1-billy-lucy-nicole; SOURCE_REGISTRY:source-team-r8-billy; L2 ENTITY_FACTS:agent-billy/calculation.formula_family',
      sourceRevision: 'r8-p1+f4c1a-2026-08-06',
    },
  },
  {
    templateId: 'team-f4c1-ellen-rina-soukaku',
    familyId: 'family-f4c1-ellen-ice',
    label: '艾莲·丽娜·苍角候选阵容',
    gameVersion: '3.1',
    coreAgentId: 'agent-ellen',
    members: [
      { agentId: 'agent-ellen', role: '冰强攻主输出' },
      { agentId: 'agent-rina', role: '穿透/感电持续机制' },
      { agentId: 'agent-soukaku', role: '冰支援/增益转移' },
    ],
    bangbooId: 'bangboo-sharkboo',
    substitutions: [],
    scenario: null,
    formulaFamily: null,
    strength: {
      status: 'limited',
      boundary: '有限判断（阵容结构有来源，场景或计算资料不足）。不参与模式、伤害或强度加分。',
    },
    source: {
      sourceIds: ['source-team-r8-ellen'],
      evidenceLocator:
        'F4C1B1-P1 field-evidence-matrix#team-f4c1-ellen-rina-soukaku; SOURCE_REGISTRY:source-team-r8-ellen; bahamut-zzz-74860-6498 reference_only_version_missing',
      sourceRevision: 'r8-p1+f4c1a-2026-08-06',
    },
  },
  {
    templateId: 'team-f4c1-jane-seth-lucy',
    familyId: 'family-f4c1-jane-anomaly',
    label: '简·赛斯·露西候选阵容',
    gameVersion: '3.1',
    coreAgentId: 'agent-jane',
    members: [
      { agentId: 'agent-jane', role: '物理异常站场' },
      { agentId: 'agent-seth', role: '防护' },
      { agentId: 'agent-lucy', role: '支援/队伍增益' },
    ],
    bangbooId: 'bangboo-officer-cui',
    substitutions: [],
    scenario: null,
    formulaFamily: null,
    strength: {
      status: 'limited',
      boundary: '有限判断（阵容结构有来源，场景或计算资料不足）。不参与模式、伤害或强度加分。',
    },
    source: {
      sourceIds: ['source-team-r8-jane'],
      evidenceLocator:
        'F4C1B1-P1 field-evidence-matrix#team-f4c1-jane-seth-lucy; SOURCE_REGISTRY:source-team-r8-jane; L2 ENTITY_FACTS:agent-seth/identity.specialty',
      sourceRevision: 'r8-p1+f4c1a-2026-08-06',
    },
  },
  {
    templateId: 'team-r8-billy',
    familyId: 'direct-stun-window',
    label: '比利失衡爆发',
    gameVersion: '3.1',
    coreAgentId: 'agent-billy',
    members: [
      { agentId: 'agent-billy', role: '物理主输出' },
      { agentId: 'agent-qingyi', role: '击破/失衡易伤' },
      { agentId: 'agent-nicole', role: '以太支援/减防' },
    ],
    bangbooId: 'bangboo-amillion',
    substitutions: [],
    scenario: 'released-only coverage witness',
    formulaFamily: 'direct-stun-window',
    strength: {
      status: 'candidate',
      boundary: '来源化候选模板，不代表玩家命中、伤害、DPS、正式最优或 Formal 结论。',
    },
    source: {
      sourceIds: ['source-team-r8-billy'],
      evidenceLocator: 'https://wiki.biligame.com/zzz/%E6%AF%94%E5%88%A9%E5%A5%87%E5%BE%B7',
      sourceRevision: 'r8-p1',
    },
  },
  {
    templateId: 'team-r8-ellen',
    familyId: 'direct-stun-window',
    label: '艾莲冰失衡',
    gameVersion: '3.1',
    coreAgentId: 'agent-ellen',
    members: [
      { agentId: 'agent-ellen', role: '冰强攻主输出' },
      { agentId: 'agent-lycaon', role: '冰击破/减抗' },
      { agentId: 'agent-soukaku', role: '冰支援/增益转移' },
    ],
    bangbooId: 'bangboo-sharkboo',
    substitutions: [],
    scenario: 'released-only coverage witness',
    formulaFamily: 'direct-stun-window',
    strength: {
      status: 'candidate',
      boundary: '来源化候选模板，不代表玩家命中、伤害、DPS、正式最优或 Formal 结论。',
    },
    source: {
      sourceIds: ['source-team-r8-ellen'],
      evidenceLocator: 'https://wiki.biligame.com/zzz/%E8%89%BE%E8%8E%B2',
      sourceRevision: 'r8-p1',
    },
  },
  {
    templateId: 'team-r8-jane',
    familyId: 'anomaly-disorder',
    label: '简紊乱持续',
    gameVersion: '3.1',
    coreAgentId: 'agent-jane',
    members: [
      { agentId: 'agent-jane', role: '物理异常站场' },
      { agentId: 'agent-burnice', role: '后台火异常积蓄' },
      { agentId: 'agent-lucy', role: '支援/队伍增益' },
    ],
    bangbooId: 'bangboo-red-moccus',
    substitutions: [],
    scenario: 'released-only coverage witness',
    formulaFamily: 'anomaly-disorder',
    strength: {
      status: 'candidate',
      boundary: '来源化候选模板，不代表玩家命中、伤害、DPS、正式最优或 Formal 结论。',
    },
    source: {
      sourceIds: ['source-team-r8-jane'],
      evidenceLocator: 'https://wiki.biligame.com/zzz/%E7%AE%80%C2%B7%E6%9D%9C',
      sourceRevision: 'r8-p1',
    },
  },
  {
    templateId: 'team-f3-evelyn-astra-nicole',
    familyId: 'family-f3-evelyn-double-support',
    label: '伊芙琳·耀嘉音·妮可双支援候选阵容',
    gameVersion: '3.1',
    coreAgentId: 'agent-evelyn',
    members: [
      { agentId: 'agent-evelyn', role: '核心代理人' },
      { agentId: 'agent-astra', role: '支援' },
      { agentId: 'agent-nicole', role: '减防/聚怪支援' },
    ],
    bangbooId: null,
    substitutions: [
      { replacesAgentId: 'agent-nicole', alternativeAgentIds: ['agent-lucy'] },
      { replacesAgentId: 'agent-astra', alternativeAgentIds: ['agent-lucy'] },
    ],
    scenario: 'double_support|long_axis_combat',
    formulaFamily: null,
    strength: {
      status: 'limited',
      boundary:
        '有限判断：来源说明妮可提供减防与聚怪、双支援长轴表现良好；“妮可或耀嘉音→露西”是两个方向替代，不表示同时替换、唯一最优或当前共识。无来源邦布约束。',
    },
    source: {
      sourceIds: ['miyoushe-1.5-post-61946271-author-79695828'],
      evidenceLocator:
        '{"applicability":"latest_known_limited_for_3_1","image_sha256":"B00F787D56481CCE17523EA5FCE7FDD3F319F5CEB018FF0B3CE59BD14D098830","job_id":"80461488894869504","request_sha256":"47a89d6d438181ab50f1ec890398a02ef5042a288693baa658fc863553498b73","result_sha256":"FDE522F2F409298BA44D2A9B8C0450E32274A6E506ACA30CEE8CAEE95D9DC4BD","roi_sha256":"B00F787D56481CCE17523EA5FCE7FDD3F319F5CEB018FF0B3CE59BD14D098830","source_locator":"post:61946271:image:7:roi:0,200,1330,690","stable_job_key":"0582452b7bce30dc1d31f2a77edccb035741c6515343a72e3ff0037eeb7beefb","visual_review":"pass: image visibly names Evelyn, Astra Yao, Nicole; fallback Nicole or Astra Yao -> Lucy is visible."}',
      sourceRevision:
        'source-1.5-target-3.1:FDE522F2F409298BA44D2A9B8C0450E32274A6E506ACA30CEE8CAEE95D9DC4BD',
    },
  },
]

export function getL3BoxTeamTemplate(templateId: string) {
  return l3BoxTeamTemplates.find((template) => template.templateId === templateId) ?? null
}
