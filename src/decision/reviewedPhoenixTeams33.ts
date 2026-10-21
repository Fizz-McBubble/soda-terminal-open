import {
  getCurrentAgentNumericContract,
  isReviewedPhoenixNumericContract,
} from '../calculation/currentAgentNumericContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import type { ReviewedTeamAnalysis } from './reviewedTeamAnalysis'
import type { ReviewedTeamSourceDirection } from '../gameDataPacks/reviewedTeamSourceDirections'

const guide = {
  url: 'https://www.icy-veins.com/zenless-zone-zero/phoenix-teams',
  sourceVersion: '3.3',
  sourceUpdatedAt: '2026-10-09',
  checkedAt: '2026-10-21',
  contentHash: '65f23f8d6257c4c8fa03e3dd20e39047e996f821062d647fa49c3f6c0d516cc2',
  hashDefinition: 'web_tool_text_extraction_not_original_html',
}

const source = {
  url: 'https://static.nanoka.cc/zzz/3.3/zh/character/1641.json',
  locator:
    'passive.level.1641507.desc; talent.1; skill.basic.description[1]; skill.chain.description[2]',
  sourceVersion: '3.3',
  sourceContentHash: '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe',
}
const formulaBindings: Record<string, string> = {
  'agent-yanagi': '5FFF32C390B426C1CAFF95FDD0EE6C744EF8D2FDCBD3A7F24D378C2EDEB921A2',
  'agent-burnice': '8A46BA0B3E268C6C2E67C2029E0FA293D3C7C97718BC2063D43FB29EB81D2B3C',
  'agent-yuzuha': '61F637F03E82BCE0B22F1FE85D3EEB4BD9ACA00B0787C74137F3ED94737CA8F6',
  'agent-velina': '159122E6D3D10D58E3311F1FD44E193A430343BF58986BD725A3006BBACA20EA',
  'agent-remielle': '75AF20EB1BA2266489D8901F948DB4AE51C73D5DE73C172F09B2349CFD503225',
  'agent-vivian': '89933DF78C2479BAEAD0CF1EC9100332815D549C7DBAB5DFC911EA896392500E',
}
const conditions = [
  '菲欧妮按1影、核心7、初始异常掌控255.36成型参考；需维持20秒灼蚀，重复异常命中刷新。',
  '另一位异常队友激活黑枝王牌；支援效果按实际切人顺序维持，站场分配是玩法条件，未完成数值循环验证。',
]
const limitations = [
  'Soda本地泛用低置信参考；冻结strategy没有精确三人推荐，档位不来自作者Tier，不是实测DPS、客观排名或95%准确率。',
  '原60人事件合同不包含菲欧妮；完整事件、资源循环、站场预算与精确伤害仍未闭合。',
  '简的自身强击暴击与灼蚀的合成尚未证明；未据此扩展简队。M4额外异放是否继承40%暴伤未知，不纳入本参考。',
]

export const reviewedPhoenixTeams33 = [
  {
    memberIds: ['agent-phoenix', 'agent-velina', 'agent-remielle'] as const,
    primaryOutputAgentId: 'agent-phoenix',
    band: 'S' as const,
    authorSlot: 1,
    rationale:
      '风火异常与异放、维琳娜副输出及失衡、丹的三异常支援共同支持菲欧妮前场，并使异常暴击覆盖多个输出接受者；按原S档多环节互补的泛用刻度暂列S。此判断由Soda承担，未继承作者T0或关卡第三次失衡结论，丹相变修复的实际运行时表现仍未验证。',
  },
  {
    memberIds: ['agent-phoenix', 'agent-velina', 'agent-yuzuha'] as const,
    primaryOutputAgentId: 'agent-phoenix',
    band: 'A+' as const,
    authorSlot: 2,
    rationale:
      '风火异常副输出与菲欧妮异放、柚叶异常积蓄及增益构成明确互补；与既有双异常加柚叶A+刻度一致。保留维琳娜叠层与染色顺序条件，不把来源关卡优势转换为通用S或精确循环提升。',
  },
  {
    memberIds: ['agent-phoenix', 'agent-vivian', 'agent-remielle'] as const,
    primaryOutputAgentId: 'agent-phoenix',
    band: 'A+' as const,
    authorSlot: 3,
    rationale:
      '薇薇安后台异常副输出保留菲欧妮站场，三异常满足丹的支援方向；异常暴击具有多接受者价值。薇薇安积蓄较慢可能限制丹的收益，暂以双异常协同A+为本地参考，不继承风火队S档。',
  },
  {
    memberIds: ['agent-phoenix', 'agent-vivian', 'agent-yuzuha'] as const,
    primaryOutputAgentId: 'agent-phoenix',
    band: 'A+' as const,
    authorSlot: 4,
    rationale:
      '薇薇安后台副输出与柚叶异常支援保留菲欧妮前场，火/以太异常及异放可共享灼蚀收益；按既有双异常加柚叶A+刻度暂列，保留异常积蓄、染色与资源供应条件，不推断最优循环。',
  },
  {
    memberIds: ['agent-phoenix', 'agent-yanagi', 'agent-yuzuha'] as const,
    primaryOutputAgentId: 'agent-yanagi',
    band: 'A+' as const,
    rationale:
      '柳提供电异常和极性紊乱，菲欧妮提供火异常、异放及全队异常暴击接受面，柚叶支援双异常；三人额外能力有明确异常队友条件。以既有雅/柳/柚叶A+为同核心参考刻度，菲欧妮替换的独立贡献足以列入A+候选，但不主张强于雅队，也不继承其落霜机制或S档结论。',
  },
  {
    memberIds: ['agent-phoenix', 'agent-burnice', 'agent-yuzuha'] as const,
    primaryOutputAgentId: 'agent-phoenix',
    band: 'A' as const,
    rationale:
      '柏妮思后台火异常与菲欧妮前场输出分工可支持灼蚀和异放，柚叶提供异常支援。相比柳双属性方向，同火异常的覆盖竞争和紊乱触发条件更敏感；在原泛用刻度上暂列A，不能把后台标签等同完整循环，也不宣称确定弱于柳队。',
  },
] as const

/** Only these reviewed trios may use a local reference without pretending that
 * the missing GO event/rotation model exists. Unknown trios remain visible. */
export function resolveReviewedPhoenixTeam33(
  memberIds: readonly string[],
  targetVersion = currentGameDataSelection.gameVersion,
) {
  if (
    targetVersion !== '3.3' ||
    currentGameDataSelection.gameVersion !== '3.3' ||
    memberIds.length !== 3 ||
    new Set(memberIds).size !== 3
  )
    return null
  const phoenix = getCurrentAgentNumericContract('agent-phoenix')
  if (!phoenix || !isReviewedPhoenixNumericContract(phoenix)) return null
  const row = reviewedPhoenixTeams33.find((entry) =>
    entry.memberIds.every((id) => memberIds.includes(id)),
  )
  if (
    !row ||
    memberIds
      .filter((id) => id !== 'agent-phoenix')
      .some(
        (id) =>
          getCurrentAgentDecisionMechanicContract(
            id,
          )?.effectContract?.source.formulaSha256.toUpperCase() !== formulaBindings[id],
      )
  )
    return null
  const analysis: ReviewedTeamAnalysis = {
    band: row.band,
    confidence: 'low',
    rationale: row.rationale,
    conditions: [...conditions],
    limitations: [
      ...limitations,
      ...('authorSlot' in row
        ? [
            '成员参考来自Lily于2026-10-09更新的发布前攻略；2026-10-21只复核成员与正式机制，不宣称作者在发布日重评。',
          ]
        : ['此三人为Soda机制替代方向，没有精确作者成员来源。']),
    ],
    evidenceRefs: [
      { ...source },
      ...('authorSlot' in row
        ? [
            {
              url: guide.url,
              locator: `Phoenix's Best Teams > composition ${row.authorSlot}`,
              sourceVersion: guide.sourceVersion,
              sourceContentHash: guide.contentHash,
            },
          ]
        : []),
    ],
  }
  return {
    analysis,
    primaryOutputAgentId: row.primaryOutputAgentId,
    referenceBasis: 'local_limited_mechanism_review_33' as const,
  }
}

export function reviewedPhoenixSourceDirections33(
  reviewVersion: string,
): ReviewedTeamSourceDirection[] {
  if (reviewVersion !== '3.3' || currentGameDataSelection.gameVersion !== '3.3') return []
  const sourceRows = [
    ...reviewedPhoenixTeams33,
    { memberIds: ['agent-phoenix', 'agent-nangong', 'agent-yuzuha'] as const, authorSlot: 5 },
    { memberIds: ['agent-phoenix', 'agent-promeia', 'agent-yuzuha'] as const, authorSlot: 6 },
  ]
  return sourceRows.flatMap((row) =>
    'authorSlot' in row
      ? [
          {
            memberIds: row.memberIds,
            conditions: [
              ...(row.authorSlot <= 4
                ? conditions
                : [
                    row.authorSlot === 5
                      ? '南宫羽/柚叶方向保留作者成员；缺其他异常或同阵营队友，不能宣称激活菲欧妮额外能力，暂不分档。'
                      : '普罗米娅可提供异放支援，但与菲欧妮争用站场时间；保留来源方向，暂不分档。',
                  ]),
              'Lily 2026-10-09发布前攻略精确成员；3.3正式参数另行复核，作者个人Tier不参与队伍评级。',
            ],
            sourceRefs: [
              {
                ...guide,
                id: `icy-phoenix-team-${row.authorSlot}`,
                locator: `Phoenix's Best Teams > composition ${row.authorSlot}`,
                verificationStatus: 'reviewed_prerelease_exact_membership_33',
              },
            ],
          },
        ]
      : [],
  )
}
