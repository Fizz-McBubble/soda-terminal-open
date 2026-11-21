import type { AgentProfileField } from './agentProfileFieldProjection'
import type { TargetPanelMetricSemantic } from './targetPanelSemantics'

import { gameData32BuildSources } from './gameData32BuildSources'
// Reviewed numeric facts from the original Level 60 endgame sections. These
// guide references do not establish unconditional account deficit thresholds.
const referenceMetric: TargetPanelMetricSemantic = {
  requirement: 'required',
  boundary: 'minimum',
  observation: 'reference',
}
const secondaryMetric: TargetPanelMetricSemantic = {
  ...referenceMetric,
  requirement: 'optional',
}
const reviewedEndgamePanels32 = {
  'agent-claret': {
    sourceKey: 'claretGuide',
    evidenceTextSha256: '914674314ABCCF87D9E87A7ED844C1795AC7D0E1CA82E757D555057335E3D677',
    value: {
      def: { min: 2300, max: 2600, upperOpen: true },
      hp: { min: 9500 },
      targetSemantics: { def: referenceMetric, hp: secondaryMetric },
      displayVariants: ['暴击率 128.9%（专武参考）'],
      conditionalReferences: { signatureCritRate: 128.9, combatCritRateApproximate: 200 },
    },
    conditions: [
      '60级养成参考；防御力2300–2600+，生命值9500+。',
      '128.9%暴击率以「猩红渴望」为前提，不能套用于其他音擎；计入核心、音擎和队友加成后，局内暴击率尽量接近200%。',
      '生命值列为基础参考，不需要为达标专门堆生命词条。',
    ],
  },
  'agent-roxy': {
    sourceKey: 'roxyGuide',
    evidenceTextSha256: '346839BC1F97292F9438BD668A55736E3FD4A5B767872573E3CA5FC50DE9FD3E',
    value: {
      atk: { min: 2200, max: 2500, upperOpen: true },
      critRate: { min: 74.6, max: 100 },
      critDamage: { min: 70, max: 100, upperOpen: true },
      energyRegen: { min: 2.88 },
      hp: { min: 9500 },
      def: { min: 750 },
      targetSemantics: {
        atk: referenceMetric,
        critRate: referenceMetric,
        critDamage: referenceMetric,
        energyRegen: referenceMetric,
        hp: secondaryMetric,
        def: secondaryMetric,
      },
      conditionalReferences: { signatureCritRate: 76, dualEnergySetRegen: 3.12 },
    },
    conditions: [
      '60级养成参考；回能6号位方向，能量自动回复2.88+。',
      '暴击率74.6%–100%随音擎与配置变化；使用「绯月银棺」时，初始76%可在音擎加成后达到100%。',
      '满核心时回能转换的冲击加成在3.12达到上限；攻略以两个回能2件套达到该数值，常规4+2搭配不必强求。',
      '生命值9500+、防御力750+列为基础参考，不需要为此专门堆词条。',
    ],
  },
} as const

export function reviewedEndgamePanel32(agentId: string): AgentProfileField[] {
  const entry = reviewedEndgamePanels32[agentId as keyof typeof reviewedEndgamePanels32]
  if (!entry) return []
  const source = gameData32BuildSources[entry.sourceKey]!
  return [
    {
      group: 'build_guidance',
      path: 'build.target_panel',
      status: 'candidate',
      gameVersion: '3.2',
      originalSourceVersion: '3.2',
      lastChangeVersion: '3.2',
      currentApplicability: 'continuous',
      verifiedAt: '2026-10-11',
      conflict: null,
      value: {
        ...entry.value,
        sourceMetadata: {
          section: 'Best Endgame Stats (Level 60)',
          checkedAt: '2026-10-11',
          evidenceTextSha256: entry.evidenceTextSha256,
          hashScope:
            'Selected original numeric section text with normalized whitespace; not HTTP response bytes.',
        },
      },
      conditions: [...entry.conditions],
      sourceRefs: [
        {
          ...source,
          id: `${source.id}-endgame-20261011`,
          checkedAt: '2026-10-11',
          contentHash: entry.evidenceTextSha256,
          licenseBoundary:
            'Citation-only numeric facts; hash covers selected normalized source text, not HTTP bytes. No copied prose or media.',
        },
      ],
      reason: '复核原攻略60级数值参考并保留配置条件；不作为无条件差距阈值或Formal输入。',
    },
  ]
}
