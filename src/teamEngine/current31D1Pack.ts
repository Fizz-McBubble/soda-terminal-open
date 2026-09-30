import type { TeamEnginePack } from './contracts'
import { resolveSourceBoundAdditionalAbility } from '../gameDataPacks/reviewedSourceBoundAdditionalAbility'
import { buildCurrent31D1Kernels } from './current31D1Kernels'
import { current31TeamEngineVerticalSlice } from './current31VerticalSlice'
import { current31MetaStrengthR1 } from './currentMetaStrengthR1'
import {
  current31LegacyCoverageAgentRules,
  current31LegacyCoverageBangbooRules,
  current31LegacyCoverageKernels,
} from './current31LegacyCoverage'
import { compileCurrent31AgentRules } from './current31CompiledAgentRules'
import { d1AgentRules } from './current31D1AgentRules'
import {
  zhuYuanGuide,
  qingyiGuide,
  astraGuide,
  yixuanGuide,
  panGuide,
  luciaGuide,
  dialynGuide,
  yixuanLuciaDialynSeed,
  yixuanPanSeed,
  yeGuide,
  zhaoGuide,
  sunnaGuide,
  ariaGuide,
  yuzuhaGuide,
  promeiaGuide,
  nangongGuide,
  pyroisGuide,
  normaTeamGuide,
  ultraJakeGuide,
  sproutAdoption,
  biggestFanAdoption,
  knightbooPredicateAdoption,
  knightbooTeamAdoption,
  coverageDiscoverySeed,
  resolveReviewedBelionActivation,
  resolveReviewedBiggestFanActivation,
} from './current31D1EvidenceRefs'
export {
  resolveReviewedBelionActivation,
  resolveReviewedBiggestFanActivation,
} from './current31D1EvidenceRefs'

const [
  directStunKernel,
  ruptureDefenseKernel,
  ruptureVeilKernel,
  yeVeilKernel,
  ariaFrontlineAnomalyKernel,
  promeiaPolarityKernel,
  pyroisChainBurstKernel,
] = buildCurrent31D1Kernels({
  zhuYuanGuide,
  qingyiGuide,
  astraGuide,
  yixuanGuide,
  panGuide,
  luciaGuide,
  dialynGuide,
  yixuanLuciaDialynSeed,
  yixuanPanSeed,
  yeGuide,
  zhaoGuide,
  sunnaGuide,
  ariaGuide,
  yuzuhaGuide,
  promeiaGuide,
  nangongGuide,
  pyroisGuide,
  normaTeamGuide,
  ultraJakeGuide,
  sproutAdoption,
  biggestFanAdoption,
  knightbooPredicateAdoption,
  knightbooTeamAdoption,
  coverageDiscoverySeed,
})

const coverageOverrideAgentIds = new Set([
  'agent-aria',
  'agent-promeia',
  ...current31LegacyCoverageAgentRules.map((rule) => rule.agentId),
])

const inheritedAgentRules = [
  ...current31TeamEngineVerticalSlice.agentRules.filter(
    (rule) => !coverageOverrideAgentIds.has(rule.agentId),
  ),
  ...d1AgentRules,
  ...current31LegacyCoverageAgentRules,
]

export const current31TeamEngineD1Pack: TeamEnginePack = {
  ...current31TeamEngineVerticalSlice,
  agentRules: compileCurrent31AgentRules(inheritedAgentRules).map((rule) => {
    const predicate = resolveSourceBoundAdditionalAbility(rule.agentId, rule)
    if (!predicate || rule.additionalAbility.status !== 'modeled') return rule
    return {
      ...rule,
      additionalAbility: { ...rule.additionalAbility, predicate },
    }
  }),
  kernels: [
    ...current31TeamEngineVerticalSlice.kernels,
    directStunKernel,
    ruptureDefenseKernel,
    ruptureVeilKernel,
    yeVeilKernel,
    ariaFrontlineAnomalyKernel,
    promeiaPolarityKernel,
    pyroisChainBurstKernel,
    ...current31LegacyCoverageKernels,
  ],
  currentMetaStrength: current31MetaStrengthR1,
  bangbooRules: [
    ...current31TeamEngineVerticalSlice.bangbooRules,
    {
      bangbooId: 'bangboo-resonaboo',
      name: '共鸣布',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'attribute_count', attribute: 'ether', minimum: 2 },
        description: '额外能力要求至少两名以太代理人。',
        evidence: [zhuYuanGuide, astraGuide],
      },
      suitability: {
        status: 'unknown',
        description: '当前 corpus 没有朱鸢 family 与共鸣布的具名适配证据。',
        evidence: [],
      },
      provenance: [zhuYuanGuide, astraGuide],
      evidence: [zhuYuanGuide, astraGuide],
    },
    {
      bangbooId: 'bangboo-sprout',
      name: '芽芽',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'agent_present', agentId: 'agent-ye-shunguang' },
        description: '额外能力要求叶瞬光在队。',
        evidence: [sproutAdoption],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-ye-veil-attack'],
        scenarioTags: ['veil_attack'],
        description: '芽芽的叶瞬光在队机制与该帷幕强攻 family、场景效果承接一致。',
        validationEvidence: [sproutAdoption],
        evidence: [sproutAdoption],
      },
      provenance: [sproutAdoption],
      evidence: [sproutAdoption],
    },
    {
      bangbooId: 'bangboo-belion',
      name: '狮耶',
      releaseState: 'released',
      activation: resolveReviewedBelionActivation(),
      suitability: {
        status: 'unknown',
        description: '当前 corpus 没有仪玄 family 与狮耶的具名适配证据。',
        evidence: [],
      },
      provenance: [yixuanGuide, panGuide],
      evidence: [yixuanGuide, panGuide],
    },
    {
      bangbooId: 'bangboo-biggest-fan',
      name: '阿饭',
      releaseState: 'released',
      activation: resolveReviewedBiggestFanActivation(),
      suitability: {
        status: 'modeled',
        familyIds: ['family-aria-frontline-anomaly'],
        scenarioTags: ['angels_anomaly'],
        description: '阿饭的妄想天使激活机制与爱芮前台异常 family、场景效果承接一致。',
        validationEvidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
        evidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
      },
      provenance: [biggestFanAdoption, ariaGuide, sunnaGuide],
      evidence: [biggestFanAdoption, ariaGuide, sunnaGuide],
    },
    {
      bangbooId: 'bangboo-knightboo',
      name: '骑士布',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: { kind: 'specialty_count', specialty: 'support', minimum: 1 },
        description: '额外能力要求至少一名支援代理人。',
        evidence: [knightbooPredicateAdoption],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-promeia-polarity-anomaly'],
        scenarioTags: ['polarity_abloom'],
        description: '骑士布的支援成员激活机制与极性异放 family、场景效果承接一致。',
        validationEvidence: [knightbooTeamAdoption],
        evidence: [knightbooTeamAdoption],
      },
      provenance: [knightbooPredicateAdoption, knightbooTeamAdoption],
      evidence: [knightbooPredicateAdoption, knightbooTeamAdoption],
    },
    {
      bangbooId: 'bangboo-ultra-jake',
      name: '超极杰克',
      releaseState: 'released',
      activation: {
        status: 'modeled',
        predicate: {
          kind: 'faction_count',
          faction: '罗斯凯利法·外务筹策局',
          minimum: 1,
        },
        description: '额外能力要求至少一名罗斯凯利法·外务筹策局代理人。',
        evidence: [ultraJakeGuide],
      },
      suitability: {
        status: 'modeled',
        familyIds: ['family-pyrois-norma-chain-burst'],
        scenarioTags: ['chain_attack_burst'],
        description: '超极杰克的阵营激活机制与连携爆发 family、场景效果承接一致。',
        validationEvidence: [normaTeamGuide],
        evidence: [normaTeamGuide],
      },
      provenance: [ultraJakeGuide, normaTeamGuide],
      evidence: [ultraJakeGuide, normaTeamGuide],
    },
    ...current31LegacyCoverageBangbooRules,
  ],
}
