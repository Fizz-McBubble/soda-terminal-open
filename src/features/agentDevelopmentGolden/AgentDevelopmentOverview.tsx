import { useEffect, useRef, useState } from 'react'
import {
  useCatalogBrowseState,
  useCatalogBrowseScroll,
} from '../../components/assets/r6/useCatalogBrowseState'
import { Star } from 'lucide-react'
import { preloadSelectedAgentAvatar } from '../../components/selectedAgentAvatarPreload'
import { SelectMenu } from '../../components/assets/r6/SelectMenu'
import { createLatestVisualSelection } from '../../assets/visualEntityImageSource'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import type { AgentSummary } from './types'
import { AgentAvatar } from './AgentDevelopmentOverviewComponents'
import {
  attributeIcons,
  getDirectoryProgress,
  specialtyIcons,
} from './agentDevelopmentOverviewHelpers'
import './styles.overview-scroll.css'

function preloadRecommendationAvatar(agentId: string) {
  void preloadSelectedAgentAvatar(agentId, 'agent-development.overview')
}

function getSkillProgress(agent: AgentSummary) {
  const gaps = agent.nextTrainingSteps?.length ?? 0
  switch (agent.skillStatus) {
    case 'pending':
      return '正在核对'
    case 'stale':
      return '待重新分析'
    case 'unknown':
      return gaps ? `${gaps} 项可提升，部分等级待补录` : '等级待补录'
    case 'target-unknown':
      return gaps ? `${gaps} 项可提升，部分目标待确认` : '部分目标待确认'
    case 'complete':
      return '已记录目标均达标'
    case 'has-gaps':
      return `${gaps} 项可继续提升`
    case 'no-target':
      return '暂无可核对目标'
    default:
      return gaps ? `${gaps} 项可继续提升` : '目标待确认'
  }
}

export function AgentDevelopmentOverview({
  browseAccountId,
  openAgent,
  openSavedAgent,
  directoryAgents,
  onToggleFavorite,
  onDeleteAgentPlan,
}: {
  browseAccountId?: string
  openAgent: (agentId: string) => void
  openSavedAgent?: (agentId: string) => void
  directoryAgents: AgentSummary[]
  onToggleFavorite?: (agentId: string) => void | Promise<void>
  onDeleteAgentPlan?: (agentId: string) => void
}) {
  const browseKey = browseAccountId ? `development:${browseAccountId}` : undefined
  const gridRef = useRef<HTMLUListElement>(null)
  useCatalogBrowseScroll(browseKey, gridRef)
  const ordered = directoryAgents
  const [query, setQuery] = useCatalogBrowseState(browseKey, 'query', '')
  const [filter, setFilter] = useCatalogBrowseState<'recommendations' | 'plans'>(
    browseKey,
    'filter',
    'recommendations',
  )
  const [rarity, setRarity] = useCatalogBrowseState<'all' | 'S' | 'A'>(browseKey, 'rarity', 'all')
  const [attribute, setAttribute] = useCatalogBrowseState(browseKey, 'attribute', 'all')
  const [specialty, setSpecialty] = useCatalogBrowseState(browseKey, 'specialty', 'all')
  const [favoritePending, setFavoritePending] = useState(false)
  const favoriteInFlight = useRef(false)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const toggleFavorite = async (agentId: string) => {
    if (!onToggleFavorite || favoriteInFlight.current) return
    favoriteInFlight.current = true
    setFavoritePending(true)
    setFavoriteError(null)
    try {
      await onToggleFavorite(agentId)
    } catch {
      setFavoriteError('收藏未保存，请重试。')
    } finally {
      favoriteInFlight.current = false
      setFavoritePending(false)
    }
  }
  const searchInput = useRef<HTMLInputElement>(null)
  const hasFilters =
    Boolean(query.trim()) ||
    filter !== 'recommendations' ||
    rarity !== 'all' ||
    attribute !== 'all' ||
    specialty !== 'all'
  const resetFilters = () => {
    setQuery('')
    setFilter('recommendations')
    setRarity('all')
    setAttribute('all')
    setSpecialty('all')
    searchInput.current?.focus()
  }
  const [selectedAgentId, setSelectedAgentId] = useCatalogBrowseState(
    browseKey,
    'selection',
    ordered[0]?.agentId ?? '',
  )
  const detailSelection = useRef(
    createLatestVisualSelection((request) =>
      preloadSelectedAgentAvatar(request.entityId, 'agent-development.overview'),
    ),
  ).current
  const detailRef = useRef<HTMLElement>(null)

  const selectAgentDetail = async (agentId: string) => {
    if (agentId === selectedAgentId) return
    await detailSelection(
      {
        entityType: 'agent',
        entityId: agentId,
        slotId: 'agent.selected-summary',
        consumer: 'agent-development.overview',
      },
      () => setSelectedAgentId(agentId),
    )
  }
  const filtered = ordered.filter(
    (agent) =>
      agent.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
      // "全部角色" is the complete current-account directory. Agents whose
      // direction still needs confirmation must remain visible; hiding them
      // would contradict the explicit missing-target state above the grid.
      (filter === 'recommendations' || Boolean(agent.plan)) &&
      (rarity === 'all' || agent.rarity === rarity) &&
      (attribute === 'all' || agent.attribute === attribute) &&
      (specialty === 'all' || agent.specialty === specialty),
  )
  const selectedAgent =
    filtered.find((agent) => agent.agentId === selectedAgentId) ?? filtered[0] ?? null
  const selectedProgress = selectedAgent ? getDirectoryProgress(selectedAgent) : null
  const skillProgress = selectedAgent ? getSkillProgress(selectedAgent) : ''
  useStateTransitionMotion({
    scope: detailRef,
    stateKey: selectedAgent?.agentId ?? 'none',
    includeScope: true,
    enabled: Boolean(selectedAgent),
    transition: 'content',
  })
  const selectedAgentForPreloadId = selectedAgent?.agentId
  useEffect(() => {
    if (selectedAgentForPreloadId) preloadRecommendationAvatar(selectedAgentForPreloadId)
  }, [selectedAgentForPreloadId])
  return (
    <section className="overview" aria-labelledby="overview-title">
      <header className="page-heading">
        <h1 id="overview-title">选择代理人</h1>
        <div className="overview-summary" aria-label="养成统计">
          <span>
            已收藏 <b>{ordered.filter((agent) => agent.favorite).length}</b>
          </span>
          <span>
            已有方案 <b>{ordered.filter((agent) => agent.plan).length}</b>
          </span>
        </div>
      </header>
      <div className="overview-layout">
        <section className="agent-catalog" aria-label="代理人目录">
          <div className="catalog-tools">
            <label>
              <span>搜索已拥有代理人</span>
              <input
                ref={searchInput}
                aria-label="搜索已拥有代理人"
                placeholder="输入名称"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="catalog-tools__modes" role="group" aria-label="角色范围">
              <button
                type="button"
                aria-pressed={filter === 'recommendations'}
                onClick={() => setFilter('recommendations')}
              >
                全部角色
              </button>
              <button
                type="button"
                aria-pressed={filter === 'plans'}
                onClick={() => setFilter('plans')}
              >
                已有方案
              </button>
            </div>

            <label>
              <span>稀有度</span>
              <SelectMenu
                label="按稀有度筛选"
                value={rarity}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'S', label: 'S 级' },
                  { value: 'A', label: 'A 级' },
                ]}
                onChange={(value) => setRarity(value as typeof rarity)}
              />
            </label>
            <label>
              <span>属性</span>
              <SelectMenu
                label="按属性筛选"
                value={attribute}
                options={[
                  { value: 'all', label: '全部' },
                  ...Object.entries(attributeIcons).map(([value, entry]) => ({
                    value,
                    label: entry.label,
                  })),
                ]}
                onChange={setAttribute}
              />
            </label>
            <label>
              <span>特性</span>
              <SelectMenu
                label="按特性筛选"
                value={specialty}
                options={[
                  { value: 'all', label: '全部' },
                  ...Object.entries(specialtyIcons).map(([value, entry]) => ({
                    value,
                    label: entry.label,
                  })),
                ]}
                onChange={setSpecialty}
              />
            </label>
            {hasFilters && filtered.length ? (
              <button type="button" onClick={resetFilters}>
                清除筛选
              </button>
            ) : null}
          </div>
          {hasFilters && filtered.length > 0 ? (
            <p className="training-order-note" role="status">
              找到 {filtered.length} / {ordered.length} 位代理人
            </p>
          ) : null}
          {favoriteError ? <p role="alert">{favoriteError}</p> : null}

          <ul ref={gridRef} className="agent-grid" aria-label="代理人养成总览" tabIndex={0}>
            {filtered.map((agent) => {
              const progress = getDirectoryProgress(agent)
              const isSelected = selectedAgent?.agentId === agent.agentId
              return (
                <li className="agent-tile" key={agent.agentId}>
                  <button
                    className="agent-favorite"
                    type="button"
                    aria-label={`${agent.favorite ? '取消收藏' : '收藏'}${agent.name}`}
                    aria-pressed={agent.favorite}
                    disabled={!onToggleFavorite || favoritePending}
                    title={agent.favorite ? '取消收藏' : '收藏'}
                    onClick={() => void toggleFavorite(agent.agentId)}
                  >
                    <Star
                      aria-hidden="true"
                      size={18}
                      strokeWidth={2}
                      fill={agent.favorite ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    className={`agent-tile-link ${isSelected ? 'selected' : ''}`}
                    data-agent-id={agent.agentId}
                    aria-current={isSelected ? 'true' : undefined}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={[agent.name, progress.label, progress.detail]
                      .filter(Boolean)
                      .join('，')}
                    onPointerEnter={() => preloadRecommendationAvatar(agent.agentId)}
                    onFocus={() => preloadRecommendationAvatar(agent.agentId)}
                    onClick={() => {
                      void selectAgentDetail(agent.agentId)
                    }}
                  >
                    <AgentAvatar agent={agent} />
                    <span className={`rarity rarity--${agent.rarity.toLowerCase()}`}>
                      {agent.rarity}
                    </span>
                    <div className="agent-tile-copy">
                      <div>
                        <strong title={agent.name}>{agent.name}</strong>
                        {progress.label ? <span className="status">{progress.label}</span> : null}
                      </div>

                      <small>
                        Lv.{agent.level} · {agent.mindscape}影
                      </small>
                    </div>
                  </button>
                </li>
              )
            })}
            {!filtered.length ? (
              <li className="catalog-empty" role="status">
                <strong>
                  {filter === 'plans' && !ordered.some((agent) => agent.plan)
                    ? '还没有保存养成方案'
                    : '没有符合当前筛选条件的代理人'}
                </strong>
                <p>
                  {filter === 'plans' && !ordered.some((agent) => agent.plan)
                    ? '选择一位代理人，搭配装备后即可保存方案。'
                    : '试试其他名称，或清除筛选查看已拥有的代理人。'}
                </p>
                {hasFilters ? (
                  <button type="button" onClick={resetFilters}>
                    清除筛选，查看全部角色
                  </button>
                ) : null}
              </li>
            ) : null}
          </ul>
        </section>
        {selectedAgent && selectedProgress ? (
          <aside ref={detailRef} className="next-panel" aria-live="polite">
            {selectedAgent.plan && onDeleteAgentPlan ? (
              <button
                className="delete-agent-plan"
                type="button"
                onClick={() => onDeleteAgentPlan(selectedAgent.agentId)}
              >
                删除方案
              </button>
            ) : null}
            <div className="next-agent">
              <AgentAvatar
                agent={selectedAgent}
                className="featured-avatar"
                slot="recommendation-identity"
                includeIdentityIcons={false}
              />
              <div>
                <small>已选代理人</small>
                <h2>{selectedAgent.name}</h2>
                <span>
                  Lv.{selectedAgent.level} · {selectedAgent.mindscape}影
                </span>
              </div>
            </div>
            <div className="next-copy">
              <section className="next-progress" aria-label="养成进度">
                <strong>养成进度</strong>
                <dl>
                  <div>
                    <dt>角色等级</dt>
                    <dd>Lv.{selectedAgent.level}</dd>
                  </div>
                  <div>
                    <dt>技能</dt>
                    <dd>{skillProgress}</dd>
                  </div>
                  <div>
                    <dt>音擎</dt>
                    <dd>{selectedAgent.equipmentProgress?.engine ?? '待确认'}</dd>
                  </div>
                  <div>
                    <dt>驱动盘</dt>
                    <dd>{selectedAgent.equipmentProgress?.discs ?? '装备记录待确认'}</dd>
                  </div>
                </dl>
              </section>
              <section className="next-cinema" aria-label="影画参考">
                <strong>影画参考</strong>
                {selectedAgent.skillStatus !== 'stale' && selectedAgent.cinemaLevels?.length ? (
                  <>
                    <p>
                      关键影画：{selectedAgent.cinemaLevels.map((level) => `${level}影`).join('、')}
                    </p>
                    <small>
                      当前 {selectedAgent.mindscape}影；
                      {selectedAgent.cinemaLevels.some((level) => level > selectedAgent.mindscape)
                        ? '可根据队伍需要和资源考虑后续影画。'
                        : '已解锁所列影画。'}
                    </small>
                  </>
                ) : (
                  <p>
                    {selectedAgent.skillStatus === 'pending'
                      ? '影画建议更新中…'
                      : selectedAgent.skillStatus === 'stale'
                        ? '账户资料已变化，请重新分析。'
                        : '暂无影画建议。'}
                  </p>
                )}
              </section>
              <button
                className="primary"
                data-player-route={`/development/${selectedAgent.agentId}`}
                type="button"
                onClick={() =>
                  selectedAgent.plan && openSavedAgent
                    ? openSavedAgent(selectedAgent.agentId)
                    : openAgent(selectedAgent.agentId)
                }
              >
                {selectedAgent.plan && openSavedAgent ? '查看配装' : '进入养成'}
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
