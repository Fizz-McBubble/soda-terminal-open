import reviewedPerformance from '../gameDataPacks/data/reviewed-team-performance.3.1.json'
import reviewedGuides from '../gameDataPacks/data/reviewed-team-guide-verification.3.1.json'
import { type Current31StrengthGoldCase, icy } from './current31StrengthGoldEvidence'
import { cases } from './current31StrengthGoldCases'

export { type Current31StrengthGoldCase } from './current31StrengthGoldEvidence'

export const current31StrengthGoldSetContractId = 'soda-current-3.1-strength-gold-set/v1' as const

function variantKey(memberIds: readonly string[], bangbooId: string) {
  return `${[...memberIds].sort().join('|')}::${bangbooId}`
}

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

/** Current evidence supplements the retained editorial judgement, never derives a band. */
export function current31ReviewedStrengthEvidence(memberIds: readonly string[]) {
  const key = formationKey(memberIds)
  const target = reviewedPerformance.targetTrios.find(
    (row) => formationKey(row.stableMemberIds) === key,
  )
  const guide = reviewedGuides.records.find((row) => formationKey(row.memberIds) === key)
  return [
    ...(guide?.status === 'exact_match' ? [guide.url] : []),
    ...reviewedPerformance.sources
      .filter((source) => source.observations.some((row) => row.targetTrioId === target?.id))
      .map((source) => source.url),
  ]
}

const duplicateKeys = cases
  .map((item) => variantKey(item.memberIds, item.bangbooId))
  .filter((key, index, all) => all.indexOf(key) !== index)

if (duplicateKeys.length)
  throw new Error(`3.1 Strength Gold Set 精确 Variant 重复：${duplicateKeys.join(',')}`)

const casesByFormationKey = new Map<string, Current31StrengthGoldCase[]>()

for (const item of cases) {
  const key = formationKey(item.memberIds)
  casesByFormationKey.set(key, [...(casesByFormationKey.get(key) ?? []), item])
}

const conflictingFormationBands = [...casesByFormationKey.entries()]
  .filter(([, items]) => new Set(items.map((item) => item.band)).size > 1)
  .map(([key]) => key)

if (conflictingFormationBands.length)
  throw new Error(`3.1 Strength Gold Set 三人强度档冲突：${conflictingFormationBands.join(',')}`)

// Editorial coarse tiers use exact-team guides and current observations together.
// Scores/popularity are not converted into tiers or treated as an independent second source.
const reviewedMetaTeams = [
  ['pyrois-norma-astra', ['agent-pyrois', 'agent-norma', 'agent-astra']],
  ['pyrois-norma-sunna', ['agent-pyrois', 'agent-norma', 'agent-sunna']],
  ['pyrois-dialyn-astra', ['agent-pyrois', 'agent-dialyn', 'agent-astra']],
  ['pyrois-dialyn-sunna', ['agent-pyrois', 'agent-dialyn', 'agent-sunna']],
  ['remielle-velina-grace', ['agent-remielle', 'agent-velina', 'agent-grace']],
  ['miyoushe-76994144-nekomata-norma-sunna', ['agent-nekomata', 'agent-norma', 'agent-sunna']],
  ['miyoushe-76994144-nekomata-norma-astra', ['agent-nekomata', 'agent-norma', 'agent-astra']],
  ['miyoushe-76994144-nekomata-dialyn-sunna', ['agent-nekomata', 'agent-dialyn', 'agent-sunna']],
  ['miyoushe-76994144-nekomata-dialyn-astra', ['agent-nekomata', 'agent-dialyn', 'agent-astra']],
] as const

const reviewedMetaSupplements = reviewedMetaTeams.map(([targetId, memberIds]) => {
  const sources = reviewedPerformance.sources.filter((source) =>
    source.observations.some((row) => row.targetTrioId === targetId && row.avgRoundM0 > 0),
  )
  if (new Set(sources.map((source) => source.phase)).size < 2)
    throw new Error(`Reviewed team requires current cross-mode observations: ${targetId}`)
  return {
    claimId: `versioned-strength-${targetId}`,
    memberIds,
    band: 'meta' as const,
    checkedAt: reviewedPerformance.checkedAt,
    assessment: 'source_adjudicated_coarse_tier' as const,
    evidenceConfidence: 'medium' as const,
    evidenceRefs: [
      ...(targetId.startsWith('pyrois')
        ? ['https://www.miyoushe.com/zzz/article/76053498', icy('pyrois-teams')]
        : targetId.includes('nekomata')
          ? [
              'https://www.miyoushe.com/zzz/article/76994144',
              'https://www.prydwen.gg/zenless/characters/nekomata',
              icy('tier-list'),
            ]
          : ['https://www.miyoushe.com/zzz/article/77013702']),
      ...sources.map((source) => source.url),
    ],
    adjudication: targetId.includes('nekomata')
      ? '3.1 潜能解锁后的培养参考：米游社精确三人配队、Prydwen 2026-08-19 对击破延长/连携资源与辅助协同的评测，以及本组合跨模式零影观测共同支持成熟队 Meta 粗档。以默认潜能6的培养基线评价，不声称当前0潜能账户已达到；不从单人T1、榜单位置、出场率或均分换算档位，不生成同档全序。'
      : '精确三人指南身份与现行机制成立，3.1.3 零影跨式舆防卫战／危局强袭观测确认当前可用；沿用成熟队 Meta 粗档的来源编辑裁决，不因同核心高配队继承 Apex。旧指南仅作身份和机制依据，不改写其版本。LvlUrArti 数据与 Prydwen 展示属于同一现实来源；出场率与均分不换算为评级，不声称统计显著、同档全序、DPS 或最优。邦布激活与适配独立判断。',
  }
})

const teamStrengthSupplements = [
  ...reviewedMetaSupplements,
  {
    claimId: 'versioned-strength-jane-velina-yuzuha',
    memberIds: ['agent-jane', 'agent-velina', 'agent-yuzuha'],
    band: 'meta',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/jane-doe',
      'https://www.icy-veins.com/zenless-zone-zero/jane-doe-teams',
    ],
    adjudication:
      '3.1 当前分析与队伍指南均保留该精确三人高完成度异常队；按成熟主流队记 Meta，不从 Jane Family 继承。',
  },
  {
    claimId: 'versioned-strength-alice-velina-yuzuha',
    memberIds: ['agent-alice', 'agent-velina', 'agent-yuzuha'],
    band: 'meta',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/velina',
      'https://www.icy-veins.com/zenless-zone-zero/velina-teams',
    ],
    adjudication: '精确三人由 3.1 当前双源确认，保持成熟异常主流队的 Meta 粗档。',
  },
  {
    claimId: 'versioned-strength-piper-velina-yuzuha',
    memberIds: ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    band: 'viable',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/velina',
      'https://www.icy-veins.com/zenless-zone-zero/velina-teams',
    ],
    adjudication:
      '3.1 当前双源保留该精确三人低成本异常闭环；只确认 Viable，不借同 Family 高配队升格。',
  },
  {
    claimId: 'versioned-strength-miyabi-burnice-yuzuha',
    memberIds: ['agent-miyabi', 'agent-burnice', 'agent-yuzuha'],
    band: 'meta',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/miyabi',
      'https://www.icy-veins.com/zenless-zone-zero/hoshimi-miyabi-teams',
    ],
    adjudication:
      '旧版紊乱机制未被 Patch Delta 否定，3.1 当前双源仍确认该精确组合；保留 Meta 粗档。',
  },
  {
    claimId: 'versioned-strength-jane-seth-caesar',
    memberIds: ['agent-jane', 'agent-seth', 'agent-caesar'],
    band: 'viable',
    evidenceRefs: [
      'https://wiki.biligame.com/zzz/%E7%AE%80%C2%B7%E6%9D%9C',
      'https://www.prydwen.gg/zenless/characters/seth',
      'https://www.icy-veins.com/zenless-zone-zero/caesar-king-teams',
    ],
    adjudication:
      '3.1 exact formation 仍可追溯，Seth/Caesar 的当前定位与场上时间合同支持低成本稳定闭环；只记 Viable，不继承其他 Jane Variant。',
  },
] as const

const supplementByFormationKey = new Map(
  teamStrengthSupplements.map((item) => [formationKey(item.memberIds), item]),
)

export const current31StrengthGoldSet = Object.freeze({
  contract: current31StrengthGoldSetContractId,
  gameVersion: '3.1',
  grain: 'exact_3_agent_plus_bangboo_variant' as const,
  teamStrengthGrain: 'exact_3_agent' as const,
  status: 'partial' as const,
  cases,
  calibrationCases: cases.filter((item) => item.split === 'calibration'),
  independentHoldoutCases: cases.filter((item) => item.split === 'independent_holdout'),
  versionedTeamStrengthSupplements: teamStrengthSupplements,
  bandLabelCount: cases.length,
  highConfidencePairwise: [
    {
      strongerCaseId: 'gold-ye-sunna-zhao-sprout',
      weakerCaseId: 'gold-ye-trigger-zhao-sprout',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams'],
      basis:
        'Same Ye/Zhao/Sprout shell isolates the third-slot quality; the mature Sunna team outranks the substitute Trigger variant.',
    },
    {
      strongerCaseId: 'gold-remielle-jane-velina-ariel',
      weakerCaseId: 'gold-remielle-piper-velina-ariel',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/velina-teams'],
      basis:
        'Same Remielle/Velina/Ariel shell isolates the on-field Anomaly replacement; Jane has the stronger current ceiling.',
    },
    {
      strongerCaseId: 'gold-aria-nangong-yuzuha-biggest-fan',
      weakerCaseId: 'gold-jane-vivian-yuzuha-robin',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'Current version role positions and exact-team guidance separate the present Apex Aria core from the established Meta Jane core.',
    },
    {
      strongerCaseId: 'gold-remielle-burnice-velina-ariel',
      weakerCaseId: 'gold-remielle-piper-velina-ariel',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/deadly-assault'],
      basis:
        'Same Remielle/Velina/Ariel shell isolates the third Anomaly slot; the current premium Burnice variant outranks the lower-ceiling Piper variant.',
    },
    {
      strongerCaseId: 'gold-miyabi-vivian-yuzuha-robin',
      weakerCaseId: 'gold-yixuan-pulchra-lucia-belion',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'The established premium Miyabi anomaly team outranks the explicitly lower-cost Yixuan substitute team.',
    },
    {
      strongerCaseId: 'gold-yixuan-ju-fufu-lucia-belion',
      weakerCaseId: 'gold-yixuan-pulchra-lucia-belion',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/yixuan-teams'],
      basis:
        'Same Yixuan/Lucia/Belion shell isolates the Stun replacement; Ju Fufu is the mature premium variant over Pulchra.',
    },
    {
      strongerCaseId: 'gold-remielle-jane-velina-ariel',
      weakerCaseId: 'gold-miyabi-vivian-yuzuha-robin',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'Current version positions and multi-source exact-team evidence separate the present Apex Remielle shell from the established Meta Miyabi shell.',
    },
    {
      strongerCaseId: 'gold-aria-nangong-yuzuha-biggest-fan',
      weakerCaseId: 'gold-miyabi-vivian-yuzuha-robin',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'Current version positions and exact-team guidance separate the present Apex Aria shell from the established Meta Miyabi shell.',
    },
    {
      strongerCaseId: 'gold-ye-sunna-zhao-sprout',
      weakerCaseId: 'gold-yixuan-ju-fufu-lucia-belion',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'Current version positions and cross-mode exact-team evidence separate the Apex Ye team from the mature Meta Yixuan team.',
    },
    {
      strongerCaseId: 'gold-jane-vivian-yuzuha-robin',
      weakerCaseId: 'gold-ye-trigger-zhao-sprout',
      confidence: 'high' as const,
      split: 'production_partial_order' as const,
      labelEvidenceRefs: ['https://www.icy-veins.com/zenless-zone-zero/tier-list'],
      basis:
        'The established premium Jane anomaly team outranks the substitute Ye/Trigger variant in the current coarse partial order.',
    },
  ],
  boundary:
    'Gold 记录保留精确三人 + 具体邦布的来源上下文，但 Team Strength 只投影到 exact 3-agent；邦布激活与适配由独立权威判断。列表顺序、使用率、角色单体评级或 Family 标签均不能单独产生 Band。旧 independent_holdout 行已确认存在构造泄漏，现仅作可复用 canonical/diagnostic，不再计入 Blind Holdout；新的最终标签不允许运行时读取。',
})

export function resolveCurrent31StrengthGoldTeamCalibration(
  memberIds: readonly [string, string, string],
) {
  const matches = casesByFormationKey.get(formationKey(memberIds)) ?? []
  if (!matches.length) {
    const supplement = supplementByFormationKey.get(formationKey(memberIds))
    return supplement
      ? Object.freeze({
          band: supplement.band,
          cases: [],
          evidenceRefs: [
            ...new Set([
              ...supplement.evidenceRefs,
              ...current31ReviewedStrengthEvidence(memberIds),
            ]),
          ],
        })
      : null
  }
  return Object.freeze({
    band: matches[0].band,
    cases: matches,
    evidenceRefs: [
      ...new Set([
        ...matches.flatMap((item) => item.evidenceRefs.map((ref) => ref.url)),
        ...current31ReviewedStrengthEvidence(memberIds),
      ]),
    ],
  })
}

export function resolveCurrent31StrengthGoldCalibration(input: {
  memberIds: readonly [string, string, string]
  bangbooId: string | null
}) {
  if (!input.bangbooId) return null
  const key = variantKey(input.memberIds, input.bangbooId)
  return (
    current31StrengthGoldSet.cases.find(
      (item) => variantKey(item.memberIds, item.bangbooId) === key,
    ) ?? null
  )
}
