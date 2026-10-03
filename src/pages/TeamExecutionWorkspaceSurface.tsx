import { teamEquipmentSelectionErrorMessage } from './teamEquipmentSelectionFeedback'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { VisualEntityImage } from '../components/VisualEntityImage'
import type { TeamExecution } from '../decision/teamExecutionProjection'
import type { TeamDeploymentOrder } from '../decision/teamDeployment'
import { TeamDeploymentControl } from './TeamDeploymentControl'
import type { BuildIntentRecommendation } from '../decision/buildIntent'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import {
  incompleteTeamLoadoutMessage,
  isSpecificTeamDiscReason,
  presentTeamExecution,
} from './teamExecutionPresentation'
import { createTeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { useStateTransitionMotion } from '../motion/useStateTransitionMotion'
import { substitutesForMember } from './teamExecutionWorkspaceSubstitutes'
import {
  TeamExecutionAttributeInspector,
  TeamExecutionDiscCard,
  TeamExecutionLoadoutSummary,
  TeamMemberVisual,
  WEngineVisual,
  MissingTeamDiscsNotice,
} from './teamExecutionWorkspaceParts'
import {
  equipmentParameterSelection,
  TeamSchemeBangbooControl,
  TeamSchemeWEngineControl,
} from './TeamEquipmentParameterForm'
export type TeamExecutionWorkspaceSubstitute = {
  targetAgentId: string
  agentId: string
  agentName: string
  onSelect?: () => void
}

export type TeamExecutionWorkspaceAlternate = {
  agentId: string
  agentName: string
  replacedAgentId?: string
  replacedAgentName?: string
  onSelect?: () => void
  alternatives?: readonly TeamExecutionWorkspaceSubstitute[]
}

export function TeamExecutionWorkspaceSurface({
  view,
  bangbooId,
  warehouse,
  alternate,
  execution,
  onRosterChange,
  targetTeamFit,
  discRecommendations,
  onConfirmEquipmentParameters,
  onDeploymentOrderChange,
  evidence,
  readOnly = false,
}: {
  view: ReturnType<typeof presentTeamExecution>
  bangbooId: string | null
  warehouse: CoreWarehouse
  alternate?: TeamExecutionWorkspaceAlternate
  execution?: TeamExecution
  onRosterChange?: (roster: CoreWarehouse['roster']) => void
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  discRecommendations?: readonly BuildIntentRecommendation[]
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  onDeploymentOrderChange?: (order: TeamDeploymentOrder | undefined) => void
  evidence?: ReactNode
  readOnly?: boolean
}) {
  const [selectedMemberId, setSelectedMemberId] = useState(view.members[0]?.agentId ?? '')
  const [loadoutView, setLoadoutView] = useState<'member' | 'team'>('member')
  const [equipmentPending, setEquipmentPending] = useState(false)
  const [equipmentError, setEquipmentError] = useState('')
  const loadoutHeadingRef = useRef<HTMLHeadingElement>(null)
  const loadoutMotionScope = useRef<HTMLElement>(null)
  const memberTabRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingMemberFocus = useRef<string | null>(null)
  const headingId = useId()
  const descriptionId = useId()
  const previousLoadoutView = useRef(loadoutView)
  const selectedMember =
    view.members.find((member) => member.agentId === selectedMemberId) ?? view.members[0]
  const selectedExecutionMember = execution?.members.find(
    (member) => member.agentId === selectedMember?.agentId,
  )
  const selectedAccountAgent = warehouse.roster.agents.find(
    (agent) => agent.agentId === selectedMember?.agentId,
  )
  const bangbooLabel = bangbooId ? playerFacingBangbooLabel(bangbooId) : '未纳入'
  const bangbooStarLabel = execution?.bangbooStar ? ` · ${execution.bangbooStar} 星` : ''
  const expectedDiscCount = view.members.length * 6
  const displayedDiscCount = view.members.reduce(
    (count, member) => count + member.discFacts.length,
    0,
  )
  const hasCompleteTeamLoadout =
    displayedDiscCount === expectedDiscCount &&
    view.members.every((member) => member.missingDiscIds.length === 0)
  const specificTeamDiscReasons = [
    ...new Set(
      (targetTeamFit?.warehousePlan.gaps ?? []).filter((reason) =>
        isSpecificTeamDiscReason(reason),
      ),
    ),
  ]
  const loadoutProgressLabel = hasCompleteTeamLoadout
    ? `本次方案 ${displayedDiscCount}/${expectedDiscCount} 张已匹配驱动盘`
    : specificTeamDiscReasons.length
      ? specificTeamDiscReasons.join('；')
      : incompleteTeamLoadoutMessage
  const schemeSelection = targetTeamFit
    ? equipmentParameterSelection({
        memberIds: targetTeamFit.memberIds,
        recommendations: targetTeamFit.equipmentRecommendations,
        effectiveParameters: targetTeamFit.effectiveEquipmentParameters,
      })
    : null
  const applyEquipmentSelection = (selection: TargetTeamEquipmentParameterSelection) => {
    if (!onConfirmEquipmentParameters || equipmentPending) return
    setEquipmentPending(true)
    setEquipmentError('')
    void onConfirmEquipmentParameters(selection)
      .catch((error: unknown) => setEquipmentError(teamEquipmentSelectionErrorMessage(error)))
      .finally(() => setEquipmentPending(false))
  }
  const applyEquipmentEdit = (selection: TargetTeamEquipmentParameterSelection) =>
    applyEquipmentSelection({ ...selection, koledaFixedEventConditions32: undefined })
  const attributePanel =
    selectedExecutionMember && selectedAccountAgent
      ? createTeamExecutionAttributePanel({
          agent: selectedAccountAgent,
          member: selectedExecutionMember,
          discs: warehouse.discs,
          wEngines: warehouse.roster.wEngines,
          memberIds: view.members.map((member) => member.agentId),
        })
      : null
  useEffect(() => {
    if (previousLoadoutView.current !== loadoutView) loadoutHeadingRef.current?.focus()
    previousLoadoutView.current = loadoutView
  }, [loadoutView])
  useStateTransitionMotion({
    scope: loadoutMotionScope,
    stateKey: `${selectedMember?.agentId ?? 'empty'}:${selectedMember?.discFacts.map((disc) => disc.id).join('|') ?? ''}`,
    includeScope: true,
    enabled: !equipmentPending,
  })
  useLayoutEffect(() => {
    const memberId = pendingMemberFocus.current
    if (!memberId || memberId !== selectedMember?.agentId) return
    pendingMemberFocus.current = null
    memberTabRefs.current.get(memberId)?.focus()
  }, [selectedMember?.agentId])
  if (!selectedMember) return null
  return (
    <section className={`team-execution is-${view.status}`} aria-labelledby={headingId}>
      <section
        className="team-execution__loadout"
        aria-labelledby={descriptionId}
        ref={loadoutMotionScope}
      >
        <div className="team-execution__top-rail">
          <div className="team-execution__formation">
            <div className="team-execution__member-strip" role="tablist" aria-label="选择队伍成员">
              {view.members.map((member, position) => {
                const substitutes = substitutesForMember(member, alternate)
                return (
                  <div className="team-execution__member-slot" key={member.agentId}>
                    <button
                      ref={(element) => {
                        if (element) memberTabRefs.current.set(member.agentId, element)
                        else memberTabRefs.current.delete(member.agentId)
                      }}
                      type="button"
                      role="tab"
                      id={`${headingId}-${member.agentId}`}
                      aria-controls={`${headingId}-panel`}
                      tabIndex={selectedMember.agentId === member.agentId ? 0 : -1}
                      aria-selected={selectedMember.agentId === member.agentId}
                      onKeyDown={(event) => {
                        const index = view.members.findIndex(
                          (entry) => entry.agentId === member.agentId,
                        )
                        const next =
                          event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? view.members.length - 1
                              : event.key === 'ArrowRight'
                                ? (index + 1) % view.members.length
                                : event.key === 'ArrowLeft'
                                  ? (index + view.members.length - 1) % view.members.length
                                  : null
                        if (next === null) return
                        event.preventDefault()
                        pendingMemberFocus.current = view.members[next].agentId
                        setSelectedMemberId(view.members[next].agentId)
                        setLoadoutView('member')
                      }}
                      className={selectedMember.agentId === member.agentId ? 'is-selected' : ''}
                      onClick={() => {
                        setSelectedMemberId(member.agentId)
                        setLoadoutView('member')
                      }}
                    >
                      <TeamMemberVisual
                        agentId={member.agentId}
                        name={member.agentName}
                        className="team-execution__member-avatar"
                      />
                      <span className="team-execution__member-copy">
                        <strong>{member.agentName}</strong>
                        <span>
                          {position + 1}号位 · {member.statusLabel}
                        </span>
                      </span>
                    </button>
                    {substitutes.length ? (
                      <div
                        className="team-execution__replacement"
                        aria-label={`${member.agentName}的替补`}
                      >
                        <span>替补</span>
                        <div className="team-execution__replacement-list">
                          {substitutes.map((replacement) => {
                            const replacementTargetName =
                              alternate &&
                              !alternate.alternatives?.length &&
                              alternate.replacedAgentName
                                ? alternate.replacedAgentName
                                : member.agentName
                            const label = `用${replacement.agentName}替换${replacementTargetName}`
                            const avatar = (
                              <TeamMemberVisual
                                agentId={replacement.agentId}
                                name={replacement.agentName}
                                className="team-execution__same-core-avatar"
                              />
                            )
                            return replacement.onSelect ? (
                              <button
                                key={`${replacement.targetAgentId}:${replacement.agentId}`}
                                type="button"
                                aria-label={label}
                                title={label}
                                onClick={replacement.onSelect}
                              >
                                {avatar}
                              </button>
                            ) : (
                              <span
                                key={`${replacement.targetAgentId}:${replacement.agentId}`}
                                title={label}
                                aria-label={label}
                              >
                                {avatar}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <TeamDeploymentControl
              memberIds={view.members.map((member) => member.agentId)}
              customOrder={execution?.deploymentOrder}
              disabled={readOnly || equipmentPending}
              onChange={onDeploymentOrderChange}
            />
          </div>
          <div
            className="team-execution__bangboo"
            aria-label={`邦布：${bangbooLabel}${bangbooStarLabel}`}
          >
            {bangbooId && targetTeamFit && schemeSelection ? (
              <TeamSchemeBangbooControl
                recommendations={targetTeamFit.equipmentRecommendations}
                selection={schemeSelection}
                pending={equipmentPending || !onConfirmEquipmentParameters}
                onChange={applyEquipmentEdit}
              />
            ) : (
              <div className="team-execution__scheme-control team-execution__scheme-control--bangboo team-execution__scheme-control--static">
                {bangbooId && (
                  <VisualEntityImage
                    className="team-execution__scheme-image"
                    entityId={bangbooId}
                    entityType="bangboo"
                    name={bangbooLabel}
                    slotId="bangboo.team-icon"
                    consumer="box.team-workspace"
                  />
                )}
                <span className="team-execution__scheme-static-copy">
                  <small>邦布</small>
                  <strong>{bangbooLabel}</strong>
                </span>
                <span className="team-execution__scheme-static-meta">
                  {bangbooId ? bangbooStarLabel.replace(/^ · /, '') || '星级待确认' : '未纳入'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="team-execution__workspace"
          id={`${headingId}-panel`}
          role="tabpanel"
          aria-labelledby={`${headingId}-${selectedMember.agentId}`}
        >
          {loadoutView === 'member' ? (
            <article
              className="team-execution__member-workspace"
              aria-label={`${selectedMember.agentName}配装`}
            >
              <header className="team-execution__loadout-heading">
                <div>
                  <h2 ref={loadoutHeadingRef} id={headingId} tabIndex={-1}>
                    {selectedMember.agentName}的方案配装
                  </h2>
                  <div className="team-execution__heading-meta">
                    <p id={descriptionId}>{loadoutProgressLabel}</p>
                    <TeamExecutionLoadoutSummary
                      key={selectedMember.agentId}
                      selectedMember={selectedMember}
                      view={view}
                      warehouse={warehouse}
                      onRosterChange={onRosterChange ?? (() => undefined)}
                      readOnly={readOnly}
                      discRecommendation={
                        (targetTeamFit?.buildIntent.recommendations ?? discRecommendations)?.find(
                          (item) => item.agentId === selectedMember.agentId,
                        )?.constraint
                      }
                      hideEngine
                      schemeDegradeReasons={
                        targetTeamFit?.warehousePlan.loadouts.find(
                          (loadout) => loadout.agentId === selectedMember.agentId,
                        )?.degradeReasons.length
                          ? [
                              ...new Set(
                                targetTeamFit.warehousePlan.loadouts.find(
                                  (loadout) => loadout.agentId === selectedMember.agentId,
                                )?.degradeReasons,
                              ),
                            ]
                          : []
                      }
                    />
                  </div>
                </div>
                <div className="team-execution__header-engine">
                  {bangbooId && targetTeamFit && schemeSelection ? (
                    <TeamSchemeWEngineControl
                      agentId={selectedMember.agentId}
                      recommendations={targetTeamFit.equipmentRecommendations}
                      selection={schemeSelection}
                      pending={equipmentPending || !onConfirmEquipmentParameters}
                      onChange={applyEquipmentEdit}
                    />
                  ) : (
                    <div className="team-execution__scheme-control team-execution__scheme-control--wengine team-execution__scheme-control--static">
                      <WEngineVisual
                        className="team-execution__scheme-image"
                        engineId={selectedMember.suggestedWEngineId}
                        name={selectedMember.suggestedWEngineLabel}
                      />
                      <span
                        className="team-execution__scheme-static-copy"
                        aria-label={`${selectedMember.agentName}方案音擎`}
                      >
                        <small>音擎</small>
                        <strong>{selectedMember.suggestedWEngineLabel}</strong>
                      </span>
                    </div>
                  )}
                </div>
                <div className="team-execution__view-toggle" role="group" aria-label="完整配装视图">
                  <button type="button" aria-pressed onClick={() => setLoadoutView('member')}>
                    当前角色
                  </button>
                  <button type="button" aria-pressed={false} onClick={() => setLoadoutView('team')}>
                    全队驱动盘
                  </button>
                </div>
              </header>
              {evidence && hasCompleteTeamLoadout ? (
                <div className="team-execution__evidence">{evidence}</div>
              ) : null}
              {equipmentError ? (
                <p className="team-execution__scheme-error" role="alert">
                  {equipmentError}
                </p>
              ) : null}
              {selectedMember.discFacts.length > 0 ? (
                <ol
                  className="team-execution__disc-slots"
                  aria-label={`${selectedMember.agentName}的六张驱动盘`}
                >
                  {selectedMember.discFacts.map((disc) => (
                    <TeamExecutionDiscCard disc={disc} key={disc.id} />
                  ))}
                </ol>
              ) : null}
              <MissingTeamDiscsNotice count={selectedMember.missingDiscIds.length} />
            </article>
          ) : (
            <div className="team-execution__all-members" aria-label="全队驱动盘配装">
              <header className="team-execution__loadout-heading">
                <div>
                  <h2 ref={loadoutHeadingRef} id={headingId} tabIndex={-1}>
                    全队配装
                  </h2>
                  <p id={descriptionId}>按成员查看 {loadoutProgressLabel}、已录入音擎与推荐方向</p>
                </div>
                <div className="team-execution__view-toggle" role="group" aria-label="完整配装视图">
                  <button
                    type="button"
                    aria-pressed={false}
                    onClick={() => setLoadoutView('member')}
                  >
                    当前角色
                  </button>
                  <button type="button" aria-pressed onClick={() => setLoadoutView('team')}>
                    全队驱动盘
                  </button>
                </div>
              </header>
              {view.members.map((member) => (
                <article key={member.agentId}>
                  <header>
                    <div className="team-execution__all-member-identity">
                      <TeamMemberVisual
                        agentId={member.agentId}
                        name={member.agentName}
                        className="team-execution__all-member-avatar"
                      />
                      <h4>{member.agentName}</h4>
                    </div>
                    <div className="team-execution__all-member-engine">
                      <WEngineVisual
                        className="team-execution__all-member-engine-visual"
                        engineId={member.suggestedWEngineId}
                        name={member.suggestedWEngineLabel}
                      />
                      <span>{member.suggestedWEngineLabel}</span>
                    </div>
                    <button
                      className="team-execution__member-detail-action"
                      type="button"
                      onClick={() => {
                        setSelectedMemberId(member.agentId)
                        setLoadoutView('member')
                      }}
                    >
                      查看角色配装
                    </button>
                  </header>
                  {member.discFacts.length > 0 ? (
                    <ol aria-label={`${member.agentName}的六张驱动盘`}>
                      {member.discFacts.map((disc) => (
                        <TeamExecutionDiscCard condensed disc={disc} key={disc.id} />
                      ))}
                    </ol>
                  ) : null}
                  <MissingTeamDiscsNotice count={member.missingDiscIds.length} />
                </article>
              ))}
            </div>
          )}
          <TeamExecutionAttributeInspector
            selectedMember={selectedMember}
            attributePanel={attributePanel}
          />
        </div>
      </section>
    </section>
  )
}
