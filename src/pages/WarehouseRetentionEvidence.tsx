import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { fitFloatingLayer, getEffectiveZoom } from '../components/floatingLayerGeometry'
import type { DriveDisc } from '../domain/schemas'
import type { RetentionBlocker } from '../warehouse/absoluteDiscRetentionContract'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { retentionUseMatchesRecommendedSet } from '../warehouse/warehouseRetentionGuidance'
import { readableAgentName } from './warehouseFactLabels'
import {
  blockerText,
  branchLabel,
  playerRetentionCopy,
  readableDetail,
} from './warehouseRetentionCopy'
import { RetentionScoreDetails, RetentionSourceDetails } from './WarehouseRetentionDetails'
import { WarehouseRetentionUse } from './WarehouseRetentionUse'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]
const useStateOrder: Record<NonNullable<Use['useState']>, number> = {
  valid: 0,
  conditional: 1,
  missing_fact: 2,
  incompatible: 3,
}

function retentionUseLabel(use: Use) {
  return readableDetail(
    use.profileLabel ??
      use.guidance?.profileLabel ??
      use.profileDimensions?.[0] ??
      branchLabel(use.profileId) ??
      '相关构筑',
  )
}

function branchDescription(use: Use) {
  const label = retentionUseLabel(use)
  const distinction = [...(use.profileDimensions ?? []), ...(use.guidance?.profileDimensions ?? [])]
    .map(readableDetail)
    .find((detail) => detail && !label.includes(detail))
  return distinction ? `${label} · ${distinction}` : label
}

function blockerKey(blocker: RetentionBlocker) {
  return `${blocker.profileId ?? ''}|${blocker.field}|${blocker.predicateId}`
}

function RetentionAgentDialog({
  id,
  evidence,
  agentUses,
  disc,
  discLevel,
  trigger,
  onClose,
}: {
  id: string
  evidence: WarehouseAbsoluteRetentionEvidence
  agentUses: Use[]
  disc?: DriveDisc
  discLevel: number
  trigger: HTMLElement | null
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const [selectedProfileId, setSelectedProfileId] = useState(agentUses[0]!.profileId)
  const selected = agentUses.find((use) => use.profileId === selectedProfileId) ?? agentUses[0]!
  const agentName = readableAgentName(selected.agentId)
  const allBlockers = [...(evidence.blockedBy ?? [])]
  const blockers = [
    ...new Map(
      [...allBlockers, ...(selected.blockers ?? [])]
        .filter(
          (blocker) =>
            blockerText(blocker) !== null &&
            (!blocker.profileId || blocker.profileId === selected.profileId),
        )
        .map((blocker) => [blockerKey(blocker), blocker]),
    ).values(),
  ]

  useEffect(() => {
    const previouslyFocused = trigger
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const handleOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !trigger?.contains(event.target)
      )
        onCloseRef.current()
    }
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleOutside)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [trigger])

  useLayoutEffect(() => {
    const position = () => {
      const panel = panelRef.current
      if (!panel || !trigger?.isConnected) return
      const scale = getEffectiveZoom(panel)
      const scrollTop = panel.scrollTop
      const scrollLeft = panel.scrollLeft
      panel.style.maxHeight = ''
      const bounds = panel.getBoundingClientRect()
      const fitted = fitFloatingLayer({
        anchor: trigger.getBoundingClientRect(),
        width: bounds.width,
        height: bounds.height,
        scale,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        align: 'start',
      })
      panel.style.left = `${fitted.left}px`
      panel.style.top = `${fitted.top}px`
      panel.style.maxHeight = `${fitted.maxHeight}px`
      panel.style.visibility = 'visible'
      panel.scrollTop = scrollTop
      panel.scrollLeft = scrollLeft
    }
    position()
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return
      position()
    }
    window.addEventListener('resize', position)
    window.addEventListener('scroll', onScroll, true)
    panelRef.current?.addEventListener('toggle', position, true)
    let resizeFrame: number | undefined
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (resizeFrame !== undefined) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = undefined
        position()
      })
    })
    if (panelRef.current && observer) {
      observer.observe(panelRef.current)
      Array.from(panelRef.current.children).forEach((child) => observer.observe(child))
    }
    if (trigger) observer?.observe(trigger)
    const currentPanel = panelRef.current
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', onScroll, true)
      currentPanel?.removeEventListener('toggle', position, true)
      observer?.disconnect()
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame)
    }
  }, [trigger, selectedProfileId])

  return createPortal(
    <div className="f5v-shell warehouse-retention__floating-host">
      <section
        id={id}
        ref={panelRef}
        role="dialog"
        aria-label={`${agentName}的词条匹配`}
        className="warehouse-retention__agent-popover"
      >
        <header className="warehouse-retention__agent-popover-header">
          <div>
            <strong>{agentName}</strong>
            {agentUses.length > 1 ? <span>{agentUses.length} 个推荐用途</span> : null}
          </div>
          <button ref={closeRef} className="button button--quiet" type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        {agentUses.length > 1 ? (
          <label className="warehouse-retention__branch-select">
            <span>推荐用途</span>
            <select
              value={selected.profileId}
              onChange={(event) => setSelectedProfileId(event.currentTarget.value)}
            >
              {agentUses.map((use, index) => (
                <option key={use.profileId} value={use.profileId}>
                  {branchDescription(use)}
                  {index ? ` · ${index + 1}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="warehouse-action-drawer__section-heading">
          <h3>词条匹配</h3>
        </div>
        <RetentionScoreDetails evidence={evidence} use={selected} />
        <WarehouseRetentionUse use={selected} disc={disc} discLevel={discLevel} />
        {blockers.length ? (
          <details className="warehouse-retention__details">
            <summary>查看本用途条件</summary>
            <RetentionSourceDetails evidence={evidence} blockers={blockers} use={selected} />
          </details>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}

/** Read-only player guidance; the underlying policy and provenance stay available. */
export function WarehouseRetentionEvidence({
  evidence,
  discLevel,
  disc,
  ownedAgentIds,
  showRecommendation = true,
  showSecondaryReason = false,
  showRoles = true,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  discLevel: number
  disc?: DriveDisc
  ownedAgentIds: ReadonlySet<string>
  showRecommendation?: boolean
  showSecondaryReason?: boolean
  showRoles?: boolean
}) {
  const dialogId = useId()
  const [openAgentTrigger, setOpenAgentTrigger] = useState<HTMLElement | null>(null)
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const copy = playerRetentionCopy(evidence, discLevel)
  const witnesses = new Set(evidence.witnessProfileIds ?? [])
  const rankedUses = [
    ...new Map(
      evidence.leadingUses
        .filter(
          (use) =>
            retentionUseMatchesRecommendedSet(disc?.setId ?? use.guidance?.currentSet?.id, use) &&
            use.setFit !== 'incompatible' &&
            use.mainFit !== 'incompatible',
        )
        .map((use) => [use.profileId, use] as const),
    ).values(),
  ].sort(
    (left, right) =>
      Number(witnesses.has(right.profileId)) - Number(witnesses.has(left.profileId)) ||
      Number(ownedAgentIds.has(right.agentId)) - Number(ownedAgentIds.has(left.agentId)) ||
      (useStateOrder[left.useState ?? 'valid'] ?? 4) -
        (useStateOrder[right.useState ?? 'valid'] ?? 4),
  )
  const agentIds = [...new Set(rankedUses.map((use) => use.agentId))]
  const openAgentUses = openAgentId ? rankedUses.filter((use) => use.agentId === openAgentId) : []
  const recordIssues = [
    ...new Set(
      (evidence.blockedBy ?? [])
        .filter((blocker) => blocker.kind === 'record')
        .map((blocker) => readableDetail(blocker.detail))
        .filter((detail) => !/[a-z_]/i.test(detail)),
    ),
  ]

  return (
    <section
      className="warehouse-retention warehouse-action-drawer__section"
      aria-label={showRoles ? '适用角色' : '当前建议'}
    >
      {showRecommendation ? (
        <>
          <p role="status" className="warehouse-retention__action">
            <span>当前建议 · </span>
            <strong>{copy.title}</strong>
          </p>
          <p className="warehouse-retention__reason">{copy.explanation}</p>
          {copy.stop ? <p className="warehouse-retention__stop">{copy.stop}</p> : null}
        </>
      ) : null}
      {showSecondaryReason && copy.explanation !== '这张盘正在装备。' ? (
        <details className="warehouse-retention__details">
          <summary>查看词条分析说明</summary>
          <p>{copy.explanation}</p>
        </details>
      ) : null}
      {showRoles &&
        recordIssues.map((issue) => (
          <p className="warehouse-retention__record-issue" key={issue}>
            {issue}
          </p>
        ))}
      {showRoles ? (
        <div className="warehouse-retention__uses">
          <div className="warehouse-action-drawer__section-heading">
            <h3>适用角色</h3>
            <span>{agentIds.length} 名角色</span>
          </div>
          {agentIds.length ? (
            <ul className="warehouse-retention__agent-grid" aria-label="适用角色">
              {agentIds.map((agentId) => {
                const agentUses = rankedUses.filter((use) => use.agentId === agentId)
                const open = openAgentId === agentId
                return (
                  <li key={agentId}>
                    <button
                      className="button button--quiet warehouse-retention__agent"
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={open}
                      aria-controls={dialogId}
                      aria-label={`查看${readableAgentName(agentId)}的词条匹配，${agentUses.length} 个推荐用途`}
                      onClick={(event) => {
                        setOpenAgentTrigger(event.currentTarget)
                        setOpenAgentId((current) => (current === agentId ? null : agentId))
                      }}
                    >
                      <VisualEntityImage
                        className="warehouse-retention__agent-image"
                        entityType="agent"
                        entityId={agentId}
                        name={readableAgentName(agentId)}
                        slotId="agent.square-avatar"
                        consumer="warehouse.action-list"
                      />
                      <span className="warehouse-retention__agent-name">
                        {readableAgentName(agentId)}
                      </span>
                      <span
                        className="warehouse-retention__role-state"
                        data-state={ownedAgentIds.has(agentId) ? 'owned' : 'reserve'}
                      >
                        {ownedAgentIds.has(agentId) ? '已拥有' : '未拥有'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p>暂无适用角色</p>
          )}
        </div>
      ) : null}
      {showRoles && openAgentId && openAgentUses.length ? (
        <RetentionAgentDialog
          id={dialogId}
          evidence={evidence}
          agentUses={openAgentUses}
          disc={disc}
          discLevel={discLevel}
          trigger={openAgentTrigger}
          onClose={() => setOpenAgentId(null)}
        />
      ) : null}
    </section>
  )
}
