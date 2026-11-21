import { formatDevelopmentEntityText, getPlayerEntityName } from '../application/publicRosterNames'
import { playerFacingAgentLabel, playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { playerErrorMessage } from '../application/playerErrorMessage'
import { playerDecisionText } from './teamEquipmentParameterPresentation'
import { displayableLocalAnalysis } from './teamLocalAnalysisPresentation'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { isCompleteFiniteTeamPlay, type TeamPlayRoleKind } from '../domain/finiteTeamPlayContract'
import { resolveReviewedTeamOutputModule } from '../gameDataPacks/reviewedTeamOutputModuleEvidence'
import { projectReviewedTeamOperationConditions } from './reviewedTeamOperationPresentation'

export function visibleDecisionText(value: string) {
  return formatDevelopmentEntityText(value)
    .replace(/bangboo-[a-z0-9-]+/giu, (bangbooId) => playerFacingBangbooLabel(bangbooId))
    .replace(
      '当前账户已形成版本化队伍与实体盘互斥 Candidate 决策。',
      '当前账户已形成可直接执行的队伍建议。',
    )
    .replace(
      '当前账户决策未同时通过版本化队伍机制与实体盘分配门，结果保持 unsupported。',
      '当前账户尚未同时满足队伍搭配与实体装备条件，暂时无法形成可执行建议。',
    )
    .replaceAll('Account Decision', '本次分析')
    .replaceAll('Team Engine', '队伍分析')
    .replaceAll('Decision', '分析')
    .replaceAll('Claim', '结论')
    .replace(/\s*Candidate\s*强度/gu, '参考强度')
    .replace(/\s*Candidate/gu, '方案')
    .replaceAll('executable', '可执行方案')
    .replace(/\s*unsupported/gu, '暂时无法形成答案')
    .replaceAll('Formal', '完整计算条件')
    .replaceAll('Import', '导入识别结果')
    .replace('版本化队伍与实体盘互斥', '当前队伍搭配与实体装备')
    .replace('版本化队伍机制与实体盘分配门', '队伍搭配与实体装备条件')
    .replace('方案 决策', '队伍建议')
}

type TeamDecisionField = 'reason' | 'condition' | 'gap' | 'action' | 'tradeoff'
type SharedVisibleDecisionField = 'answer' | 'impact' | 'bangboo'
export type TeamVisibleDecisionField = TeamDecisionField | SharedVisibleDecisionField
export type TeamDecisionDiagnostic = { label: string; text: string }
export type TeamDecisionRole = {
  agentId: string
  /** The stable identity remains available to the component without exposing an unknown raw ID. */
  name: string
  label: string
  purpose: string
}
export type TeamDecisionPresentation = {
  reason: string
  roles: TeamDecisionRole[]
  conditions: string[]
  gaps: string[]
  actions: string[]
  tradeoffs: string[]
  diagnostics: TeamDecisionDiagnostic[]
}

const fieldLabels: Record<TeamVisibleDecisionField, string> = {
  reason: '建议依据',
  condition: '使用条件',
  gap: '配装差距',
  action: '下一步',
  tradeoff: '使用取舍',
  answer: '建议结论',
  impact: '装备影响',
  bangboo: '邦布建议',
}
// One boundary for structured presentation fields, rather than DOM-wide rewriting.
// Original research/contract prose is retained only in the named disclosure.
const internalDecisionVocabulary =
  /\b(?:Formal|Import|meta|unsupported|Candidate|AccountAuthority|Account Decision|schema|fnv1a|sha256)\b|(?:source-backed|Mechanic IR|PlanningBaseline)|\b[a-z]+(?:_[a-z0-9]+){2,}\b/iu
const internalFieldPattern =
  /^(?:schema|version|contract(?:Version)?|sourceVersion|sourceContentHash|referenceIdentity|recordId|formulaSha256|sourceRefs|eventIds)\s*[:=]/iu
const completeGenericDecisionPatterns = [
  /^(?:机制协同：)?未观察关系不会被当作硬性排除[。；;]?$/u,
  /^(?:输出潜力：)?不把小数差直接变成队伍名次[。；;]?$/u,
  /^(?:证据置信度：)?取相关维度中的最弱证据带[。；;]?$/u,
  /^先要求队内具名关系与机制闭合，再参考\s*source-backed effect recipient\s*覆盖[。；;]?$/iu,
  /^先要求队内具名关系与机制闭合，再参考\s*source-backed effect recipient\s*覆盖；?不按效果数量相加计分[。；;]?$/iu,
  /^(?:不按效果数量相加计分|综合成员特性\/属性多样性|不采用社区排名)[。；;]?$/u,
  /^阵容适应性：综合成员特性\/属性多样性、具名协同完整度与场景依赖[。；;]?$/u,
  /^参考区间重叠，?不能由下界推出(?:强弱|支配)[。；;]?$/u,
  /^来源(?:仅|只)(?:作|供)?参考(?:说明)?[。；;]?$/u,
  /^本地分析说明：这一大段来源、位阶和校准解释不属于换装影响[。；;]?$/u,
  /^这不是伤害精算[。；;]?$/u,
] as const
const genericSourceOrModelBoundaryPatterns = [
  /^(?:HoyoBuild页面标记Version|页面引用(?:Prydwen|Game8|Icy Veins)).+$/iu,
  /^本条只投影页面直接列出的精确三人成员与明确邦布选项[。；;]?$/u,
  /^不继承页面(?:Tier|强度档位).*(?:DPS|使用率|最佳队伍|独立强度).*$/iu,
  /^不表示当期Boss排名、完整循环DPS、最优装备或账号实际完成度[。；;]?$/iu,
  /^仅适用于本条锁定的成型影画、潜能与现有来源化\d+词条参考[。；;]?$/u,
  /^不是账户观测[。；;]?$/u,
  /^作者全队计算仅作来源观察；.+$/u,
  /^该三人方向不提供独立强度档位、最优音擎或完整循环结论[。；;]?$/u,
  /^该精确三人只确认当前来源收录与条件，不据此输出强度档位[。；;]?$/u,
  /^来源只支持当前可用方向，不给出.+强弱结论[。；;]?$/u,
  /^不由(?:来源|页面|作者).*(?:推导|证明|判断).*(?:强度|档位|排名|DPS).*$/iu,
  /^(?:完整循环|触发次数|持续覆盖|独立强度档位).*(?:未|不).*(?:来源|模型|证据).*$/u,
  /^未证明(?:完整循环|触发次数|持续覆盖|整轮覆盖).*$/u,
  /^(?:现有|当前|现行|本条).{0,24}(?:来源|资料).*只确认.{0,30}(?:成员|邦布).*没有.{0,40}(?:轮转|资源|强度|机制).*$/u,
  /^(?:同来源转载|两分区观测).*只证明.*$/u,
  /^这是有条件的搭配方向[。；;]?$/u,
  /^与另一队的整队高低仍需同条件整体依据[。；;]?$/u,
  /^(?:本地机制与玩法参考|区间重叠不能得出整队胜负).+$/u,
  /^准备态片段只用于相应条件选择[。；;]?$/u,
  /^不伪造后台覆盖或完整循环[。；;]?$/u,
  /^不从单次事件推总DPS[。；;]?$/u,
  /^缺少统一比较证据[。；;]?$/u,
] as const
const noOpActionPattern =
  /^(?:暂无进一步行动|无需进一步处理|先匹配这支队伍的驱动盘，?再确认需要补齐的养成)[。；;]?$/u
const genericWarehousePlaceholderPattern =
  /^(?:尚未为这支队伍匹配仓库|仓库尚未匹配|尚未匹配实体盘|实体盘尚未匹配)，?缺盘与共用情况待核对[。.]?$/u
const ratingOnlyPattern = /^(?:分析评级|评级基于|队伍评级|评级\s*[SAB])/iu
const rawEntityIdPattern = /\b(?:agent|bangboo|wengine|set)-[a-z0-9][a-z0-9-]*/giu
const roleLabels: Record<TeamPlayRoleKind, string> = {
  primary_output: '主要输出',
  support: '支援增益',
  stun: '积累失衡',
  ordinary_anomaly: '施加异常',
  background_output: '场外输出',
  activation_partner: '配合触发',
}

function addDiagnostic(diagnostics: TeamDecisionDiagnostic[], label: string, text: string) {
  const normalizedLabel = `${label}（来源原文）`
  if (!text || diagnostics.some((entry) => entry.label === normalizedLabel && entry.text === text))
    return
  diagnostics.push({ label: normalizedLabel, text })
}

function uniqueLines(lines: readonly string[]) {
  const key = (line: string) =>
    line
      .replace(/^(?:使用条件|使用取舍|条件|取舍)[：:]\s*/u, '')
      .replace(/[\s。；;，,]+/gu, '')
      .toLocaleLowerCase()
  return [...new Map(lines.filter(Boolean).map((line) => [key(line), line] as const)).values()]
}

function joinSentences(lines: readonly string[]) {
  return lines.reduce(
    (text, line) =>
      !text ? line : /[。！？!?；;]$/u.test(text) ? `${text}${line}` : `${text}；${line}`,
    '',
  )
}

function entityTokenLabel(id: string) {
  return getPlayerEntityName(id) ?? null
}

function replaceUnknownEntityIds(value: string) {
  let hasUnknown = false
  const text = value.replace(rawEntityIdPattern, (id) => {
    const name = entityTokenLabel(id)
    if (name) return name
    hasUnknown = true
    return ''
  })
  return { text, hasUnknown }
}

function entityText(value: string) {
  return formatDevelopmentEntityText(value)
    .replace(/bangboo-[a-z0-9-]+/giu, (id) => playerFacingBangbooLabel(id))
    .replace(/^当前攻略明确列出/u, '可用成员：')
    .replace(/^来源(?:Teams\s*&\s*Synergy|HoyoBuild|Prydwen|Game8|Icy Veins)?(?:明确)?列出/u, '')
    .replace(/^来源(?:明确)?将/u, '可选方向：')
    .replace(/^来源(?:明确)?(?:称|认为|指出)/u, '')
    .replace(/^来源(?:明确)?(?:要求|偏好)/u, '')
    .replace(/来源所述/gu, '参考配置中')
    .replace(/source-backed effect recipient\s*覆盖/giu, '有来源支持的受益关系')
    .replace(/\bsource-backed\b/giu, '有来源支持的')
    .replace(/\bMechanic IR\b/giu, '机制资料')
    .replace(/\bPlanningBaseline observation\b/giu, '参考基准观测')
}

function playerFacingGap(gap: string) {
  const normalized = gap.trim()
  const teamMissingDiscs = normalized.match(/^当前队伍方案还没有配齐\s*(\d+)\s*张不同驱动盘。?$/u)
  if (teamMissingDiscs) return `本队还缺 ${teamMissingDiscs[1]} 张驱动盘。`

  const slotShortage = normalized.match(
    /^号位数量不足：(.+?)的\s*(\d+)\s*号位至少需要\s*(\d+)\s*张不同驱动盘，当前符合各自条件的只有\s*(\d+)\s*张。?$/u,
  )
  if (slotShortage) {
    const [, names, slot, required, available] = slotShortage
    return `${names}的${slot}号位还缺 ${Number(required) - Number(available)} 张驱动盘。`
  }

  const setShortage = normalized.match(
    /^套装数量不足：(.+?)在所有允许搭配中合计至少需要\s*(\d+)\s*张「(.+?)」，当前符合各自条件的只有\s*(\d+)\s*张。?$/u,
  )
  if (setShortage) {
    const [, names, required, setName, available] = setShortage
    const missing = Number(required) - Number(available)
    if (missing > 0) return `${names}共缺 ${missing} 张「${setName}」驱动盘。`
  }

  const sharedDiscConflict = normalized.match(
    /^(.+?)(?:[： ]|(?=该角色))该角色有独立合法配装，但其候选实体盘已被更高优先级或先分配角色占用。?$/u,
  )
  if (sharedDiscConflict) return `${sharedDiscConflict[1]}需要的驱动盘与队友重叠。`

  const memberMissingDiscs = normalized.match(
    /^(.+?)[： ]?本次分析\s*(?:没有|未)闭合六张不同实体盘。?$/u,
  )
  if (memberMissingDiscs) return `${memberMissingDiscs[1]}尚未配齐6张驱动盘。`
  if (/^本次分析\s*(?:没有|未)闭合六张不同实体盘。?$/u.test(normalized)) return '驱动盘尚未配齐。'
  return normalized
}

function visibleImpactLines(impacts: string[]) {
  const groups = new Map<
    string,
    { line: string; kinds: Set<string>; name: string; equipment: string }
  >()
  for (const line of new Set(impacts)) {
    const match = line.match(
      /^与(当前方案|已保存方案)「(.+?)」共用(驱动盘|音擎)；保存本队不会改写该方案$/u,
    )
    if (!match) {
      groups.set(line, { line, kinds: new Set(), name: '', equipment: '' })
      continue
    }
    const [, kind, name, equipment] = match as [string, string, string, string]
    const key = `${name}:${equipment}`
    const group = groups.get(key) ?? { line, kinds: new Set<string>(), name, equipment }
    group.kinds.add(kind)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) =>
    group.kinds.size > 1
      ? `与当前及已保存的「${group.name}」方案共用${group.equipment}；保存本队不会改写相关方案`
      : group.line,
  )
}

function decisionSegments(value: string) {
  return value
    .split(/(?<=[。！？!?；;])|\r?\n+/u)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function isGenericDecisionSegment(raw: string, field: TeamVisibleDecisionField) {
  const text = raw.trim().replace(/\s+/gu, ' ')
  if (isGenericWarehousePlaceholder(text)) {
    return field !== 'action' && field !== 'gap' && field !== 'impact'
  }
  if (field === 'action') return noOpActionPattern.test(text)
  if (
    field === 'condition' &&
    (genericSourceOrModelBoundaryPatterns.some((pattern) => pattern.test(text)) ||
      /^.+潜能激发攻略语境[。；;]?$/u.test(text))
  )
    return true
  if (field !== 'reason' && field !== 'tradeoff' && field !== 'answer') return false
  return (
    completeGenericDecisionPatterns.some((pattern) => pattern.test(text)) ||
    genericSourceOrModelBoundaryPatterns.some((pattern) => pattern.test(text))
  )
}

function isInternalDecisionSegment(raw: string, field: TeamVisibleDecisionField) {
  return internalFieldPattern.test(raw) || isGenericDecisionSegment(raw, field)
}

function isGenericWarehousePlaceholder(value: string) {
  const text = value.trim().replace(/\s+/gu, ' ')
  return (
    genericWarehousePlaceholderPattern.test(text) ||
    (/仓库/u.test(text) && /缺盘/u.test(text) && /共用情况待核对/u.test(text))
  )
}

function actionableDecisionText(raw: string, field: TeamVisibleDecisionField) {
  if (field === 'condition') {
    const text = raw
      .replace(/^(.+?)潜能激发[。；;]?$/u, '$1需处于潜能激活状态。')
      .replace(/^套装触发与覆盖单独核对[。；;]?$/u, '先确认套装触发与效果覆盖。')
      .replace(/^(.+?)须在实际目标形成原异常[。；;]?$/u, '$1须在目标上实际形成原异常。')
      .replace(
        /^专属追加结算仍需自身资源，?不凭动作次数或队伍人数自动触发[。；;]?$/u,
        '追加结算还需要自身资源。',
      )
      .replace(
        /^(.+?)须以常规积蓄动作实际形成目标异常[。；;]?$/u,
        '$1须用常规积蓄动作形成目标异常。',
      )
      .replace(/^特殊脱手招式不自动替代[。；;]?$/u, '不能只靠离场招式代替。')
      .replace(/^(.+?)须实际接到增益[。；;]?$/u, '确认$1实际获得增益。')
      .replace(/^护盾或交接增益不默认覆盖全队[。；;]?$/u, '护盾与交接增益只计算实际覆盖的成员。')
      .replace(/^(.+?)实际积累失衡后交接[。；;]?$/u, '$1积累失衡后切回输出。')
      .replace(
        /^失衡期增益只在对应窗口采用，?不预设整轮覆盖或次数[。；;]?$/u,
        '失衡期增益只在失衡期间生效。',
      )
      .replace(
        /^为(.+?)安排实际切入动作，再交还(.+?)[。；;]?$/u,
        '$1短时切入并完成所需动作后，再交回$2。',
      )
      .replace(/^不同时占用完整站场[。；;]?$/u, '')
      .replace(/^(.+?)使用(.+?)积累失衡，再切回(.+?)[。；;]?$/u, '$1使用$2积累失衡，再切回$3输出。')
      .replace(/^未证明每轮失衡次数[。；;]?$/u, '')
      .replace(
        /^(.+?)使用已核对的来源动作积累失衡，再切回(.+?)输出。$/u,
        '$1积累失衡后切回$2输出。',
      )
      .replace(/^(.+?)需实际打出(.+?)并形成普通异常[。；;]?$/u, '$1用$2形成普通异常。')
      .replace(/^仅离场蓄力释放不算自动触发[。；;]?$/u, '离场蓄力不替代这一步。')
      .replace(/^(.+?)短时上场后交回(.+?)，两人不同时按完整站场计算。$/u, '$1短时上场后交回$2。')
      .replace(
        /^(.+?)须具备该后台动作的资源，并由场上角色完成对应触发[。；;]?$/u,
        '$1准备后台动作所需资源，并由场上角色触发。',
      )
      .replace(/^不预设持续覆盖[。；;]?$/u, '')
      .replace(/^(.+?)与(.+?)分配独立操作窗口[。；;]?$/u, '$1与$2分别安排操作时间。')
      .replace(/^不能同时按两人完整站场推算收益[。；;]?$/u, '')
      .replace(
        /^须实际触发闪反并预留霰弹，不预设补弹或窗口次数[。；;]?$/u,
        '需要触发闪避反击，并预留霰弹。',
      )
      .replace(
        /^准备(.+?)所选输出动作的能量或专属资源[。；;]?$/u,
        '为$1的输出动作准备能量或专属资源。',
      )
      .replace(/^不预设连续施放次数[。；;]?$/u, '')
      .trim()
    return text
  }
  if (field === 'tradeoff') {
    return raw.trim()
  }
  if (
    (field === 'action' || field === 'gap' || field === 'impact') &&
    isGenericWarehousePlaceholder(raw)
  ) {
    return field === 'gap'
      ? '进入配装页核对缺盘与共用驱动盘。'
      : '打开配装页核对仓库、缺盘与共用驱动盘。'
  }
  return undefined
}

/**
 * Shared presentation boundary for selected-team prose fields. Unknown raw IDs
 * are replaced in the player surface and retained verbatim in diagnostics.
 */
export function normalizeVisibleDecisionLines(
  values: string | readonly (string | null | undefined)[] | null | undefined,
  field: TeamVisibleDecisionField,
  diagnostics: TeamDecisionDiagnostic[] = [],
) {
  const input = typeof values === 'string' ? [values] : (values ?? [])
  const source =
    field === 'impact'
      ? visibleImpactLines(input.filter((value): value is string => typeof value === 'string'))
      : input
  const visible: string[] = []
  for (const value of source) {
    if (typeof value !== 'string') continue
    const wholeLine = value.trim()
    if (wholeLine && field === 'tradeoff' && ratingOnlyPattern.test(wholeLine)) {
      addDiagnostic(diagnostics, fieldLabels[field], wholeLine)
      continue
    }
    const retained: string[] = []
    for (const raw of decisionSegments(value)) {
      if (
        isInternalDecisionSegment(raw, field) ||
        (field === 'tradeoff' && ratingOnlyPattern.test(raw.trim()))
      ) {
        addDiagnostic(diagnostics, fieldLabels[field], raw)
        continue
      }
      const normalizedSource = raw.trim().replace(/\s+/gu, ' ')
      const unknownReplaced = replaceUnknownEntityIds(normalizedSource)
      if (unknownReplaced.hasUnknown) {
        addDiagnostic(diagnostics, fieldLabels[field], normalizedSource)
        continue
      }
      const translated = entityText(playerDecisionText(unknownReplaced.text))
        .replace(
          /^关键支援与所选输出资源须实际兑现[。；;]?$/u,
          '确认关键支援与主输出所需资源能够稳定衔接，再按实际覆盖率判断收益。',
        )
        .trim()
      const text =
        actionableDecisionText(translated, field) ??
        (field === 'gap' ? playerFacingGap(translated) : translated)
      if (!text || isInternalDecisionSegment(text, field)) continue
      retained.push(text)
    }
    if (retained.length) visible.push(joinSentences(retained))
  }
  const result = uniqueLines(visible)
  if (field !== 'gap') return result
  const namedGap = result.some((line) => line.includes('尚未配齐6张驱动盘'))
  return result.filter(
    (line) =>
      !/^进入队伍后匹配驱动盘[。.]?$/.test(line) && !(namedGap && line === '驱动盘尚未配齐。'),
  )
}

function namedAgent(agentId: string, index: number, diagnostics: TeamDecisionDiagnostic[]) {
  const label = playerFacingAgentLabel(agentId)
  if (label !== '资料待补齐') return label
  addDiagnostic(diagnostics, '成员身份', agentId)
  return `第 ${index + 1} 位成员`
}

// These are clauses from the reviewed exact-team inputs, not inferred rotations.
function reviewedTeamCondition(text: string, agentIds: readonly string[] = []) {
  if ([...agentIds].sort().join('|') === 'agent-lycaon|agent-miyabi|agent-soukaku') {
    if (text === '莱卡恩通过招架入场速切减冰抗、打失衡，苍角消耗涡流后切雅输出。')
      return '莱卡恩招架入场，速切降低冰抗并积累失衡；苍角消耗涡流后切星见雅输出。'
    if (text === '霜寒、霜灼期间切其他属性异常队友打异常可消除霜灼，1影三段蓄力可主动消除。')
      return '星见雅1影时，可用三段蓄力主动消除霜灼。'
    if (
      text === '莱卡恩提供冰抗降低与失衡易伤，苍角触发队友额外能力；常规冰异常与烈霜可以触发紊乱。'
    )
      return '常规冰异常与烈霜可以触发紊乱。'
  }
  if (text === '保留猫又潜能至少1级的来源条件，不将个人潜能收益写成无条件三人强度。')
    return '猫又需要至少1级潜能。'
  if (
    text ===
    '南宫羽/柚叶方向保留作者成员；缺其他异常或同阵营队友，不能宣称激活菲欧妮额外能力，暂不分档。'
  )
    return '这组队伍缺少额外的异常或同阵营队友，菲欧妮的额外能力不能视为已激活。'
  if (text === '菲欧妮按1影、核心7、初始异常掌控255.36成型参考；需维持20秒灼蚀，重复异常命中刷新。')
    return '菲欧妮的参考配置为1影、核心技7级、初始异常掌控255.36；维持灼蚀，重复异常命中可刷新20秒持续时间。'
  if (
    text ===
    '另一位异常或同阵营队友激活黑枝王牌；支援效果按实际切人顺序维持，站场分配是玩法条件，未完成数值循环验证。'
  )
    return '另一名异常或同阵营队友可激活黑枝王牌；按实际切人顺序维持支援效果。'
  if (
    text ===
    '莱卡恩潜能解锁（Potential Unlock）为搭配克拉蕾的前提，使其增益与锋御特性兼容；莱卡恩前台与后台均可积攒失衡，并可提供快速支援触发星声。'
  )
    return '莱卡恩需要解锁潜能以配合克拉蕾；他可在前台或后台积攒失衡，也可用快速支援触发星声。'
  if (
    text ===
    '核心协同依赖扳机装备专武提供减防（DEF Shred），且依赖站场时间与增减益覆盖管理；该前提默认不自动开启，不能由扳机改为追加攻击主输出，克拉蕾仍为主输出。'
  )
    return '扳机需要装备专属音擎才能提供这项减防；注意切人时间与增减益覆盖，由克拉蕾负责主要输出。'
  return null
}

/** Exact-team source statements; taxonomy and generic role labels do not establish a rotation. */
function reviewedTeamPlay(agentIds: readonly string[]) {
  if (agentIds.length !== 3 || new Set(agentIds).size !== 3) return ''
  const ids = [...agentIds].sort() as [string, string, string]
  const source = resolveReviewedTeamOutputModule(ids)
  if (source?.status !== 'classified' || !source.sourceEvidence?.length) return ''
  const text = source.sourceEvidence.map((entry) => entry.text)
  const key = ids.join('|')
  if (
    key === 'agent-nicole|agent-promeia|agent-soukaku' &&
    text.some((s) => s.startsWith("Nicole's DEF Shred is easy"))
  )
    return '妮可的减防可配合普罗米娅的绽放爆发；苍角提供攻击与冰伤增益。'
  if (
    key === 'agent-anby|agent-aria|agent-nicole' &&
    text.some((s) => s.startsWith('Anby provides the Stuns'))
  )
    return '安比积累失衡，妮可提供减防。'
  if (
    key === 'agent-alice|agent-corin|agent-nicole' &&
    text.some((s) => s.startsWith('Corin adds Physical damage'))
  )
    return '可琳补充物理伤害，帮助打出强击；妮可提供减防。'
  if (
    key === 'agent-jane|agent-seth|agent-yuzuha' &&
    text.some((s) => s.startsWith('Game8’s Assault team. Seth'))
  )
    return '赛斯为简提供护盾与异常精通；他的额外能力可降低异常积蓄抗性。'
  if (
    key === 'agent-grace|agent-nangong|agent-yuzuha' &&
    text.some((s) => s.startsWith("Nangong's reliable Stuns"))
  )
    return '南宫羽积累失衡后，格莉丝可在爆发窗口使用终结技与绽放；柚叶协助触发紊乱。'
  if (
    key === 'agent-anton|agent-grace|agent-qingyi' &&
    text.some((s) => s.startsWith('Grace keeps enemies Shocked'))
  )
    return '格莉丝让敌人保持感电，以满足安东的额外能力；青衣积累失衡并提高失衡伤害倍率。'
  if (
    key === 'agent-ben|agent-lighter|agent-lucy' &&
    text.some((s) => s.startsWith('An all-Fire team with Ben'))
  )
    return '莱特延长失衡窗口后，本可在其中使用两次强化特殊技；露西提供攻击增益与连携配合。'
  if (
    source.classification === 'historical_exact_team_review' &&
    [
      'agent-hugo|agent-lycaon|agent-trigger',
      'agent-hugo|agent-lighter|agent-qingyi',
      'agent-hugo|agent-lucy|agent-qingyi',
    ].includes(key) &&
    text.includes('终结技：渎神者（衔接失衡后使用）')
  )
    return '历史攻略参考：敌人失衡后，雨果使用终结技。'
  if (
    key === 'agent-hugo|agent-ju-fufu|agent-lycaon' &&
    text.includes('雨果施放【强化特殊技】【终结技】均能触发决算') &&
    text.includes('雨果的核心出伤机制是【决算】，将剩余失衡时间转化为额外伤害')
  )
    return '历史攻略参考：敌人失衡时，雨果可用强化特殊技或终结技触发决算，将剩余失衡时间转化为额外伤害。'
  if (
    key === 'agent-ju-fufu|agent-lighter|agent-soldier-11' &&
    text.some((s) => s.includes('通过有节奏地施放普攻可持续打出火刀'))
  )
    return '历史攻略参考：11号按节奏使用普攻打出火刀；橘福福提供增益。'
  return ''
}

/** Selected-item presentation only: preserve IDs, eligibility, investment and ordering. */
export function presentTeamDecision(item: TeamLoadoutOverviewItem): TeamDecisionPresentation {
  const diagnostics: TeamDecisionPresentation['diagnostics'] = []
  const lines = (
    values: string | readonly (string | null | undefined)[] | null | undefined,
    field: TeamDecisionField,
  ) => normalizeVisibleDecisionLines(values, field, diagnostics)
  const play = item.playDirection
  const playMatches =
    item.agentIds.length === 3 &&
    isCompleteFiniteTeamPlay(play, [...item.agentIds].sort().join('|'))
  const analysis = displayableLocalAnalysis(
    item.ratingAnalysis,
    item.teamRatingBand,
    item.confidence,
    item.mechanicValidity,
  )
    ? item.ratingAnalysis
    : undefined
  const reasonSources = [
    playMatches && play ? play.reason : null,
    item.reason === item.stateLabel ? null : item.reason,
    analysis?.rationale,
    ...(item.authorityReasons ?? []),
  ]
  const reasonLines = lines(reasonSources, 'reason')
  for (const raw of [...reasonSources.slice(1), item.why]) {
    if (raw && raw !== reasonLines[0]) addDiagnostic(diagnostics, '建议依据', raw)
  }
  const sourceConditions = [...(item.sourceConditions ?? []), ...(analysis?.conditions ?? [])]
  // A finite-model handoff is not an observed team rotation. Retain only a
  // concrete named action whose source contract establishes its individual effect.
  const playSteps =
    playMatches && play
      ? play.conditions.flatMap((condition) => {
          if (condition.kind !== 'field_handoff') return []
          const match = condition.label.match(/^(.+?)使用(.+?)积累失衡，再切回.+?；/u)
          if (!match || /来源|[A-Za-z]/u.test(match[2]!)) return []
          return [`${match[1]}可使用${match[2]}积累失衡。`]
        })
      : []
  const exactTeamPlay = reviewedTeamPlay(item.agentIds)
  const reviewedOperationLines = lines(
    projectReviewedTeamOperationConditions(item.agentIds, [
      ...sourceConditions,
      ...(exactTeamPlay ? [exactTeamPlay] : []),
    ]),
    'condition',
  )
  const reviewedConditions = sourceConditions.flatMap((text) => {
    const reviewed = reviewedTeamCondition(text.trim(), item.agentIds)
    return reviewed ? [reviewed] : []
  })
  const sourceClauses = lines(
    sourceConditions
      .filter((text) => !reviewedTeamCondition(text.trim(), item.agentIds))
      .flatMap(decisionSegments),
    'condition',
  )
  const sourceSteps = sourceClauses.filter(
    (text) =>
      /(?:先.+再|后切|后交|随后|然后|之前|之后|失衡前|失衡期|站场|染(?:冰|火|电|以太|色)|施放|释放|触发|切入|切回|切人|切.{0,8}输出|快速支援|连携|帷幕|蓄力|攒到|积攒|积累|登场|特殊技|结算(?:紊乱|异常)|提供.{0,12}(?:增益|减防|异常|失衡)|该流程不可当0影基线)/u.test(
        text,
      ) &&
      !/(?:来源|攻略|计算|评级|排名|证明|模型|DPS|版本|闭合|推断|外推|不预设|尚待确认|未完成.{0,12}循环)/iu.test(
        text,
      ),
  )
  const prerequisites = sourceClauses.filter(
    (text) =>
      /(?:潜能|影画|音擎|暴击率|能量恢复)|(?:需要|必须|仅限|至少|要求|依赖).{0,35}(?:同队|阵营|装备|等级|触发|减防|资源|异常|灼蚀)/u.test(
        text,
      ) &&
      !/(?:来源|攻略|计算|评级|排名|证明|模型|DPS|版本|闭合|不预设|尚待确认|需先确认潜能激活状态)/iu.test(
        text,
      ),
  )
  const conditions = [
    ...(play && !playMatches ? ['玩法说明与当前成员不一致，请重新分析后核对。'] : []),
    ...(play && !playMatches
      ? []
      : [
          joinSentences(uniqueLines([exactTeamPlay, ...sourceSteps, ...playSteps])),
          ...reviewedOperationLines,
          joinSentences(
            uniqueLines([
              ...reviewedConditions,
              ...prerequisites.filter((text) => !sourceSteps.includes(text)),
            ]),
          ),
        ]),
  ].filter(Boolean)
  if (!conditions.length) addDiagnostic(diagnostics, '使用条件', '操作循环资料尚未确认。')
  for (const raw of sourceConditions) addDiagnostic(diagnostics, '使用条件', raw)
  const primaryActions = play && !playMatches ? [] : lines(item.primaryActions, 'action')
  const nextAction = play && !playMatches ? [] : lines(item.authorityNextAction, 'action')
  const advice = lines(item.advice, 'action')
  const redundantAuthorityAction =
    typeof item.authorityNextAction === 'string' &&
    noOpActionPattern.test(item.authorityNextAction.trim())
  const actions = primaryActions.length
    ? primaryActions
    : nextAction.length
      ? nextAction
      : redundantAuthorityAction
        ? []
        : advice
  for (const raw of [item.authorityNextAction, item.advice]) {
    if (raw && !actions.includes(raw)) addDiagnostic(diagnostics, '下一步', raw)
  }
  const roles: TeamDecisionRole[] = item.agentIds.slice(0, 3).map((agentId, index) => {
    const name = namedAgent(agentId, index, diagnostics)
    const sourcedRole =
      playMatches && play ? play.roles.find((candidate) => candidate.agentId === agentId) : null
    if (!sourcedRole)
      return {
        agentId,
        name,
        label: '',
        purpose: '',
      }
    const purpose = lines(sourcedRole.purpose, 'reason')[0] ?? ''
    return {
      agentId,
      name,
      label: roleLabels[sourcedRole.role],
      purpose,
    }
  })
  return {
    reason: reasonLines[0] || '先查看这队的配装与使用条件。',
    roles,
    conditions,
    gaps: lines(item.gaps, 'gap'),
    actions,
    tradeoffs: uniqueLines([
      ...lines(playMatches && play ? play.tradeoffs : [], 'tradeoff'),
      ...lines(item.authorityTradeoffs, 'tradeoff'),
      ...lines(analysis?.limitations ?? [], 'tradeoff'),
    ]),
    diagnostics,
  }
}

export function presentTeamPreparationError(message: string, saved: boolean) {
  const fallback = saved
    ? '暂时无法打开这份保存方案。原记录仍保留，请重试。'
    : '这次配装暂时没有完成，当前选择仍保留，请重试。'
  return internalDecisionVocabulary.test(message) ? fallback : playerErrorMessage(message, fallback)
}
