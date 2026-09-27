import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'

export const current31TeamCoreAggregationContractId =
  'soda-current-3.1-team-family-aggregation/v2' as const

function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

type TeamFamilySlotContract =
  | {
      kind: 'one_agent_variant'
      slots: readonly [
        {
          slotId: 'variant-agent'
          cardinality: 1
          allowedAgentIds: readonly string[]
        },
      ]
    }
  | { kind: 'functional_slots'; slots: readonly { slotId: string; cardinality: number }[] }
  | { kind: 'fixed_three'; slots: readonly [] }

type TeamFamilyDefinition = {
  familyId: string
  label: string
  coreAgentIds: readonly string[]
  slotContract: TeamFamilySlotContract
  variantFormationKeys: readonly string[]
}

function keys(formations: readonly (readonly [string, string, string])[]) {
  return formations.map(formationKey)
}

function oneAgentVariant(allowedAgentIds: readonly string[]): TeamFamilySlotContract {
  return {
    kind: 'one_agent_variant',
    slots: [{ slotId: 'variant-agent', cardinality: 1, allowedAgentIds }],
  }
}

const fixedThree = { kind: 'fixed_three', slots: [] } as const

const definitions: readonly TeamFamilyDefinition[] = [
  {
    familyId: 'core-yixuan-lucia',
    label: '仪玄·卢西娅命破核心',
    coreAgentIds: ['agent-yixuan', 'agent-lucia'],
    slotContract: oneAgentVariant([
      'agent-dialyn',
      'agent-ju-fufu',
      'agent-astra',
      'agent-pulchra',
    ]),
    variantFormationKeys: keys([
      ['agent-yixuan', 'agent-dialyn', 'agent-lucia'],
      ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
      ['agent-yixuan', 'agent-lucia', 'agent-astra'],
      ['agent-yixuan', 'agent-pulchra', 'agent-lucia'],
    ]),
  },
  {
    familyId: 'core-ye-zhao',
    label: '叶瞬光·照帷幕核心',
    coreAgentIds: ['agent-ye-shunguang', 'agent-zhao'],
    slotContract: oneAgentVariant([
      'agent-dialyn',
      'agent-sunna',
      'agent-astra',
      'agent-trigger',
      'agent-seed',
    ]),
    variantFormationKeys: keys([
      ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
      ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'],
      ['agent-ye-shunguang', 'agent-astra', 'agent-zhao'],
      ['agent-ye-shunguang', 'agent-trigger', 'agent-zhao'],
      ['agent-ye-shunguang', 'agent-seed', 'agent-zhao'],
    ]),
  },
  {
    familyId: 'core-ye-dialyn-sunna',
    label: '叶瞬光·Dialyn·Sunna 完整核心',
    coreAgentIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'],
    slotContract: fixedThree,
    variantFormationKeys: keys([['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna']]),
  },
  {
    familyId: 'core-aria-nangong',
    label: '爱芮·南宫羽异常核心',
    coreAgentIds: ['agent-aria', 'agent-nangong'],
    slotContract: oneAgentVariant(['agent-sunna', 'agent-yuzuha']),
    variantFormationKeys: keys([
      ['agent-aria', 'agent-nangong', 'agent-sunna'],
      ['agent-aria', 'agent-nangong', 'agent-yuzuha'],
    ]),
  },
  {
    familyId: 'core-aria-sunna-yuzuha',
    label: '爱芮·Sunna·柚叶完整核心',
    coreAgentIds: ['agent-aria', 'agent-sunna', 'agent-yuzuha'],
    slotContract: fixedThree,
    variantFormationKeys: keys([['agent-aria', 'agent-sunna', 'agent-yuzuha']]),
  },
  {
    familyId: 'core-remielle-velina',
    label: '蕾米埃尔·维琳娜异常核心',
    coreAgentIds: ['agent-remielle', 'agent-velina'],
    slotContract: oneAgentVariant([
      'agent-aria',
      'agent-promeia',
      'agent-jane',
      'agent-alice',
      'agent-piper',
      'agent-vivian',
      'agent-burnice',
    ]),
    variantFormationKeys: keys([
      ['agent-aria', 'agent-remielle', 'agent-velina'],
      ['agent-remielle', 'agent-promeia', 'agent-velina'],
      ['agent-remielle', 'agent-jane', 'agent-velina'],
      ['agent-remielle', 'agent-alice', 'agent-velina'],
      ['agent-remielle', 'agent-piper', 'agent-velina'],
      ['agent-remielle', 'agent-vivian', 'agent-velina'],
      ['agent-remielle', 'agent-burnice', 'agent-velina'],
    ]),
  },
  {
    familyId: 'core-velina-yuzuha',
    label: '维琳娜·柚叶异常核心',
    coreAgentIds: ['agent-velina', 'agent-yuzuha'],
    slotContract: oneAgentVariant(['agent-promeia', 'agent-jane', 'agent-alice', 'agent-piper']),
    variantFormationKeys: keys([
      ['agent-promeia', 'agent-velina', 'agent-yuzuha'],
      ['agent-jane', 'agent-velina', 'agent-yuzuha'],
      ['agent-alice', 'agent-velina', 'agent-yuzuha'],
      ['agent-piper', 'agent-velina', 'agent-yuzuha'],
    ]),
  },
  {
    familyId: 'core-sigrid-norma',
    label: 'Sigrid·Norma 强攻失衡核心',
    coreAgentIds: ['agent-sigrid', 'agent-norma'],
    slotContract: oneAgentVariant(['agent-sunna', 'agent-astra']),
    variantFormationKeys: keys([
      ['agent-sigrid', 'agent-norma', 'agent-sunna'],
      ['agent-sigrid', 'agent-norma', 'agent-astra'],
    ]),
  },
  {
    familyId: 'core-miyabi-yuzuha',
    label: '星见雅·柚叶异常核心',
    coreAgentIds: ['agent-miyabi', 'agent-yuzuha'],
    slotContract: oneAgentVariant(['agent-nangong', 'agent-vivian', 'agent-burnice']),
    variantFormationKeys: keys([
      ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
      ['agent-miyabi', 'agent-vivian', 'agent-yuzuha'],
      ['agent-miyabi', 'agent-burnice', 'agent-yuzuha'],
    ]),
  },
  {
    familyId: 'core-miyabi-yanagi-astra',
    label: '星见雅·月城柳·耀嘉音完整核心',
    coreAgentIds: ['agent-miyabi', 'agent-yanagi', 'agent-astra'],
    slotContract: fixedThree,
    variantFormationKeys: keys([['agent-miyabi', 'agent-yanagi', 'agent-astra']]),
  },
]

const familyByFormationKey = new Map<string, TeamFamilyDefinition>()
for (const definition of definitions) {
  for (const key of definition.variantFormationKeys) {
    if (familyByFormationKey.has(key)) throw new Error(`3.1 core family 重复登记精确编队：${key}`)
    familyByFormationKey.set(key, definition)
  }
}

export function resolveCurrent31TeamFamily(memberIds: readonly [string, string, string]) {
  const key = formationKey(memberIds)
  const definition = familyByFormationKey.get(key)
  return definition
    ? {
        status: 'aggregated' as const,
        familyId: definition.familyId,
        label: definition.label,
        coreAgentIds: definition.coreAgentIds,
        slotContract: definition.slotContract,
        exactFormationKey: key,
        variantCount: definition.variantFormationKeys.length,
      }
    : {
        status: 'exact_only' as const,
        familyId: `exact:${key}`,
        label: '尚未聚合的精确三人组合',
        coreAgentIds: memberIds,
        slotContract: fixedThree,
        exactFormationKey: key,
        variantCount: 1,
      }
}

export function resolveCurrent31ExactAgentVariant(memberIds: readonly [string, string, string]) {
  const family = resolveCurrent31TeamFamily(memberIds)
  return {
    ...family,
    exactAgentVariantId: `agents:${family.exactFormationKey}`,
    ratingInheritance: 'forbidden' as const,
    evaluationBoundary:
      'Mechanic Validity、Meta Calibration、Reality Check 与 Team Strength 必须按该精确三人独立计算；Family 不提供可继承评级。Reference Performance 只作为后续增强。',
  }
}

export function resolveCurrent31BangbooVariant(
  memberIds: readonly [string, string, string],
  bangbooId: string | null,
) {
  const exact = resolveCurrent31ExactAgentVariant(memberIds)
  return {
    ...exact,
    bangbooId,
    bangbooVariantId: `${exact.exactAgentVariantId}::${bangbooId ?? 'bangboo-unbound'}`,
    inventoryAuthority: false,
    evaluationIdentity: 'exact_3_agent_plus_bangboo' as const,
    boundary:
      '邦布属于精确三人 variant 的第四个机制与现实校准参数，不改变 Team Family 身份；默认推荐与替代项不读取账户库存。该 Variant 必须独立完成机制与 Reality Check，后续再接入 Reference Performance。',
  }
}

/** @deprecated Use the explicit Family → Exact Agent Variant → Bangboo Variant APIs. */
export const resolveCurrent31TeamCore = resolveCurrent31TeamFamily

/** @deprecated Use resolveCurrent31BangbooVariant. */
export const resolveCurrent31TeamVariant = resolveCurrent31BangbooVariant

const assignedConsensusKeys = new Set(
  current31IndependentConsensusGoldSet.observations.map((row) => formationKey(row.memberIds)),
)
const registeredConsensusKeys = new Set(familyByFormationKey.keys())
const missingConsensusKeys = [...assignedConsensusKeys].filter(
  (key) => !registeredConsensusKeys.has(key),
)
const extraConsensusKeys = [...registeredConsensusKeys].filter(
  (key) => !assignedConsensusKeys.has(key),
)
if (missingConsensusKeys.length || extraConsensusKeys.length)
  throw new Error(
    `3.1 core family 与 Gold Set 不守恒：missing=${missingConsensusKeys.join(',')} extra=${extraConsensusKeys.join(',')}`,
  )

export const current31TeamCoreAggregation = Object.freeze({
  contract: current31TeamCoreAggregationContractId,
  gameVersion: '3.1',
  families: definitions.map((definition) => ({
    familyId: definition.familyId,
    label: definition.label,
    coreAgentIds: definition.coreAgentIds,
    slotContract: definition.slotContract,
    variantCount: definition.variantFormationKeys.length,
  })),
  familyCount: definitions.length,
  exactFormationCount: familyByFormationKey.size,
  collapsedVariantCount: familyByFormationKey.size - definitions.length,
  ratingInheritance: 'forbidden' as const,
  recommendationChain: [
    'team_family',
    'exact_3_agent_variant',
    'bangboo_variant',
    'mechanic_validity',
    'meta_calibration',
    'reality_check',
    'team_strength',
    'account_cultivation_priority',
  ] as const,
  boundary:
    'Team Family 只用于聚合、主流召回、推荐数量与 UI 展示。Family 由 coreAgentIds + slotContract 表达，可承载双核、单核功能位或固定三人；精确三人及邦布 variant 各自计算 Mechanic Validity、Meta Calibration、Reality Check 与 Team Strength，禁止继承 Family 评级。Reference Performance 是后续增强路线。',
})
