import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { VisualEntityImage } from '../../components/VisualEntityImage'
import { SelectMenu } from '../../components/assets/r6/SelectMenu'
import {
  createLatestVisualSelection,
  preloadVisualEntityImage,
} from '../../assets/visualEntityImageSource'
import { AgentVisualSlot } from './agentVisualSlot'
import type { AgentSummary } from './types'
import './styles.overview-scroll.css'

const attributeIcons: Record<string, { id: string; label: string }> = {
  electric: { id: 'attribute-electric', label: '电属性' },
  ether: { id: 'attribute-ether', label: '以太属性' },
  fire: { id: 'attribute-fire', label: '火属性' },
  ice: { id: 'attribute-ice', label: '冰属性' },
  physical: { id: 'attribute-physical', label: '物理属性' },
  wind: { id: 'attribute-wind', label: '风属性' },
}

const specialtyIcons: Record<string, { id: string; label: string }> = {
  anomaly: { id: 'specialty-anomaly', label: '异常特性' },
  damage: { id: 'specialty-attack', label: '强攻特性' },
  defense: { id: 'specialty-defense', label: '防护特性' },
  rupture: { id: 'specialty-rupture', label: '命破特性' },
  stun: { id: 'specialty-stun', label: '击破特性' },
  support: { id: 'specialty-support', label: '支援特性' },
}

function AgentIdentityIcons({ agent }: { agent: AgentSummary }) {
  const attribute = agent.attribute ? attributeIcons[agent.attribute] : undefined
  const specialty = agent.specialty ? specialtyIcons[agent.specialty] : undefined
  if (!attribute && !specialty) return null
  return (
    <span className="agent-identity-icons" aria-label="属性与特性">
      {attribute ? (
        <VisualEntityImage
          entityType="illustration"
          entityId={attribute.id}
          variant="icon"
          name={attribute.label}
        />
      ) : null}
      {specialty ? (
        <VisualEntityImage
          entityType="illustration"
          entityId={specialty.id}
          variant="icon"
          name={specialty.label}
        />
      ) : null}
    </span>
  )
}

function AgentAvatar({
  agent,
  className = '',
  slot = 'compact-agent',
}: {
  agent: AgentSummary
  className?: string
  slot?: 'compact-agent' | 'recommendation-identity'
}) {
  return (
    <span
      className={`agent-avatar ${className}`.trim()}
      data-entity-id={agent.agentId}
      data-asset-kind={agent.visual.kind}
      data-fallback={agent.visual.fallback}
    >
      <span aria-hidden="true">{agent.name.slice(0, 1)}</span>
      <AgentVisualSlot slot={slot} agentId={agent.agentId} name={agent.name} />
      <AgentIdentityIcons agent={agent} />
    </span>
  )
}

function getDirectoryProgress(agent: AgentSummary) {
  if (agent.status === '已有方案') {
    return {
      label: '方案已保存',
      detail: '配装已保存，可继续调整。',
    }
  }
  if (agent.status === '培养中') {
    return {
      label: '已收藏',
      detail: '查看技能升级顺序、音擎选择和驱动盘搭配。',
    }
  }
  return {
    label: '',
    detail: '查看技能升级顺序、音擎选择和驱动盘搭配。',
  }
}

function preloadRecommendationAvatar(agentId: string) {
  void preloadVisualEntityImage({
    entityType: 'agent',
    entityId: agentId,
    slotId: 'agent.square-avatar',
    consumer: 'agent-development.overview',
  })
}

export function AgentDevelopmentOverview({
  openAgent,
  openSavedAgent,
  directoryAgents,
  onToggleFavorite,
  onDeleteAgentPlan,
}: {
  openAgent: (agentId: string) => void
  openSavedAgent?: (agentId: string) => void
  directoryAgents: AgentSummary[]
  onToggleFavorite?: (agentId: string) => void | Promise<void>
  onDeleteAgentPlan?: (agentId: string) => void
}) {
  const ordered = directoryAgents
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'recommendations' | 'plans'>('recommendations')
  const [rarity, setRarity] = useState<'all' | 'S' | 'A'>('all')
  const [attribute, setAttribute] = useState('all')
  const [specialty, setSpecialty] = useState('all')
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
  const [selectedAgentId, setSelectedAgentId] = useState(() => ordered[0]?.agentId ?? '')
  const detailSelection = useRef(createLatestVisualSelection()).current

  const selectAgentDetail = async (agentId: string) => {
    if (agentId === selectedAgentId) return
    await detailSelection(
      {
        entityType: 'agent',
        entityId: agentId,
        slotId: 'agent.square-avatar',
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

          <ul className="agent-grid" aria-label="代理人养成总览" tabIndex={0}>
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
                      size={15}
                      strokeWidth={2}
                      fill={agent.favorite ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    className={`agent-tile-link ${isSelected ? 'selected' : ''}`}
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
          <aside className="next-panel">
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
              {!selectedAgent.nextTrainingSteps?.length ? (
                <p className="next-action-detail">{selectedProgress.detail}</p>
              ) : null}
              {selectedAgent.nextTrainingSteps?.length ? (
                <div className="next-training-steps">
                  <strong>接下来可补的技能</strong>
                  <p>{selectedAgent.nextTrainingSteps.slice(0, 2).join('；')}</p>
                  <small>当前等级 → 养成目标</small>
                  {selectedAgent.nextTrainingSteps.length > 2 ? (
                    <details>
                      <summary>其余 {selectedAgent.nextTrainingSteps.length - 2} 项</summary>
                      <p>{selectedAgent.nextTrainingSteps.slice(2).join('；')}</p>
                    </details>
                  ) : null}
                </div>
              ) : null}
              <button
                className="primary"
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
