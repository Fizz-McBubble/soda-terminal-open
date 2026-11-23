import { useId, useState } from 'react'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { EffectDescription } from '../../components/EffectDescription'
import { playerConditionLines } from '../../application/playerDecisionPresentation'
import { currentDriveDiscRecommendationCatalog } from '../../gameDataPacks/currentDriveDiscRecommendationCatalog'
import { DevelopmentDiscMainStats } from './DevelopmentDiscMainStats'
import type { GoldenWorkbenchData } from './types'
import './DevelopmentDiscGuide.css'

type DiscGuide = GoldenWorkbenchData['graduation']['discs']
const discTextReplacements: readonly [string, string][] = [
  [
    '最大核心的回能转换上限可从技能静态系数推导为初始回能 3.12；其他核心等级不能沿用该上限。',
    '核心7级时，初始能量自动回复达到3.12可吃满冲击力转换；其他核心等级所需回能不同。',
  ],
  [
    '最大核心的团队暴伤 / 锐暴转换在百分之百暴击率达到上限；不是所有核心等级通用的毕业面板。',
    '核心7级时，暴击率达到100%可吃满团队暴伤与锐暴转换；其他核心等级按对应上限培养。',
  ],
  [
    '回能与暴击率先满足真实机制，不能因击破特性直接套用冲击力六号位的通用模板。',
    '6号位选择能量自动回复，优先满足核心所需的回能与暴击率。',
  ],
  ['泛用成型采用Owner复核M1、Lv60、基础技能11、核心7及S音擎P1；A级队友按A6，均非账户观测。', ''],
  ['没有精确来源三人及邦布时不补默认队伍', ''],
  [
    'M2自身对灼蚀目标增伤及自身灼烧延长单列，不推算精确抽取收益或全队DPS',
    'M2自身对灼蚀目标增伤并延长自身灼烧',
  ],
  ['丽娜队的来源建议', '丽娜队可选'],
  ['来源列出的条件化替代', '可选副套'],
  ['适用于丽娜队，减防队需重新比较', '丽娜队适用；减防队可比较穿透率和其他副套'],
  ['来源明确列出的各 2 件替代', '可选副套'],
  ['保留已采用3.1两件套候选，当前来源另明确河豚2件方向', '可选河豚电音2件'],
  ['当前来源在琉音队列为终结技方向', '与琉音同队时，可利用终结技后的攻击增益'],
  ['来源强化普攻连段前施放EX', '普攻连段前发动强化特殊技'],
  [
    '炎狱重金属2件是原文限定副词条优秀时的备选；尚未完成同面板比较，只保留来源参考，自动匹配保留折枝剑歌或啄木鸟电音副套',
    '炎狱重金属2件副词条优秀时可选',
  ],
  [
    '自动匹配仍沿用已收录的2+2+2散搭候选；其他已归档配装与操作条件在历史参考中展示。可用不代表当前毕业或唯一优选，同面板收益及当前优先级仍待核验。',
    '',
  ],
  [
    '其他已归档配装已补为历史参考：激素4/河豚4及其明确副套、啄木鸟4+折枝2、另一套2+2+2。未完成同面板与相同输出窗口比较，不据来源列序判当前收益排名。',
    '',
  ],
  [
    '比较时应保持同一音擎、主副词条预算及队伍，分别核对入场、终结技与失衡窗口，不能假设全程增益。',
    '',
  ],
  ['耀嘉音、妮可循环下可考虑，不能按满层常驻比较', '耀嘉音、妮可循环下可考虑'],
  ['当前未核验该条件，只保留来源参考，自动匹配沿用自由蓝调4件方向', ''],
  ['不把原文举例视为角色具备施加灼烧的证明', ''],
  ['来源首选支援方向', '支援方向'],
  ['来源首选，', ''],
  ['3.2来源的直伤方向', '直伤方向'],
  [
    '需要支援队员或被击飞后的快速支援叠层与传递，效果未确认常驻',
    '需要支援队员或被击飞后的快速支援叠层与传递',
  ],
  ['来源强化特殊技场景，连携也可触发，覆盖未知不默认常驻', '强化特殊技或连携技可触发'],
  ['补异常精通，按完整面板和副词条取舍', '补异常精通'],
  ['补攻击，按完整面板和副词条取舍', '补攻击'],
  ['按队伍和词条比较', ''],
  ['历史攻略参考', '可选方向'],
]
const playerGuideText = (value: string) => {
  let text = value
  for (const [source, replacement] of discTextReplacements)
    text = text.replaceAll(source, replacement)
  return (playerConditionLines([text])[0]?.text ?? '')
    .replace(/^[；;。\s]+|[；;。\s]+$/gu, '')
    .replace(/[；;]{2,}/gu, '；')
}
const playerDiscPriorityText = (value: string) =>
  playerGuideText(value)
    .replace(
      /(?:换套后攻击约\s*([\d.]+)[；;]\s*)?(\d+)仅为配装参考值，可优先补攻击，但不作为已验证硬门槛[。.]?/gu,
      (_, projected, target) =>
        `${projected ? `换套后攻击约 ${projected}；` : ''}攻击力可参考 ${target}，优先补攻击。`,
    )
    .replace(
      /接近配装参考值\s*(\d+)\s*后可按缺口补([^；。]+)[；;]不据此判定达标[。.]?/gu,
      '接近 $1 后，可按缺口补$2。',
    )
const discSetAliases = currentDriveDiscRecommendationCatalog
  .flatMap((set) =>
    set.aliases.filter((alias) => alias !== set.name).map((alias) => [alias, set.name] as const),
  )
  .sort(([left], [right]) => right.length - left.length)
const escapedAlias = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function localizeDiscTerms(value: string) {
  let text = playerGuideText(value)
  for (const [alias, name] of discSetAliases)
    text = text.replace(new RegExp(`\\b${escapedAlias(alias)}\\b`, 'giu'), name)
  return text
    .replace(/\d+\.\d+版攻略参考[：:]/gu, '')
    .replace(/\d+\.\d+版参考/gu, '可选方向')
    .replace(/\b(?:Icy Veins|Prydwen|Game8)\b/giu, '')
    .replace(/\bDPS\b/giu, '输出')
    .replace(/\bEX\b/giu, '强化特殊技')
    .replace(/\s+/gu, ' ')
    .trim()
}
function removeRepeatedSetCombination(value: string) {
  const text = localizeDiscTerms(value)
    .replace(/^(?:游戏内推荐|推荐搭配)\s*[：:]\s*/u, '')
    .replace(/[。.;；]\s*$/u, '')
    .trim()
  const marker = text.search(/[（(；;，,。：:]/u)
  if (marker > 0 && /\d+\s*件/u.test(text.slice(0, marker))) {
    const delimiter = text[marker]
    if (delimiter === '（' || delimiter === '(') {
      const close = delimiter === '（' ? '）' : ')'
      const end = text.indexOf(close, marker + 1)
      if (end > marker) {
        return `${text.slice(marker + 1, end)}${text.slice(end + 1)}`
          .replace(/^[；;。\s]+/u, '')
          .trim()
      }
    }
    return text.slice(marker + 1).trim()
  }
  if (/^[^；;。]*\d+\s*件[^；;。]*$/u.test(text)) return ''
  return text
}
function informativeExplanation(value: string | undefined) {
  if (!value) return ''
  const text = removeRepeatedSetCombination(value)
  if (!/[\u3400-\u9fff]/u.test(text)) return ''
  const clauses = text.match(/[^；;。]+[；;。]?/gu) ?? []
  return clauses
    .filter((clause) => /[\u3400-\u9fff]/u.test(clause))
    .join('')
    .replace(/^[；;。\s]+|[；;。\s]+$/gu, '')
    .replace(/[；;]{2,}/gu, '；')
}
// These source-provenance notes do not describe a choice or condition for the player.
const internalDirectionNotes = [
  /仅沿用已成形的一般培养参考[；;]\s*原来源版本保留，不证明\s*\d+\.\d+\s*meta、运行时、Formal、Import或精确DPS[。.]?/gu,
  /游戏内slot4\/slot2表示4件\/2件套[；;]part4\/part5\/part6按属性合法性映射，不作物理盘位[。.]?/gu,
  /HoyoBuild页面标记Version\s*\d+\.\d+[；;]只采用页面明确列出的4\+2套装分支、件数、主副词与条件[。.]?/gu,
  /页面引用Prydwen、Game8或Icy Veins不另计独立来源[；;]不继承Tier、DPS(?:、使用率)?或最佳队伍声明[。.]?/gu,
  /\d+\.\d+页面的明确构筑与已锁定机制交叉核对[；;]不据此声明全队强度、全局最优或完整循环[。.]?/gu,
  /HoyoBuild页面标记Version\s*\d+\.\d+[；;]主副词与\d+级参考面板只用于攻略候选[。.]?/gu,
]
function playerDirectionNote(note: string | undefined) {
  let text = note ?? ''
  for (const pattern of internalDirectionNotes) text = text.replace(pattern, '')
  text = text.replace(/^[；;。\s]+|[；;。\s]+$/gu, '').replace(/[；;]{2,}/gu, '；')
  return text ? playerGuideText(text) : ''
}
type DiscSet = DiscGuide['sets'][number]
type DiscPiece = {
  entityId: string
  name: string
  effect: string
  count: 2 | 4
}
type DiscOption = Pick<
  DiscSet,
  | 'label'
  | 'warehouseRank'
  | 'recommendationPriority'
  | 'recommendationExplicitlyRanked'
  | 'recommendationPurpose'
  | 'recommendationConditionHint'
  | 'recommendationExplanation'
  | 'twoPiecePriority'
> & {
  pieces: DiscPiece[]
  fourPiece?: DiscPiece
  twoPiece?: DiscPiece
}
const effectKey = (piece: { entityId: string; count: number; effect: string }) =>
  JSON.stringify([piece.entityId, piece.count, piece.effect])

const purposeOrder = (option: DiscOption) =>
  option.recommendationPurpose === 'historical'
    ? 3
    : option.recommendationPurpose === 'conditional'
      ? 2
      : option.recommendationPurpose === 'transition'
        ? 1
        : 0
const sourcePriority = (option: DiscOption) =>
  option.recommendationExplicitlyRanked && Number.isFinite(option.recommendationPriority)
    ? option.recommendationPriority!
    : Infinity
const secondaryOrder = (option: DiscOption) => option.twoPiecePriority?.order ?? Infinity

function optionPriorityLabel(set: DiscOption) {
  if (set.recommendationPurpose === 'transition') return '过渡参考'
  if (set.recommendationPurpose === 'conditional') return '条件搭配'
  if (set.recommendationPurpose === 'historical') return '历史参考'
  if (set.recommendationExplicitlyRanked)
    return set.recommendationPriority === 0 ? '首选搭配' : '备选搭配'
  return /达标|不足|先核对|来源条件|软参考/u.test(set.twoPiecePriority?.label ?? '')
    ? '按面板选'
    : ''
}

type PairOption = DiscOption & {
  fourPiece: DiscPiece
  twoPiece: DiscPiece
}
type PrimarySetGroup = {
  key: string
  primary: DiscPiece
  options: PairOption[]
}

const isPairOption = (option: DiscOption): option is PairOption =>
  Boolean(option.fourPiece && option.twoPiece)
const isCompositeOption = (option: DiscOption) => !option.fourPiece && option.pieces.length > 1

/** Keep choices visible and the complete explanation beside the choice it describes. */
export function DevelopmentDiscGuide({
  guide,
  onSelectDirection,
}: {
  guide: DiscGuide
  onSelectDirection?: (directionId: string) => void | Promise<void>
}) {
  const choiceId = useId()
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const directionNote = playerDirectionNote(guide.directionNote)
  const rawOptions: DiscOption[] = guide.sets.map((set) => {
    const pieces = set.pieces
      ? set.pieces
      : [
          { ...set.fourPiece, count: 4 as const },
          { ...set.twoPiece, count: 2 as const },
        ]
    return {
      ...set,
      fourPiece: set.fourPiece ? { ...set.fourPiece, count: 4 as const } : undefined,
      twoPiece: set.twoPiece ? { ...set.twoPiece, count: 2 as const } : undefined,
      pieces,
    }
  })
  // Source priority is only a presentation order, never a calculated output ranking.
  rawOptions.sort(
    (left, right) =>
      purposeOrder(left) - purposeOrder(right) ||
      sourcePriority(left) - sourcePriority(right) ||
      secondaryOrder(left) - secondaryOrder(right),
  )
  const pairOptions = rawOptions.filter(isPairOption)
  const compositeOptions = rawOptions.filter(isCompositeOption)
  const groups: PrimarySetGroup[] = []
  for (const option of pairOptions) {
    const key = option.fourPiece.entityId || option.fourPiece.name
    const existing = groups.find((group) => group.key === key)
    if (existing) existing.options.push(option)
    else groups.push({ key, primary: option.fourPiece, options: [option] })
  }
  const choices = [
    ...groups.map((group) => ({
      key: group.key,
      label: `${group.primary.name} 4件套`,
    })),
    ...(compositeOptions.length ? [{ key: 'composite', label: '2+2+2 三套搭配' }] : []),
  ]
  const activeGroup = choices.find((choice) => choice.key === selectedGroup)?.key ?? choices[0]?.key
  const activePrimary = groups.find((group) => group.key === activeGroup)
  const otherConfigurationAlternatives = (guide.mainStatAlternatives ?? []).filter(
    (alternative) =>
      alternative.scope &&
      !groups.some(
        (group) =>
          alternative.scope!.primarySetIds.includes(group.primary.entityId) &&
          (!alternative.scope!.secondarySetIds ||
            group.options.some((option) =>
              alternative.scope!.secondarySetIds!.includes(option.twoPiece.entityId),
            )),
      ),
  )
  const statAlternatives = (guide.mainStatAlternatives ?? []).filter((alternative) => {
    const scope = alternative.scope
    if (!scope) return true
    return Boolean(
      activePrimary &&
      scope.primarySetIds.includes(activePrimary.primary.entityId) &&
      (!scope.secondarySetIds ||
        activePrimary.options.some((option) =>
          scope.secondarySetIds!.includes(option.twoPiece.entityId),
        )),
    )
  })
  const renderSecondaryCard = (
    set: PairOption,
    commonExplanation: string,
    commonCondition: string,
  ) => {
    const priorityLabel = optionPriorityLabel(set)
    const explanation = informativeExplanation(set.recommendationExplanation)
    const uniqueExplanation = explanation === commonExplanation ? '' : explanation
    const priorityExplanation = set.twoPiecePriority
      ? playerDiscPriorityText(set.twoPiecePriority.reason)
      : ''
    const condition =
      set.recommendationConditionHint !== commonCondition && set.recommendationConditionHint
        ? localizeDiscTerms(set.recommendationConditionHint)
        : ''
    const hasDetail = Boolean(uniqueExplanation || priorityExplanation)
    return (
      <li
        className="disc-guide__secondary-card"
        data-primary-set={set.fourPiece.entityId}
        data-secondary-set={set.twoPiece.entityId}
        data-purpose={set.recommendationPurpose ?? 'recommended'}
        data-condition={set.recommendationConditionHint ?? ''}
        key={JSON.stringify([
          set.label,
          set.recommendationConditionHint,
          set.recommendationExplanation,
          set.pieces.map(effectKey),
        ])}
      >
        <VisualEntityImage
          className="recommendation-item-icon"
          entityType="drive_disc_set"
          entityId={set.twoPiece.entityId}
          name={set.twoPiece.name}
        />
        <div className="disc-guide__secondary-copy">
          <div className="disc-guide__secondary-heading">
            <b>{set.twoPiece.name} 2件套</b>
            {priorityLabel ? <small className="disc-priority">{priorityLabel}</small> : null}
            {condition ? <span className="disc-guide__condition">{condition}</span> : null}
          </div>
          {set.twoPiece.effect ? (
            <p className="disc-guide__secondary-effect">
              <EffectDescription text={set.twoPiece.effect.replace(/[。.]\s*$/, '')} />
            </p>
          ) : null}
        </div>
        {hasDetail ? (
          <ExplanationPopover
            label="搭配说明"
            title={`${set.fourPiece.name} 4件 + ${set.twoPiece.name} 2件`}
          >
            {uniqueExplanation ? (
              <p>
                <EffectDescription text={uniqueExplanation} />
              </p>
            ) : null}
            {priorityExplanation ? (
              <p>
                <EffectDescription text={priorityExplanation} />
              </p>
            ) : null}
          </ExplanationPopover>
        ) : null}
      </li>
    )
  }
  const renderPrimaryGroup = (group: PrimarySetGroup) => {
    const localizedExplanations = group.options.map((option) =>
      informativeExplanation(option.recommendationExplanation),
    )
    const firstExplanation = localizedExplanations[0] ?? ''
    const commonExplanation =
      firstExplanation &&
      localizedExplanations.every((explanation) => explanation === firstExplanation)
        ? firstExplanation
        : ''
    const firstCondition = group.options[0]?.recommendationConditionHint ?? ''
    const commonCondition =
      firstCondition &&
      group.options.every((option) => option.recommendationConditionHint === firstCondition)
        ? firstCondition
        : ''
    const heading = group.options.every(
      (option) =>
        option.recommendationExplicitlyRanked &&
        option.recommendationPriority === 0 &&
        option.recommendationPurpose !== 'conditional' &&
        option.recommendationPurpose !== 'transition',
    )
      ? '首选主套'
      : '主套'
    return (
      <section className="disc-guide__primary-group" data-primary-set={group.key} key={group.key}>
        <header className="disc-guide__primary-heading">
          <VisualEntityImage
            className="recommendation-item-icon"
            entityType="drive_disc_set"
            entityId={group.primary.entityId}
            name={group.primary.name}
          />
          <div>
            <small>{heading}</small>
            <strong>{group.primary.name} 4件套</strong>
          </div>
          {group.primary.effect || commonExplanation ? (
            <ExplanationPopover
              label="主套说明"
              title={`${group.primary.name} 4件套说明`}
              align="start"
            >
              {group.primary.effect ? (
                <section>
                  <strong>4件套效果与触发条件</strong>
                  <p>
                    <EffectDescription text={group.primary.effect} />
                  </p>
                </section>
              ) : null}
              {commonExplanation ? (
                <section>
                  <strong>搭配要点</strong>
                  <p>
                    <EffectDescription text={commonExplanation} />
                  </p>
                </section>
              ) : null}
            </ExplanationPopover>
          ) : null}
        </header>
        {commonCondition ? (
          <p className="disc-guide__group-condition">{localizeDiscTerms(commonCondition)}</p>
        ) : null}
        <ul className="disc-guide__secondary-list">
          {group.options.map((option) =>
            renderSecondaryCard(option, commonExplanation, commonCondition),
          )}
        </ul>
      </section>
    )
  }
  const renderCompositeCard = (set: DiscOption) => {
    const explanation = set.recommendationExplanation
      ? localizeDiscTerms(set.recommendationExplanation)
      : ''
    const condition = set.recommendationConditionHint
      ? localizeDiscTerms(set.recommendationConditionHint)
      : ''
    return (
      <section
        className="disc-guide__composite-option"
        data-pieces={set.pieces.map((piece) => piece.entityId).join('|')}
        data-purpose={set.recommendationPurpose ?? 'recommended'}
        data-condition={set.recommendationConditionHint ?? ''}
        key={JSON.stringify(set.pieces.map(effectKey))}
      >
        {(set.pieces.length > 3 && compositeOptions.length > 1) ||
        condition ||
        set.recommendationPurpose === 'conditional' ? (
          <div className="disc-guide__secondary-heading">
            {set.recommendationPurpose === 'conditional' ? (
              <small className="disc-priority">条件搭配</small>
            ) : null}
            {set.pieces.length > 3 && compositeOptions.length > 1 ? <span>任选3套</span> : null}
            {condition ? <span className="disc-guide__condition">{condition}</span> : null}
          </div>
        ) : null}
        <ul className="disc-guide__secondary-list disc-guide__composite-list">
          {set.pieces.map((piece) => (
            <li className="disc-guide__secondary-card" key={effectKey(piece)}>
              <VisualEntityImage
                className="recommendation-item-icon"
                entityType="drive_disc_set"
                entityId={piece.entityId}
                name={piece.name}
              />
              <div className="disc-guide__secondary-copy">
                <div className="disc-guide__secondary-heading">
                  <b>{piece.name} 2件套</b>
                </div>
                {piece.effect ? (
                  <p className="disc-guide__secondary-effect">
                    <EffectDescription text={piece.effect} />
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {explanation ? (
          <ExplanationPopover label="搭配说明">
            <p>
              <EffectDescription text={explanation} />
            </p>
          </ExplanationPopover>
        ) : null}
      </section>
    )
  }
  return (
    <article className="loadout-recommendation-card loadout-recommendation-card--discs disc-guide">
      <header className="disc-guide__heading">
        <h3>驱动盘建议</h3>
        <div className="disc-guide__actions">
          {directionNote || otherConfigurationAlternatives.length ? (
            <ExplanationPopover label="搭配说明" title="驱动盘搭配与主词条说明">
              {otherConfigurationAlternatives.map((alternative) => (
                <section key={alternative.sourceId} data-main-stat-source={alternative.sourceId}>
                  <strong>其他配置 · {alternative.label}</strong>
                  <p>{playerGuideText(alternative.condition)}</p>
                </section>
              ))}
              {directionNote ? (
                <p>
                  <EffectDescription text={directionNote} />
                </p>
              ) : null}
            </ExplanationPopover>
          ) : null}
        </div>
      </header>
      {guide.unavailableReason && <p role="status">{guide.unavailableReason}</p>}
      {choices.length > 1 ? (
        <div className="disc-guide__choices" role="group" aria-label="主套选择">
          {choices.map((choice, index) => (
            <button
              type="button"
              key={choice.key}
              aria-pressed={choice.key === activeGroup}
              aria-controls={`${choiceId}-${index}`}
              onClick={() => {
                if (choice.key !== activeGroup) setSelectedGroup(choice.key)
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
      <DevelopmentDiscMainStats
        mainStats={guide.mainStats}
        alternatives={statAlternatives}
        groupKey={activeGroup}
        onSelectDirection={onSelectDirection}
      />
      <div
        className="disc-guide__groups"
        key={activeGroup}
        data-motion-selection={selectedGroup === activeGroup ? '' : undefined}
      >
        {groups.map((group, index) => (
          <div id={`${choiceId}-${index}`} key={group.key} hidden={activeGroup !== group.key}>
            {renderPrimaryGroup(group)}
          </div>
        ))}
        {compositeOptions.length ? (
          <div id={`${choiceId}-${groups.length}`} hidden={activeGroup !== 'composite'}>
            <section className="disc-guide__primary-group disc-guide__primary-group--composite">
              <header className="disc-guide__primary-heading">
                <div>
                  <strong>2+2+2 三套搭配</strong>
                  {compositeOptions.length === 1 && compositeOptions[0]!.pieces.length > 3 ? (
                    <small>任选3套</small>
                  ) : null}
                </div>
              </header>
              <div className="disc-guide__composite-options">
                {compositeOptions.map(renderCompositeCard)}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </article>
  )
}
