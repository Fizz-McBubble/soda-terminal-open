import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAgentName } from '../application/publicRosterNames'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { playerDecisionText } from './teamEquipmentParameterPresentation'
import { TeamBangbooSuggestions } from './TeamBangbooSuggestions'
import { TeamRecommendationConditions } from './TeamRecommendationConditions'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'
import { GraduationCompletionLabel } from './savedTeamGraduationPresentation'
import { TeamLoadoutEntityPortraits } from './TeamLoadoutEntityPortraits'
import { preloadTeamLoadoutFamilyVisuals } from './teamLoadoutVisualPreload'
import {
  familyRatingLabel,
  ratingLabel,
  ratingTitle,
  referenceSummary,
} from './teamRatingPresentation'
export {
  TeamSavedPlanList,
  TeamCompletionCandidates,
  TeamConstraintResetPanel,
} from './TeamLoadoutPreparation'

function presentationReason(family: TeamLoadoutOverviewFamily) {
  return family.variants.length > 1 || /还需补齐装备|成员已齐，?可开始配装/.test(family.reason)
    ? null
    : family.reason
}

function variantAvailabilityLabel(status: TeamLoadoutOverviewItem['executionStatus']) {
  switch (status) {
    case 'direct':
      return '可直接使用'
    case 'adjust':
      return '需要调整'
    case 'confirm':
      return '待确认'
    case 'build':
      return '还缺装备'
    case null:
      return '待配装'
  }
}

function strengthExplanation(item: TeamLoadoutOverviewItem) {
  if (
    item.teamRatingBand &&
    item.teamRatingBand !== 'Experimental' &&
    item.confidence !== 'experimental'
  )
    return null
  if (item.calibrationStatus === 'calibration_violation')
    return '现有强度比较结果不一致，暂时无法判断这队强弱。'
  if (item.sourceConfirmed && item.historicalReferenceOnly)
    return '既有攻略记录了这套搭配，当前强度仍待核实。'
  if (item.sourceConfirmed) return '参考资料收录了这套成员搭配，但暂时无法判断这队强弱。'
  if (item.calibrationStatus === 'insufficient')
    return '可参考的强度比较不足，暂时无法判断这队强弱。'
  if (item.teamRatingBand === 'Experimental' || item.confidence === 'experimental')
    return '这套搭配还需要验证，暂时无法判断这队强弱。'
  return '暂时无法判断这队强弱，可以先查看成员与配装建议。'
}

function ratingExplanation(item: TeamLoadoutOverviewItem) {
  if (item.mechanicValidity === 'invalid') return '搭配条件未满足，建议调整成员。'
  if (
    item.teamRatingBand &&
    item.teamRatingBand !== 'Experimental' &&
    item.confidence !== 'experimental'
  )
    return null
  if (item.mechanicValidity === 'partial') return '部分搭配条件尚未确认。'
  return strengthExplanation(item)
}

function actionableTradeoffs(item: TeamLoadoutOverviewItem) {
  const internalEvaluationExplanations = [
    '未观察关系不会被当作',
    '不把小数差直接变成队伍名次',
    '取相关维度中的最弱证据带',
    '先要求队内具名关系与机制闭合',
    'source-backed effect recipient',
    'source-backed Mechanic IR',
    'PlanningBaseline observation',
    '综合成员特性/属性多样性',
    '只评估声明式资源闭合',
    '已冻结 field-time mode',
  ]
  const nonActionableSummaries = new Set(['实体资产冲突 可协调', '替换既有养成／配装的成本 中'])
  return [...new Set(item.authorityTradeoffs)]
    .filter(
      (note) => !internalEvaluationExplanations.some((explanation) => note.includes(explanation)),
    )
    .map(playerDecisionText)
    .filter((note) => !/^(分析评级|评级基于|队伍评级|评级 [SAB])/u.test(note.trim()))
    .filter((note) => /驱动盘|音擎|邦布|潜能|养成|配装|实体资产|仓库|缺盘|共用|冲突/u.test(note))
    .filter((note) => !nonActionableSummaries.has(note.replace(/。$/u, '')))
    .filter((note) => note !== '成员与邦布搭配已有资料支持；同档队伍不区分先后。')
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

function visibleGaps(item: TeamLoadoutOverviewItem) {
  const gaps = [...new Set(item.gaps.map(playerFacingGap))].filter(
    (gap) => !/^进入队伍后匹配驱动盘[。.]?$/.test(gap),
  )
  const hasNamedDiscGap = gaps.some((gap) => /尚未配齐6张驱动盘/u.test(gap))
  return gaps.filter((gap) => gap !== '驱动盘尚未配齐。' || !hasNamedDiscGap)
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
  // Legacy snapshots contain only sentences, not plan IDs. Summarize their two
  // roles without inventing a count of distinct plans.
  return [...groups.values()].map((group) =>
    group.kinds.size > 1
      ? `与当前及已保存的「${group.name}」方案共用${group.equipment}；保存本队不会改写相关方案`
      : group.line,
  )
}

export function TeamRow({
  family,
  selected,
  activeVariantId,
  onSelect,
}: {
  family: TeamLoadoutOverviewFamily
  selected: boolean
  activeVariantId?: string
  onSelect: () => void
}) {
  const primary =
    family.variants.find((variant) => variant.id === activeVariantId) ?? family.variants[0]!
  const stateLabel =
    primary === family.variants[0]
      ? family.stateLabel
      : family.variants.length > 1
        ? `${primary.stateLabel} · ${family.variants.length} 种搭配`
        : primary.stateLabel
  const reason = presentationReason(family)
  return (
    <button
      className={`f5v-box-team-row${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={[family.title, stateLabel, reason].filter(Boolean).join('，')}
      onPointerEnter={() => preloadTeamLoadoutFamilyVisuals(family)}
      onFocus={() => preloadTeamLoadoutFamilyVisuals(family)}
      onClick={() => {
        preloadTeamLoadoutFamilyVisuals(family)
        onSelect()
      }}
    >
      <TeamLoadoutEntityPortraits item={primary} />
      <span className="f5v-box-team-row__identity">
        <small className="f5v-box-team-reference" title={ratingTitle(primary)}>
          {familyRatingLabel(family, primary)}
        </small>
        <strong>{family.title}</strong>
        {primary.kind === 'saved' ? (
          <GraduationCompletionLabel completion={primary.graduationCompletion} />
        ) : null}
        <small className={`f5v-box-team-state is-${primary.kind}`}>{stateLabel}</small>
      </span>
      {reason ? <span className="f5v-box-team-row__reason">{reason}</span> : null}
    </button>
  )
}

export function TeamDecisionCard({
  family,
  selected,
  onSelect,
}: {
  family: TeamLoadoutOverviewFamily
  selected: boolean
  onSelect: () => void
}) {
  const primary = family.variants[0]!
  const reason = presentationReason(family)
  return (
    <button
      className={`f5v-box-team-decision-card${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={[family.title, family.stateLabel, reason].filter(Boolean).join('，')}
      onPointerEnter={() => preloadTeamLoadoutFamilyVisuals(family)}
      onFocus={() => preloadTeamLoadoutFamilyVisuals(family)}
      onClick={() => {
        preloadTeamLoadoutFamilyVisuals(family)
        onSelect()
      }}
    >
      <TeamLoadoutEntityPortraits item={primary} />
      <span className="f5v-box-team-decision-card__copy">
        <strong>{family.title}</strong>
        <span className="f5v-box-team-decision-card__meta">
          <small className={`f5v-box-team-state is-${family.kind}`}>{family.stateLabel}</small>
          <small className="f5v-box-team-reference" title={ratingTitle(primary)}>
            {familyRatingLabel(family, primary)}
          </small>
          {reason ? <span>{reason}</span> : null}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={20} />
    </button>
  )
}

export function TeamPreview({
  family,
  activeVariantId,
  onVariantSelect,
  onPrimaryAction,
  preparingItemId,
  preparationError,
  onReturnToList,
}: {
  family: TeamLoadoutOverviewFamily
  activeVariantId?: string
  onVariantSelect?: (id: string) => void
  onPrimaryAction: (item: TeamLoadoutOverviewItem) => void
  preparingItemId?: string | null
  preparationError?: { itemId: string; message: string } | null
  onReturnToList?: () => void
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(family.variants[0]?.id ?? '')
  const item =
    family.variants.find((variant) => variant.id === (activeVariantId ?? selectedVariantId)) ??
    family.variants[0]!
  const variants = family.variants
  const [expandedVariants, setExpandedVariants] = useState(false)
  const visibleVariants = expandedVariants
    ? variants
    : [item, ...variants.filter((entry) => entry.id !== item.id)].slice(0, 4)
  const gaps = visibleGaps(item)
  const orderedAgentIds = orderTeamMembersForDisplay(
    item.agentIds,
    (id) => id,
    item.deploymentOrder,
  ).slice(0, 3)

  // The preview is remounted when a row or variant is selected. Start the
  // same cache/object-URL work for every identity that can appear in this
  // detail card while the current card is still visible; the click then
  // reuses VisualEntityImage's shared pending/session source.
  useEffect(() => {
    preloadTeamLoadoutFamilyVisuals(family)
  }, [family])

  return (
    <aside
      className="f5v-box-team-preview"
      data-motion-team-preview
      aria-labelledby="f5v-box-team-preview-title"
    >
      <div className="f5v-box-team-preview__scroll">
        {onReturnToList ? (
          <button
            className="button button--quiet f5v-box-team-mobile-navigation"
            type="button"
            onClick={onReturnToList}
          >
            返回队伍列表
          </button>
        ) : null}
        <header>
          <div className="f5v-box-team-preview__title-line">
            <span className="f5v-box-team-preview__reference" title={ratingTitle(item)}>
              {ratingLabel(item)}
            </span>
            <TeamRecommendationConditions item={item} />
            <h2 id="f5v-box-team-preview-title" tabIndex={-1}>
              {family.title}
            </h2>
            <span className={`f5v-box-team-state is-${item.kind}`}>{item.stateLabel}</span>
          </div>
          {item.favoriteLabel ? (
            <p className="f5v-box-team-favorite-match">{item.favoriteLabel}</p>
          ) : null}
          {ratingExplanation(item) ? <p>{ratingExplanation(item)}</p> : null}
          {item.kind === 'saved' ? (
            <GraduationCompletionLabel completion={item.graduationCompletion} />
          ) : null}
        </header>

        <div className="f5v-box-team-preview__members">
          <TeamLoadoutEntityPortraits item={item} orderedAgentIds={orderedAgentIds} large />
          <div className={`f5v-box-team-member-names${item.bangbooId ? ' has-bangboo' : ''}`}>
            {orderedAgentIds.map((agentId) => (
              <span key={agentId}>{getAgentName(agentId)}</span>
            ))}
            {item.bangbooId ? <span>{item.bangbooLabel}</span> : null}
          </div>
          {!item.bangbooId && !item.bangbooAlternativeIds?.length ? (
            <p className="f5v-box-team-bangboo-direction">
              {item.bangbooReason ?? '本队还没选邦布，进入配装后选择。'}
            </p>
          ) : null}
        </div>

        {<TeamBangbooSuggestions options={item.bangbooSuggestions ?? []} />}
        {gaps.length ? (
          <section className="f5v-box-team-preview__gaps">
            <h3>{item.kind === 'saved' ? '配装记录' : '配装前先看'}</h3>
            <p>
              {item.kind === 'saved'
                ? '这份方案有以下待核对项，原记录仍保留。'
                : '上次匹配仍有以下问题，进入配装后会重新检查。'}
            </p>
            <ul>
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {visibleImpactLines(item.impacts).length ||
        actionableTradeoffs(item).length ||
        (item.primaryActions ?? []).length ? (
          <section className="f5v-box-team-preview__impact" aria-label="换装影响">
            <h3>换装影响</h3>
            <ul>
              {[
                ...new Set([
                  ...visibleImpactLines(item.impacts),
                  ...(item.primaryActions ?? []),
                  ...actionableTradeoffs(item),
                ]),
              ].map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {variants.length > 1 ? (
          <section className="f5v-box-team-variants" aria-label="可选搭配">
            <h3>替换成员</h3>
            <div role="group" aria-label="切换可选搭配">
              {visibleVariants.map((variant) => {
                const isCurrent = variant.id === item.id
                const replacementAgentIds = variant.agentIds.filter(
                  (agentId) => !item.agentIds.includes(agentId),
                )
                const replacementNames = replacementAgentIds.map(getAgentName)
                const replacement = {
                  ...variant,
                  agentIds: replacementAgentIds,
                  bangbooId: null,
                }
                const label = isCurrent ? '当前搭配' : replacementNames.join('、') || '另一种搭配'
                const availabilityLabel = variantAvailabilityLabel(variant.executionStatus)
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={`f5v-box-team-variant-button${isCurrent ? ' is-selected' : ''}`}
                    aria-label={`${availabilityLabel}：${label}，${referenceSummary(variant)}`}
                    aria-pressed={isCurrent}
                    onClick={() => {
                      setSelectedVariantId(variant.id)
                      onVariantSelect?.(variant.id)
                    }}
                  >
                    {isCurrent ? (
                      <Check size={24} aria-hidden="true" />
                    ) : (
                      <TeamLoadoutEntityPortraits item={replacement} />
                    )}
                    <span className="f5v-box-team-variant-copy">
                      <strong>{label}</strong>
                      <small>
                        <span title={ratingTitle(variant)}>{ratingLabel(variant)}</span>
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
            {variants.length > 4 ? (
              <button
                className="f5v-box-team-variants-more"
                type="button"
                onClick={() => setExpandedVariants(!expandedVariants)}
              >
                {expandedVariants ? '收起替补' : `展开其余 ${variants.length - 4} 种搭配`}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
      <nav className="f5v-box-team-preview__actions" aria-label="所选队伍操作">
        {preparationError?.itemId === item.id ? (
          <p className="f5v-box-team-preview__prepare-error" role="alert">
            {preparationError.message}
          </p>
        ) : null}
        <button
          className="f5v-box-team-primary"
          type="button"
          disabled={preparingItemId === item.id}
          onClick={() => onPrimaryAction(item)}
        >
          {preparingItemId === item.id ? '正在搭配装备…' : item.primaryLabel}
        </button>
      </nav>
    </aside>
  )
}
