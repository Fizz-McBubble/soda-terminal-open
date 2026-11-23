import { memo, type ReactNode } from 'react'
import { ExplanationPopover } from '../components/ExplanationPopover'
import { PlayerSelect } from '../components/PlayerSelect'
import { TeamLoadoutPagination } from './TeamLoadoutPagination'
import { TeamCompletionCandidates, TeamRow } from './TeamLoadoutOverviewParts'
import type { TeamLoadoutOverviewGroup, TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { genericTeamRatingBands } from './teamRatingText'
import {
  normalizeTeamOutputSystemFilter,
  type TeamOutputSystemFilter,
  type TeamOutputSystemOption,
} from './teamOutputSystemFilter'

export const TeamGroup = memo(function TeamGroup({
  group,
  selectedId,
  activeVariants,
  onSelect,
  onDeleteSaved,
  recommendedQuery,
  onRecommendedQueryChange,
  recommendedPage = 1,
  recommendedPageCount = 1,
  onRecommendedPageChange,
  onlyFavorites = false,
  onOnlyFavoritesChange,
  includeReferenceDirections = false,
  onIncludeReferenceDirectionsChange,
  outputSystem = 'all',
  outputSystemOptions = [],
  onOutputSystemChange,
  recommendationOrdinalById,
  showRecommendationOrdinal = false,
  scopeActions,
  analysisActions,
}: {
  scopeActions?: ReactNode
  analysisActions?: ReactNode
  group: TeamLoadoutOverviewGroup
  selectedId: string
  activeVariants: Record<string, string>
  onSelect: (id: string) => void
  onDeleteSaved?: (item: TeamLoadoutOverviewItem) => void
  recommendedQuery?: string
  onRecommendedQueryChange?: (query: string) => void
  recommendedPage?: number
  recommendedPageCount?: number
  onRecommendedPageChange?: (page: number) => void
  onlyFavorites?: boolean
  onOnlyFavoritesChange?: (checked: boolean) => void
  includeReferenceDirections?: boolean
  onIncludeReferenceDirectionsChange?: (checked: boolean) => void
  outputSystem?: TeamOutputSystemFilter
  outputSystemOptions?: readonly TeamOutputSystemOption[]
  onOutputSystemChange?: (value: TeamOutputSystemFilter) => void
  recommendationOrdinalById?: ReadonlyMap<string, number>
  showRecommendationOrdinal?: boolean
}) {
  const isRecommended = group.kind === 'recommended'
  const activeOutputSystemLabel =
    outputSystemOptions.find((option) => option.value === outputSystem)?.label ?? '当前体系'
  if (!group.items.length && group.completionCandidates?.length) {
    return <TeamCompletionCandidates candidates={group.completionCandidates} />
  }
  return (
    <section className={`f5v-box-team-group is-${group.kind}`}>
      <div className={isRecommended ? 'f5v-box-team-toolbar' : undefined}>
        <div className="f5v-box-team-group__heading">
          <h2 tabIndex={isRecommended ? -1 : undefined}>{group.label}</h2>
          {isRecommended ? (
            <ExplanationPopover
              label="推荐说明"
              variant="button"
              showIndicator={false}
              className="f5v-box-team-recommendation-explanation"
            >
              <p>先比较标准成型队伍，再匹配已拥有角色。选队后查看培养与装备差距。</p>
              <p>
                {genericTeamRatingBands.map(([band, meaning]) => `${band}：${meaning}`).join('；')}
                。
              </p>
              <p>同档队伍并列；具体选择结合敌人、增益和已拥有角色。</p>
              <p>
                默认列表也可能包含有搭配依据但暂无评级的队伍；暂无评级表示目前缺少适用的强弱结论。
              </p>
              <p>“更多配队”可查看其他搭配与待验证方向。</p>
              <p>补强建议列出补齐一名角色可解锁的搭配。</p>
            </ExplanationPopover>
          ) : null}
        </div>
        {isRecommended && outputSystemOptions.length ? (
          <div className="f5v-box-team-system-filter">
            <span>体系</span>
            <PlayerSelect
              value={outputSystem}
              aria-label="按体系筛选"
              onChange={(value) => onOutputSystemChange?.(normalizeTeamOutputSystemFilter(value))}
            >
              {outputSystemOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </PlayerSelect>
          </div>
        ) : null}
        {!isRecommended ? (
          <p className="f5v-box-team-group__description">{group.description}</p>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-recommendation-search">
            <input
              type="search"
              aria-label="搜索队名或成员"
              value={recommendedQuery ?? ''}
              onChange={(event) => onRecommendedQueryChange?.(event.target.value)}
              placeholder="输入队名或成员名"
            />
          </label>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-favorites-filter">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) => onOnlyFavoritesChange?.(event.target.checked)}
            />
            收藏角色
          </label>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-favorites-filter">
            <input
              type="checkbox"
              checked={includeReferenceDirections}
              onChange={(event) => onIncludeReferenceDirectionsChange?.(event.target.checked)}
            />
            更多配队
          </label>
        ) : null}
        {isRecommended ? scopeActions : null}
        {isRecommended ? analysisActions : null}
      </div>
      <div role="list" aria-label={group.label}>
        {group.items.map((family) => (
          <div key={family.id} role="listitem" className="f5v-box-team-row-shell">
            <TeamRow
              family={family}
              selected={family.id === selectedId}
              activeVariantId={activeVariants[family.id]}
              onSelect={() => onSelect(family.id)}
              recommendationOrdinal={recommendationOrdinalById?.get(family.id)}
              showRecommendationOrdinal={showRecommendationOrdinal}
            />
            {group.kind === 'saved' && onDeleteSaved ? (
              <button
                className="f5v-box-team-row-delete"
                type="button"
                onClick={() => onDeleteSaved(family.variants[0]!)}
                aria-label={`删除已保存方案 ${family.title}`}
              >
                删除
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {isRecommended ? (
        <TeamLoadoutPagination
          label="当前推荐分页（底部）"
          page={recommendedPage}
          pageCount={recommendedPageCount}
          onPageChange={(page) => onRecommendedPageChange?.(page)}
        />
      ) : null}
      {isRecommended && group.items.length === 0 ? (
        <div className="f5v-box-team-recommendation-empty" role="status">
          <p>
            {recommendedQuery?.trim()
              ? '没有找到相关队伍，试试其他队名或成员名。'
              : onlyFavorites
                ? '当前没有包含收藏角色的搭配，可取消筛选查看其他队伍。'
                : outputSystem !== 'all'
                  ? `${activeOutputSystemLabel}暂无推荐队伍。`
                  : '暂未找到推荐队伍，可搜索成员查看搭配。'}
          </p>
          {recommendedQuery?.trim() ? (
            <button
              type="button"
              className="f5v-box-team-recommendation-more"
              onClick={() => onRecommendedQueryChange?.('')}
            >
              清除搜索
            </button>
          ) : null}
          {!recommendedQuery?.trim() &&
          !onlyFavorites &&
          outputSystem !== 'all' &&
          onOutputSystemChange ? (
            <button
              type="button"
              className="f5v-box-team-recommendation-more"
              onClick={() => onOutputSystemChange('all')}
            >
              查看全部体系
            </button>
          ) : null}
        </div>
      ) : null}
      <TeamCompletionCandidates candidates={group.completionCandidates ?? []} />
    </section>
  )
})
