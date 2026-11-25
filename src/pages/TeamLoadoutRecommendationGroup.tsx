import { memo, type ReactNode } from "react";
import { ExplanationPopover } from "../components/ExplanationPopover";
import { PlayerSelect } from "../components/PlayerSelect";
import { TeamLoadoutRowVariants } from "./TeamLoadoutRowVariants";
import { TeamLoadoutPagination } from "./TeamLoadoutPagination";
import { TeamCompletionCandidates, TeamRow } from "./TeamLoadoutOverviewParts";
import type {
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewItem,
} from "./teamLoadoutOverviewModel";
import { graduatedTeamRatingBands } from "../decision/graduatedTeamRatingBands";
import {
  normalizeTeamOutputSystemFilter,
  type TeamOutputSystemFilter,
  type TeamOutputSystemOption,
} from "./teamOutputSystemFilter";

export const TeamGroup = memo(function TeamGroup({
  group,
  selectedId,
  activeVariants,
  onSelect,
  onVariantSelect,
  onDeleteSaved,
  recommendedQuery,
  onRecommendedQueryChange,
  recommendedPage = 1,
  recommendedPageCount = 1,
  onRecommendedPageChange,
  onlyFavorites = false,
  onOnlyFavoritesChange,
  outputSystem = "all",
  outputSystemOptions = [],
  onOutputSystemChange,
  recommendationOrdinalById,
  showRecommendationOrdinal = false,
  scopeActions,
  analysisActions,
}: {
  scopeActions?: ReactNode;
  analysisActions?: ReactNode;
  group: TeamLoadoutOverviewGroup;
  selectedId: string;
  activeVariants: Record<string, string>;
  onSelect: (id: string) => void;
  onVariantSelect?: (familyId: string, variantId: string) => void;
  onDeleteSaved?: (item: TeamLoadoutOverviewItem) => void;
  recommendedQuery?: string;
  onRecommendedQueryChange?: (query: string) => void;
  recommendedPage?: number;
  recommendedPageCount?: number;
  onRecommendedPageChange?: (page: number) => void;
  onlyFavorites?: boolean;
  onOnlyFavoritesChange?: (checked: boolean) => void;
  outputSystem?: TeamOutputSystemFilter;
  outputSystemOptions?: readonly TeamOutputSystemOption[];
  onOutputSystemChange?: (value: TeamOutputSystemFilter) => void;
  recommendationOrdinalById?: ReadonlyMap<string, number>;
  showRecommendationOrdinal?: boolean;
}) {
  const isRecommended = group.kind === "recommended";
  const activeOutputSystemLabel =
    outputSystemOptions.find((option) => option.value === outputSystem)
      ?.label ?? "当前体系";
  if (!group.items.length && group.completionCandidates?.length) {
    return <TeamCompletionCandidates candidates={group.completionCandidates} />;
  }
  return (
    <section className={`f5v-box-team-group is-${group.kind}`}>
      <div className={isRecommended ? "f5v-box-team-toolbar" : undefined}>
        <div className="f5v-box-team-group__heading">
          <h2 tabIndex={isRecommended ? -1 : undefined}>{group.label}</h2>
          {isRecommended ? (
            <ExplanationPopover
              label="推荐说明"
              variant="button"
              showIndicator={false}
              className="f5v-box-team-recommendation-explanation"
            >
              <p>
                当前推荐列出已拥有成员能组成的队伍。评级和分数反映所选打法在毕业配置下的表现。
              </p>
              <p>评级从高到低为 {graduatedTeamRatingBands.join("、")}。</p>
              <p>
                同档队伍在相同毕业条件下也有先后。只有档位或区间时，可按关卡增益、敌人和手法选队。
              </p>
              <p>
                在队伍卡右侧换人，评级、邦布建议和手法会随搭配更新。点「搭配装备」可对照三名成员的实装与方案面板。
              </p>
              <p>
                「暂无评级」表示当前打法缺少可比结论。「补强建议」列出只差一名成员的搭配。
              </p>
            </ExplanationPopover>
          ) : null}
        </div>
        {isRecommended && outputSystemOptions.length ? (
          <div className="f5v-box-team-system-filter">
            <span>体系</span>
            <PlayerSelect
              value={outputSystem}
              aria-label="按体系筛选"
              onChange={(value) =>
                onOutputSystemChange?.(normalizeTeamOutputSystemFilter(value))
              }
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
              value={recommendedQuery ?? ""}
              onChange={(event) =>
                onRecommendedQueryChange?.(event.target.value)
              }
              placeholder="输入队名或成员名"
            />
          </label>
        ) : null}
        {isRecommended ? (
          <label className="f5v-box-team-favorites-filter">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(event) =>
                onOnlyFavoritesChange?.(event.target.checked)
              }
            />
            收藏角色
          </label>
        ) : null}
        {isRecommended ? scopeActions : null}
        {isRecommended ? analysisActions : null}
      </div>
      <div role="list" aria-label={group.label}>
        {group.items.map((family) => (
          <div
            key={family.id}
            role="listitem"
            className={`f5v-box-team-row-shell${family.variants.length > 1 && onVariantSelect ? " has-variants" : ""}`}
          >
            <TeamRow
              family={family}
              selected={family.id === selectedId}
              activeVariantId={activeVariants[family.id]}
              onSelect={() => onSelect(family.id)}
              recommendationOrdinal={recommendationOrdinalById?.get(family.id)}
              showRecommendationOrdinal={showRecommendationOrdinal}
            />
            {family.variants.length > 1 && onVariantSelect ? (
              <TeamLoadoutRowVariants
                family={family}
                activeVariantId={activeVariants[family.id]}
                selected={family.id === selectedId}
                onSelect={(id) => onVariantSelect(family.id, id)}
              />
            ) : null}
            {group.kind === "saved" && onDeleteSaved ? (
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
              ? "没有找到相关队伍，试试其他队名或成员名。"
              : onlyFavorites
                ? "当前没有包含收藏角色的搭配，可取消筛选查看其他队伍。"
                : outputSystem !== "all"
                  ? `${activeOutputSystemLabel}暂无推荐队伍。`
                  : "暂未找到推荐队伍，可搜索成员查看搭配。"}
          </p>
          {recommendedQuery?.trim() ? (
            <button
              type="button"
              className="f5v-box-team-recommendation-more"
              onClick={() => onRecommendedQueryChange?.("")}
            >
              清除搜索
            </button>
          ) : null}
          {!recommendedQuery?.trim() &&
          !onlyFavorites &&
          outputSystem !== "all" &&
          onOutputSystemChange ? (
            <button
              type="button"
              className="f5v-box-team-recommendation-more"
              onClick={() => onOutputSystemChange("all")}
            >
              查看全部体系
            </button>
          ) : null}
        </div>
      ) : null}
      <TeamCompletionCandidates candidates={group.completionCandidates ?? []} />
    </section>
  );
});
