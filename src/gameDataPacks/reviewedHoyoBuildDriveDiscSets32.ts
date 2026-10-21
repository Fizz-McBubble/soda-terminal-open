import type { AgentProfileField } from './agentProfileFieldProjection'
import type { CandidateSetPlan } from './candidateSetPlans'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { PlayerBuildSource } from './playerBuildSources'
import { stableContentHash } from './types'

type ConditionRule = NonNullable<CandidateSetPlan['condition']>['rule']

type ReviewedDriveDiscPlan = Omit<CandidateSetPlan, 'condition'> & {
  conditionRule?: ConditionRule
}

type ReviewedDriveDiscGuide = {
  agentId: string
  slug: string
  sourceUpdatedAt: string
  setDirections: readonly string[]
  setPlans: readonly ReviewedDriveDiscPlan[]
  extraConditions?: readonly string[]
}

const checkedAt = '2026-10-20'
const commonConditions = [
  'HoyoBuild页面标记Version 3.2；只采用页面明确列出的4+2套装分支、件数、主副词与条件。',
  '页面引用Prydwen、Game8或Icy Veins不另计独立来源；不继承Tier、DPS、使用率或最佳队伍声明。',
]
const provenanceBoundary =
  '最小公开页面事实投影；contentHash覆盖本轮抽取的盘套文字、分支与页面日期，不是原始HTML哈希。'

export const reviewedHoyoBuildDriveDiscGuides32: readonly ReviewedDriveDiscGuide[] = [
  {
    agentId: 'agent-ben',
    slug: 'ben',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '啄木鸟电音4 + 折枝剑歌2：通用方向，普攻用于维持EX与终结技前的套装层数。',
      '炎狱重金属4 + 啄木鸟电音2：需要稳定灼烧，仅与柏妮思或柚叶等强灼烧来源可靠。',
      '河豚电音4 + 啄木鸟电音2：与琉音同队时优先，终结技转换可提前建立套装效果。',
      '荆棘玫瑰4 + 摇摆爵士2：3.2来源的直伤方向，初始防御达到1,000/1,800时获得对应档位。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-woodpecker-electro'],
        secondarySetIds: ['set-branch-blade-song'],
        purpose: 'recommended',
        sourceText: 'Prydwen best general: Woodpecker Electro 4 + Branch & Blade Song 2.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-inferno-metal'],
        secondarySetIds: ['set-woodpecker-electro'],
        purpose: 'conditional',
        sourceText:
          'Inferno Metal 4 + Woodpecker Electro 2; reliable only with a strong Burn applier such as Burnice or Yuzuha.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-puffer-electro'],
        secondarySetIds: ['set-woodpecker-electro'],
        purpose: 'conditional',
        sourceText:
          'Puffer Electro 4 + Woodpecker Electro 2; best with Dialyn so Ultimate conversion starts the buff.',
        conditionRule: { kind: 'teammate', agentId: 'agent-dialyn' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-34200'],
        secondarySetIds: ['set-swing-jazz'],
        purpose: 'recommended',
        sourceText:
          'Thorned Rose 4 + Swing Jazz 2; Game8 DPS direction with 1,000/1,800 initial DEF thresholds.',
      },
    ],
  },
  {
    agentId: 'agent-zhao',
    slug: 'zhao',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '仙境漫游4 + 云岿如我2：来源首选，EX或任一队友的防御/闪避支援可提高全队伤害。',
      '仙境漫游4 + 摇摆爵士2：需要更多回能以及时刷新以太帷幕时的替代。',
      '静听嘉音4 + 摇摆爵士2：强攻主输出队方向；照的快速支援可叠层，但自身不能维持三层。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-bunny-in-wonderland'],
        secondarySetIds: ['set-yunkui-tales'],
        purpose: 'recommended',
        sourceText:
          'Bunny in Wonderland 4 + Yunkui Tales 2; squad DMG from EX or Defensive/Evasive Assists.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-bunny-in-wonderland'],
        secondarySetIds: ['set-swing-jazz'],
        purpose: 'conditional',
        sourceText:
          'Bunny in Wonderland 4 + Swing Jazz 2 when extra Energy is needed to refresh the Veil every 40s.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-astral-voice'],
        secondarySetIds: ['set-swing-jazz'],
        purpose: 'conditional',
        sourceText:
          'Astral Voice 4 + Swing Jazz 2 for Attack DPS; she cannot keep three Astral stacks alone.',
      },
    ],
  },
  {
    agentId: 'agent-miyabi',
    slug: 'miyabi',
    sourceUpdatedAt: '2026-09-24',
    setDirections: [
      '折枝剑歌4 + 极地重金属2：来源首选，需要至少115异常掌控。',
      '啄木鸟电音4 + 极地重金属2：缺少暴击率时的通用替代。',
      '极地重金属4 + 啄木鸟电音2：提高普攻伤害，但需要由副词条补足暴击。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-branch-blade-song'],
        secondarySetIds: ['set-polar-metal'],
        purpose: 'recommended',
        sourceText:
          'Branch & Blade Song 4 + Polar Metal 2; signature branch requires at least 115 Anomaly Mastery.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-woodpecker-electro'],
        secondarySetIds: ['set-polar-metal'],
        purpose: 'recommended',
        sourceText: 'Woodpecker Electro 4 + Polar Metal 2 when more CRIT Rate is needed.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-polar-metal'],
        secondarySetIds: ['set-woodpecker-electro'],
        purpose: 'conditional',
        sourceText:
          'Polar Metal 4 + Woodpecker Electro 2; Basic Attack branch with CRIT supplied by substats.',
      },
    ],
  },
  {
    agentId: 'agent-caesar',
    slug: 'caesar',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '静听嘉音4 + 震星迪斯科2：来源首选，快速支援与支援入场为全队叠层；队友已穿静听时改用其他分支。',
      '原始朋克4 + 震星迪斯科2：防御支援触发护盾与全队增伤的方向。',
      '仙境漫游4 + 震星迪斯科2：2.7防御套装方向，由EX与防御支援提高全队伤害。',
      '自由蓝调4 + 震星迪斯科2：物理异常队方向，频繁EX降低物理异常积蓄抗性。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-astral-voice'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'recommended',
        sourceText:
          'Astral Voice 4 + Shockstar Disco 2; use another set if a teammate already wears Astral Voice.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-proto-punk'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'recommended',
        sourceText:
          'Proto Punk 4 + Shockstar Disco 2; defensive assists provide shield and squad DMG.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-bunny-in-wonderland'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'conditional',
        sourceText: 'Bunny in Wonderland 4 + Shockstar Disco 2; defense-only set from 2.7.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-freedom-blues'],
        secondarySetIds: ['set-shockstar-disco'],
        purpose: 'conditional',
        sourceText:
          'Freedom Blues 4 + Shockstar Disco 2 for Physical Anomaly teams; EX lowers Anomaly Buildup RES.',
      },
    ],
  },
  {
    agentId: 'agent-rina',
    slug: 'rina',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '月光骑士颂4 + 河豚电音2：来源首选支援方向，EX或终结技提供全队增伤。',
      '摇摆爵士4 + 河豚电音2：队友已穿月光骑士颂且同名增益不叠加时的替代。',
      '自由蓝调4 + 河豚电音2：电异常队方向，EX降低目标电异常积蓄抗性。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-moonlight-lullaby'],
        secondarySetIds: ['set-puffer-electro'],
        purpose: 'recommended',
        sourceText:
          'Moonlight Lullaby 4 + Puffer Electro 2; EX or Ultimate provides squad DMG for 25s.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-moonlight-lullaby' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-swing-jazz'],
        secondarySetIds: ['set-puffer-electro'],
        purpose: 'conditional',
        sourceText:
          'Swing Jazz 4 + Puffer Electro 2 if another Support already runs Moonlight Lullaby.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-moonlight-lullaby' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-freedom-blues'],
        secondarySetIds: ['set-puffer-electro'],
        purpose: 'conditional',
        sourceText:
          'Freedom Blues 4 + Puffer Electro 2 for Electric Anomaly teams such as Yanagi or Grace.',
      },
    ],
  },
  {
    agentId: 'agent-pan-yinhu',
    slug: 'pan-yinhu',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '静听嘉音4 + 激素朋克2：来源首选，EX的快速支援为入场主输出叠层。',
      '静听嘉音4 + 摇摆爵士2：更频繁EX与回能方向。',
      '摇摆爵士4 + 静听嘉音2：队友已穿静听嘉音时的替代。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-astral-voice'],
        secondarySetIds: ['set-hormone-punk'],
        purpose: 'recommended',
        sourceText:
          'Astral Voice 4 + Hormone Punk 2; EX Quick Assist feeds Astral Voice for the incoming DPS.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-astral-voice'],
        secondarySetIds: ['set-swing-jazz'],
        purpose: 'recommended',
        sourceText: 'Astral Voice 4 + Swing Jazz 2; extra Energy for more frequent EX Specials.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-swing-jazz'],
        secondarySetIds: ['set-astral-voice'],
        purpose: 'conditional',
        sourceText: 'Swing Jazz 4 + Astral Voice 2 if another Agent already wears Astral Voice.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
    ],
  },
  {
    agentId: 'agent-seth',
    slug: 'seth',
    sourceUpdatedAt: '2026-09-26',
    setDirections: [
      '静听嘉音4 + 摇摆爵士2：来源首选，围绕快速支援自然叠层。',
      '原始朋克4 + 激素朋克2：防御支援提供护盾与全队增伤。',
      '仙境漫游4 + 激素朋克2：2.7防御套装方向，以部分护盾强度换取全队伤害。',
      '摇摆爵士4 + 激素朋克2：队友已穿静听嘉音时的替代。',
    ],
    setPlans: [
      {
        pattern: '4+2',
        primarySetIds: ['set-astral-voice'],
        secondarySetIds: ['set-swing-jazz'],
        purpose: 'recommended',
        sourceText:
          'Astral Voice 4 + Swing Jazz 2; kit-centered Quick Assists naturally build Astral stacks.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-proto-punk'],
        secondarySetIds: ['set-hormone-punk'],
        purpose: 'recommended',
        sourceText:
          'Proto Punk 4 + Hormone Punk 2; Defensive Assists provide shield and squad DMG.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-bunny-in-wonderland'],
        secondarySetIds: ['set-hormone-punk'],
        purpose: 'conditional',
        sourceText: 'Bunny in Wonderland 4 + Hormone Punk 2; defense-only set from 2.7.',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-swing-jazz'],
        secondarySetIds: ['set-hormone-punk'],
        purpose: 'conditional',
        sourceText: 'Swing Jazz 4 + Hormone Punk 2 if someone else already wears Astral Voice.',
        conditionRule: { kind: 'teammate_not_four_piece', setId: 'set-astral-voice' },
      },
    ],
  },
] as const

const guidesByAgentId = new Map<string, ReviewedDriveDiscGuide>(
  reviewedHoyoBuildDriveDiscGuides32.map((guide) => [guide.agentId, guide] as const),
)

function sourceFor(guide: ReviewedDriveDiscGuide): PlayerBuildSource {
  const url = `https://hoyobuild.com/en/zzz/characters/${guide.slug}`
  const contentHash = stableContentHash({
    url,
    sourceVersion: '3.2',
    sourceUpdatedAt: guide.sourceUpdatedAt,
    setDirections: guide.setDirections,
    setPlans: guide.setPlans,
    conditions: guide.extraConditions ?? [],
  })
  return {
    id: `hoyobuild-${guide.agentId}-drive-discs-32-20261020`,
    url,
    sourceVersion: '3.2',
    originalSourceVersion: '3.2',
    authorReviewedVersion: null,
    checkedAt,
    contentHash,
    licenseBoundary: provenanceBoundary,
    pageUpdatedAt: guide.sourceUpdatedAt,
    retrievedAt: checkedAt,
    verified: true,
  }
}

function plansFor(guide: ReviewedDriveDiscGuide, source: PlayerBuildSource): CandidateSetPlan[] {
  return guide.setPlans.map(({ conditionRule, ...plan }) => ({
    ...plan,
    primarySetIds: [...plan.primarySetIds],
    secondarySetIds: [...plan.secondarySetIds],
    ...(conditionRule
      ? {
          condition: {
            sourceId: source.id,
            sourceUrl: source.url,
            sourceVersion: '3.2',
            contentHash: source.contentHash,
            sourceTextVerified: true,
            rule: conditionRule,
          },
        }
      : {}),
  }))
}

function firstPlanReadiness(
  plans: readonly CandidateSetPlan[],
): CandidateWarehouseConstraint['setPlanReadiness'] {
  const first = plans[0]
  return first
    ? {
        status: 'executable',
        pattern: first.pattern,
        primarySetIds: [...first.primarySetIds],
        secondarySetIds: [...first.secondarySetIds],
      }
    : {
        status: 'non_executable',
        reason: 'unresolved_set_roles',
        missingEvidence: '来源未给出可验证的主副套角色。',
      }
}

export function getReviewedHoyoBuildDriveDiscSets32(
  agentId: string,
): AgentProfileField | undefined {
  const guide = guidesByAgentId.get(agentId)
  if (!guide) return undefined
  const source = sourceFor(guide)
  const setPlans = plansFor(guide, source)
  return {
    group: 'build_guidance',
    path: 'build.drive_disc_sets',
    value: firstPlanReadiness(setPlans),
    displayValue: [...guide.setDirections],
    status: 'candidate',
    gameVersion: '3.2',
    originalSourceVersion: '3.2',
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous',
    sourceRefs: [source],
    verifiedAt: checkedAt,
    authorReviewedVersion: null,
    conflict: null,
    conditions: [...commonConditions, ...(guide.extraConditions ?? []), ...guide.setDirections],
    reason:
      'HoyoBuild 3.2页面明确盘套分支、4+2角色及来源条件；等价接入玩家指导与仓库求解，不扩展为Tier或Formal结论。',
  }
}

export function withReviewedHoyoBuildDriveDiscSets32(
  constraint: CandidateWarehouseConstraint,
): CandidateWarehouseConstraint {
  const guide = guidesByAgentId.get(constraint.agentId)
  if (!guide) return constraint
  const source = sourceFor(guide)
  const setPlans = plansFor(guide, source)
  const sources = [...constraint.sources.filter((candidate) => candidate.id !== source.id), source]
  const updated: CandidateWarehouseConstraint = {
    ...constraint,
    sources,
    setIds: [
      ...new Set(setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds])),
    ],
    setPlans,
    setPlanReadiness: firstPlanReadiness(setPlans),
    unresolvedSetDirections: [],
  }
  delete (updated as Partial<CandidateWarehouseConstraint>).contentHash
  return { ...updated, contentHash: stableContentHash(updated) }
}
