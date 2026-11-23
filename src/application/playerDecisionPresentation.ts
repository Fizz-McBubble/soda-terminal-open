import { formatDevelopmentEntityText } from './publicRosterNames'

/** Presentation vocabulary only. These labels never confer eligibility, precision or freshness. */
export const decisionSectionLabels = {
  recommendation: '建议',
  reason: '建议依据',
  conditions: '使用条件',
  gap: '差距',
  tradeoff: '使用取舍',
  nextAction: '下一步',
  current: '当前记录',
  target: '目标配置',
  reference: '参考配置',
  history: '保存时的结果',
} as const

export function decisionFreshnessPresentation(state: 'current' | 'stale' | 'historical') {
  if (state === 'stale')
    return {
      label: '建议待更新',
      detail: '按当前角色和装备更新建议。',
      action: '重新分析',
    }
  if (state === 'historical')
    return {
      label: decisionSectionLabels.history,
      detail: '',
      action: '',
    }
  return { label: '本次分析结果', detail: '', action: '' }
}

// Translate adopted explanation clauses, never discard a condition containing unfamiliar text.
const conditionExplanations: readonly (readonly [string, string, string?])[] = [
  // HoyoBuild disc summaries keep the original page text in the data model; only their
  // player-facing form is localized here. Effect text already shown beside the popup
  // covers purely mechanical restatements, so those summaries resolve to empty strings.
  ['Prydwen best general: Woodpecker Electro 4 + Branch & Blade Song 2.', ''],
  [
    'Inferno Metal 4 + Woodpecker Electro 2; reliable only with a strong Burn applier such as Burnice or Yuzuha.',
    '队伍能稳定维持灼烧时可选。',
    '需要稳定灼烧',
  ],
  [
    'Puffer Electro 4 + Woodpecker Electro 2; best with Dialyn so Ultimate conversion starts the buff.',
    '终结技转换可提前建立套装效果。',
  ],
  [
    'Thorned Rose 4 + Swing Jazz 2; Game8 DPS direction with 1,000/1,800 initial DEF thresholds.',
    '',
  ],
  ['Bunny in Wonderland 4 + Yunkui Tales 2; squad DMG from EX or Defensive/Evasive Assists.', ''],
  [
    'Bunny in Wonderland 4 + Swing Jazz 2 when extra Energy is needed to refresh the Veil every 40s.',
    '需要额外能量以每 40 秒刷新以太帷幕时可选。',
    '回能不足以每40秒刷新以太帷幕时',
  ],
  [
    'Astral Voice 4 + Swing Jazz 2 for Attack DPS; she cannot keep three Astral stacks alone.',
    '适用于强攻主输出队；照自身无法维持静听嘉音三层。',
    '强攻主输出队；叠满三层需队友配合',
  ],
  [
    'Branch & Blade Song 4 + Polar Metal 2; signature branch requires at least 115 Anomaly Mastery.',
    '',
  ],
  ['Woodpecker Electro 4 + Polar Metal 2 when more CRIT Rate is needed.', '缺少暴击率时可选。'],
  [
    'Polar Metal 4 + Woodpecker Electro 2; Basic Attack branch with CRIT supplied by substats.',
    '适合普攻分支；暴击需由副词条补足。',
    '普攻输出；暴击由副词条补足',
  ],
  [
    'Astral Voice 4 + Shockstar Disco 2; use another set if a teammate already wears Astral Voice.',
    '',
  ],
  ['Proto Punk 4 + Shockstar Disco 2; defensive assists provide shield and squad DMG.', ''],
  ['Bunny in Wonderland 4 + Shockstar Disco 2; defense-only set from 2.7.', ''],
  [
    'Freedom Blues 4 + Shockstar Disco 2 for Physical Anomaly teams; EX lowers Anomaly Buildup RES.',
    '适合物理异常队；强化特殊技可降低物理异常积蓄抗性。',
    '物理异常队适用',
  ],
  ['Moonlight Lullaby 4 + Puffer Electro 2; EX or Ultimate provides squad DMG for 25s.', ''],
  [
    'Swing Jazz 4 + Puffer Electro 2 if another Support already runs Moonlight Lullaby.',
    '另一名支援角色已装备月光骑士颂时可选。',
  ],
  [
    'Freedom Blues 4 + Puffer Electro 2 for Electric Anomaly teams such as Yanagi or Grace.',
    '适合月城柳或格莉丝等电属性异常队。',
    '电属性异常队适用',
  ],
  [
    'Astral Voice 4 + Hormone Punk 2; EX Quick Assist feeds Astral Voice for the incoming DPS.',
    '强化特殊技的快速支援可为入场主输出叠加星语。',
  ],
  [
    'Astral Voice 4 + Swing Jazz 2; extra Energy for more frequent EX Specials.',
    '需要额外能量以更频繁施放强化特殊技时可选。',
  ],
  ['Swing Jazz 4 + Astral Voice 2 if another Agent already wears Astral Voice.', ''],
  [
    'Astral Voice 4 + Swing Jazz 2; kit-centered Quick Assists naturally build Astral stacks.',
    '适合围绕快速支援自然叠加星语。',
  ],
  ['Proto Punk 4 + Hormone Punk 2; Defensive Assists provide shield and squad DMG.', ''],
  ['Bunny in Wonderland 4 + Hormone Punk 2; defense-only set from 2.7.', ''],
  ['Swing Jazz 4 + Hormone Punk 2 if someone else already wears Astral Voice.', ''],
  ['仅支持精确三人成员观察', '仅确认这组三人的搭配'],
  [
    '不证明推荐、强度档位、邦布默认、Formal 伤害或完整固定轴',
    '不代表强度、推荐优先级、邦布、精确伤害或完整循环',
  ],
  [
    '作者音擎比较场景：克拉蕾 + 诺姆 + 丽娜；诺姆装备 Chief Sidekick，丽娜装备 Weeping Cradle。',
    '音擎比较条件：克拉蕾 + 诺姆 + 丽娜；诺姆装备 wengine-14157，丽娜装备 wengine-14121。',
  ],
  [
    '作者音擎比较场景：洛克茜 + 克拉蕾 + 丽娜；克拉蕾装备 Crimson Thirst，丽娜装备 Weeping Cradle。',
    '音擎比较条件：洛克茜 + 克拉蕾 + 丽娜；克拉蕾装备 wengine-14161，丽娜装备 wengine-14121。',
  ],
  [
    '数值保留为攻略生存参考；本地语义分类不将其作为通用养成要求，不参与局外差距比较，来源未明确标注为可选',
    '仅供生存参考；是否必需尚未明确，不计入通用养成差距',
  ],
  ['仅沿用已成形的一般培养参考', '沿用一般培养参考'],
  ['为来源明确标注的可选属性，不参与局外差距比较', '为可选属性，不计入局外养成差距'],
  ['此属性为来源可选参考，不作为通用毕业要求', '此属性为可选参考，不作为通用养成要求'],
  ['条件尚未逐项核对，不标记差距', '使用条件尚未确认，暂不标记养成差距'],
  ['不参与局外差距比较', '不计入局外养成差距'],
  [
    '页面引用Prydwen、Game8或Icy Veins不另计独立来源；不继承Tier、DPS或最佳队伍声明',
    '多处引用按同一证据计；不继承强度档位、伤害或最佳队伍结论',
  ],
  ['但来源指出较难达成', '但较难达成'],
  ['来源标明其他属性不相关', '此培养方向不要求其他属性'],
  ['攻略的生命参考为', '一般生命参考为'],
  ['60级攻略实践参考', '60级配装参考'],
  ['这是攻略参考区间，不是 Formal 或唯一毕业线', '仅作配装参考，不是唯一毕业线或精确实战结论'],
  ['攻略以两个回能2件套达到该数值', '该参考数值按两个回能2件套计算'],
  [
    '游戏内slot4/slot2表示4件/2件套；part4/part5/part6按属性合法性映射，不作物理盘位',
    '4/2是套装标记，表示4件/2件效果；4/5/6号位主词条建议需符合各盘位可用属性，不代表实际装备位置',
  ],
  [
    '泛用成型采用Owner复核M1、Lv60、基础技能11、核心7及S音擎P1；A级队友按A6，均非账户观测',
    '培养参考按M1、Lv60、基础技能11、核心7、S音擎P1，A级队友按A6；非账户实测',
  ],
  ['不推算精确抽取收益或全队DPS', '不能据此判断抽取的精确收益或全队输出'],
  ['没有精确来源三人及邦布时不补默认队伍', '三名成员和邦布尚未确认时，不默认满足队伍条件'],
  [
    '没有作者最终攻击力或异常精通目标；机械门槛不代表全配装毕业、伤害排序或DPS',
    '最终攻击力或异常精通目标未明确；机制门槛不等于毕业或伤害排序',
  ],
  [
    '攻略33.8%仍为作者配装观测，满核心配合66%增益得到99.8%；机制数学满暴初始线为34%，不把两者混同。',
    '33.8%是特定配装记录；满核心配合66%增益时为99.8%。机制满暴需初始暴击34%，两者不能混用。',
  ],
  [
    '机制准备线与攻略列出的整数配装观测分开保留；达标不证明加油窗口正在生效。',
    '准备值与整数配装记录分别显示；达到准备值不代表加油窗口已生效。',
  ],
  [
    '先攻击后异常精通为攻略培养优先级；异常精通不是核心攻击转化的触发条件，准备线达标不证明狸愿窗口生效。',
    '建议先培养攻击力，再培养异常精通；异常精通不触发核心攻击转化，准备值达标不代表狸愿窗口生效。',
  ],
  [
    '静听嘉音四件套与达标后优先回能保留为攻略配方条件，不是机制转化封顶的前提；准备线不证明转交窗口已激活。',
    '静听嘉音四件套、达标后优先回能属于配装选择；准备值达标不代表转交窗口已激活。',
  ],
  [
    '攻略3430与既有整数候选3429/2963保留为配装观测；精确机制满档线使用实际核心与影画计算。',
    '3430及3429/2963是特定配装记录；满档所需数值按实际核心与影画计算。',
  ],
  [
    '攻略38%–72%是配装区间观测；各核心达到相应全队增益上限的机制准备线另行保留。',
    '38%–72%是配装参考区间；各核心的增益上限准备值分别计算。',
  ],
  [
    '3.12是满核心冲击上限，攻略2.88+是常规四加二配装参考；无需把前者强制当成所有配装的硬毕业门。',
    '3.12是满核心上限，2.88+用于常规四加二；前者不是所有配装的必修目标。',
  ],
  [
    '作者60级培养参考：防御力2300–2600+；仅对照该攻略参考，不是机制满档线或全局最优。',
    '60级配装参考：防御力2300–2600+；这不是机制满档线或最佳配置。',
  ],
  [
    '攻略128.9%暴击属于专武作者方案，不能不分精炼套用。',
    '128.9%暴击只作该精炼的专武配装参考，其他精炼不能直接套用。',
  ],
  ['攻略专武128.9%暴击不作为当前初始暴击目标。', '专武配装的128.9%暴击不作为当前初始暴击目标。'],
  ['局内接近200%暴击的来源建议包含', '战斗中接近200%暴击需要计入'],
  ['当前等级不同于作者60级参考', '当前等级与60级参考不同'],
  ['来源强化特殊技场景', '强化特殊技触发的场景'],
  ['版攻略参考', '版本的搭配参考'],
  ['历史攻略参考', '较早版本的搭配参考'],
  ['来源条件参考', '条件搭配参考'],
  ['当前仅保留攻略培养方向', '当前仅作培养参考'],
  ['攻略软参考 · ', '配装参考 · '],
  ['仅为攻略参考值', '仅为配装参考值'],
  ['接近攻略参考值', '接近配装参考值'],
  ['来源暴击率参考为', '暴击率参考为'],
  ['当前来源另明确河豚2件方向', '也可尝试河豚2件搭配'],
  ['当前来源在琉音队列为终结技方向', '在琉音队中可尝试终结技搭配'],
  ['来源强化普攻连段前施放EX', '强化普攻连段前需施放强化特殊技'],
  ['来源明确列出的各 2 件替代', '已列出的各 2 件替代'],
  ['旧攻略将「好斗的阿炮」作为', '「好斗的阿炮」可用于'],
  ['旧攻略将「震元奇枢」作为', '「震元奇枢」可用于'],
  ['旧攻略将「春日融融」作为', '「春日融融」可用于'],
  ['历史来源参考，未核准为当前版本优选，不用于自动配装或评分', '查看这套搭配的适用条件。'],
  ['历史来源参考，不用于自动配装或评分', '查看这套搭配的适用条件。'],
  [
    '页面引用Prydwen、Game8或Icy Veins不另计独立来源；不继承Tier、DPS、使用率或最佳队伍声明',
    '具体表现需结合配装和实战条件判断，不能据此认定最佳队伍、精确伤害或使用率高低',
  ],
  ['来源首选支援方向', '可优先尝试的支援方向'],
  ['来源首选', '可优先尝试'],
  ['来源明确的冲击与强化特殊技方向', '冲击与强化特殊技方向'],
  ['非锋御队的来源备选', '非锋御队可尝试的备选'],
  ['锋御队的来源备选', '锋御队可尝试的备选'],
  ['强灼烧来源可靠', '能稳定施加灼烧的队友搭配时可靠'],
  ['3.2来源的直伤方向', '3.2版本的直伤参考方向'],
  ['只保留来源参考，自动匹配沿用', '仅供尝试，自动匹配仍使用'],
  ['不据来源列序判当前收益排名', '列出顺序不代表当前收益排名'],
  ['原文标为月卡音擎', '属于月卡音擎'],
  ['原文限定副词条优秀时的备选', '仅在副词条优秀时可尝试的备选'],
  ['只保留来源参考，自动匹配保留', '仅供尝试，自动匹配仍使用'],
  ['是原文明确的A级替代', '是可尝试的A级替代'],
  [
    '原文单C与辅助方向分别讨论，不把来源列序当统一收益排名',
    '单输出与辅助用途需要分别比较，列出顺序不代表统一收益排名',
  ],
  ['来源讨论的替代方向', '可尝试的替代方向'],
  ['丽娜队的来源建议', '丽娜队的搭配方向'],
  ['来源列出的条件化替代', '需要满足条件的替代搭配'],
  ['（wengine-13005，Steam Oven）', ''],
  ['人为刀俎（人为刀俎，Steam Oven）', '人为刀俎'],
  ['原攻略优先替代方向', '可优先考虑的替代方向'],
  ['原攻略在此精炼下次于满精人为刀俎', '在以下比较条件下，此精炼的表现低于满精人为刀俎'],
  [
    '以上比较来源为洛克茜 + 猩红渴望克拉蕾 + 啜泣摇篮丽娜的作者场景；不把该顺序外推为所有队伍、精炼或正式最优',
    '仅适用于洛克茜 + 猩红渴望克拉蕾 + 啜泣摇篮丽娜；不能外推到其他队伍、精炼或最佳配装',
  ],
  ['其他已归档配装已补为历史参考：', '其他已归档配装：'],
  [
    '自动匹配仍沿用已收录的2+2+2散搭候选；其他已归档配装与操作条件在历史参考中展示。可用不代表当前毕业或唯一优选，同面板收益及当前优先级仍待核验。',
    '自动匹配沿用已收录的2+2+2散搭；其他归档配装和操作条件见历史参考。可用不等于毕业或唯一优选，同面板收益与优先级仍待核验。',
  ],
  ['尚未完成同面板比较，只保留来源参考，自动匹配保留', '同面板比较未完成，自动匹配仍用'],
  ['当前未核验该条件，只保留来源参考，自动匹配沿用', '当前条件未核验，自动匹配仍用'],
  ['属于套装触发条件，不是毕业面板', '属于套装条件，不是毕业目标'],
  ['原文明确的稳定A级替代', '稳定A级替代'],
  ['原文明确为稳定A级替代', '稳定A级替代'],
]

/** Only reviewed recipe sentences supply an extra selection prerequisite. */
export function playerDiscRecipeCondition(sourceText: string | undefined) {
  return conditionExplanations.find(([source]) => source === sourceText)?.[2]
}

function dedupeExactClauses(text: string) {
  const clauses = text.match(/[^；;。！？!?]+[；;。！？!?]?/gu)
  if (!clauses?.length) return text
  const seen = new Set<string>()
  const kept = clauses.filter((clause) => {
    const key = clause.replace(/[；;。！？!?\s]/gu, '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  let result = kept.join('')
  if (/[。！？!?]$/u.test(text) && !/[。！？!?]$/u.test(result)) {
    result = result.replace(/[；;]$/u, '。')
  }
  return result
}

function compactConditionText(text: string) {
  return dedupeExactClauses(
    text
      .replaceAll('生命值、防御力 仅供', '生命值、防御力仅供')
      .replaceAll('；这不代表', '；不代表')
      .replace(/([：:])\s+/gu, '$1')
      .replace(/\s+([，；。])/gu, '$1')
      .replace(/[；;]{2,}/gu, '；'),
  )
}

function playerConditionText(source: string) {
  let text = source
    .replaceAll(
      '未完成同面板与相同输出窗口比较，不据来源列序判当前收益排名',
      '未比对同面板与输出窗口，顺序不代表收益排名',
    )
    .replaceAll(
      '它不是当前面板的能量自动回复数值，不参与局外差距比较',
      '按战斗内回复计，不套用面板数值，不计入局外差距',
    )
  for (const [explanation, playerText] of conditionExplanations) {
    text = text.replaceAll(explanation, playerText)
  }
  text = text
    .replace(
      /原来源版本保留，不证明\s*(\d+\.\d+)\s*meta、运行时、Formal、Import或精确DPS/gu,
      '$1 版本实战效果、最佳配装与精确伤害未确认',
    )
    .replace(
      /HoyoBuild页面标记Version\s*(\d+\.\d+)；主副词与(\d+)级参考面板只用于攻略候选/gu,
      '版本 $1 的主副词条与 $2级面板仅作配装参考',
    )
  return formatDevelopmentEntityText(compactConditionText(text))
}

function isRoxyEnergySummaryCovered(text: string, allTexts: readonly string[]) {
  if (!/^3\.12是满核心上限，2\.88\+用于常规四加二/u.test(text)) return false
  const related = allTexts.filter((candidate) => candidate !== text)
  const fullCoreCapCovered = related.some((candidate) => candidate.includes('3.12达到上限'))
  const energyTargetCovered = related.some((candidate) => candidate.includes('2.88+'))
  const standardPatternCovered = related.some(
    (candidate) =>
      candidate.includes('常规4+2') ||
      candidate.includes('常规四加二') ||
      candidate.includes('四加二'),
  )
  return fullCoreCapCovered && energyTargetCovered && standardPatternCovered
}

function isGenericOptionalStatBoundary(text: string) {
  return text.startsWith('此属性为') && text.includes('可选参考')
}

function isSpecificOptionalStatBoundary(text: string) {
  return /(?:生命值|防御力|攻击力|暴击率|暴击伤害).*(?:基础参考|不需要|不是.*硬线|不是.*毕业目标)/u.test(
    text,
  )
}

function dedupeCoveredConditions(lines: readonly { source: string; text: string }[]) {
  const withoutRepeatedSummary = lines.filter(
    (line) =>
      !isRoxyEnergySummaryCovered(
        line.text,
        lines.map((candidate) => candidate.text),
      ),
  )
  const visible: { source: string; text: string }[] = []
  for (const line of withoutRepeatedSummary) {
    const previousVisible = visible.at(-1)?.text
    if (
      isGenericOptionalStatBoundary(line.text) &&
      previousVisible &&
      isSpecificOptionalStatBoundary(previousVisible)
    ) {
      continue
    }
    visible.push(line)
  }
  return visible
}

/** Keep the original condition and order; translate explanations without weakening prerequisites. */
export function playerConditionLines(values: readonly string[]) {
  const lines = [...new Set(values.map((value) => value.trim()).filter(Boolean))].map((source) => ({
    source,
    text: playerConditionText(source),
  }))
  return dedupeCoveredConditions(lines)
}
