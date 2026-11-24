import type { TeamExecutionWorkspaceSurfaceProps } from './teamExecutionWorkspaceTypes'
import { teamEquipmentSelectionErrorMessage } from './teamEquipmentSelectionFeedback'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { TargetTeamEquipmentParameterSelection } from '../application/calculationQueryContract'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { TeamDeploymentControl } from './TeamDeploymentControl'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { currentTeamCultivation } from '../application/formedCultivationGaps'
import { resolveMemberMindscapeDisplay } from './teamMemberMindscapePresentation'
import {
  TeamLoadoutMindscapeBadge,
  TeamLoadoutMindscapeSuggestion,
} from './TeamLoadoutMindscapeBadge'
import { incompleteTeamLoadoutMessage, isSpecificTeamDiscReason } from './teamExecutionPresentation'
import { createTeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { teamDiscCompletion } from '../domain/teamDiscCompletion'
import { targetTeamBuildDirectionConditions } from '../application/targetTeamEffectivePotentialConditions'
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
import { TeamExecutionAllMembersView } from './TeamExecutionAllMembersView'
import {
  equipmentParameterSelection,
  TeamSchemeBangbooControl,
  TeamSchemeWEngineControl,
} from './TeamEquipmentParameterForm'
import { useTeamDiscAttributeLinkage } from './useTeamDiscAttributeLinkage'
import './team-loadout-reference-badges.css'

export function TeamExecutionWorkspaceSurface({
  view,
  bangbooId,
  warehouse,
  alternate,
  execution,
  onRosterChange,
  targetTeamFit,
  savedPotentialByAgentId,
  discRecommendations,
  onConfirmEquipmentParameters,
  onDeploymentOrderChange,
  evidence,
  readOnly = false,
}: TeamExecutionWorkspaceSurfaceProps) {
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

  const {
    selectedDiscId,
    selectedAttributeKey,
    matchedAttributeKeys,
    isDiscHighlighted,
    handleDiscSelect,
    handleAttributeSelect,
    handleDeselect,
  } = useTeamDiscAttributeLinkage(view, selectedMemberId, setSelectedMemberId)
  const currentCultivation = currentTeamCultivation(
    view.members.map((member) => member.agentId),
    warehouse.roster,
  )
  const selectedExecutionMember = execution?.members.find(
    (member) => member.agentId === selectedMember?.agentId,
  )
  const selectedAccountAgent = warehouse.roster.agents.find(
    (agent) => agent.agentId === selectedMember?.agentId,
  )
  const bangbooLabel = bangbooId ? playerFacingBangbooLabel(bangbooId) : '未记录'
  const bangbooStarLabel = execution?.bangbooStar ? ` · ${execution.bangbooStar} 星` : ''
  const expectedDiscCount = 18
  const completion = teamDiscCompletion(
    targetTeamFit?.memberIds ?? view.members.map((member) => member.agentId),
    view.members,
    warehouse.discs,
  )
  const displayedDiscCount = completion.matchedSlots
  const hasCompleteTeamLoadout = completion.complete
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
          equippedDiscIds: readOnly ? (selectedAccountAgent.equippedDiscIds ?? []) : undefined,
          discs: warehouse.discs,
          wEngines: warehouse.roster.wEngines,
          memberIds: view.members.map((member) => member.agentId),
          buildDirectionConditions: targetTeamBuildDirectionConditions({
            memberIds: view.members.map((member) => member.agentId),
            roster: warehouse.roster,
            potentialByAgentId:
              targetTeamFit?.effectiveEquipmentParameters?.potentialByAgentId ??
              savedPotentialByAgentId,
          }),
        })
      : null
  useStateTransitionMotion({
    scope: loadoutMotionScope,
    stateKey: `${loadoutView}:${selectedMember?.agentId ?? 'empty'}:${selectedMember?.discFacts.map((disc) => disc.id).join('|') ?? ''}`,
    target: '.team-execution__workspace',
    enabled: !equipmentPending,
  })
  useLayoutEffect(() => {
    const memberId = pendingMemberFocus.current
    if (memberId && memberId === selectedMember?.agentId) {
      pendingMemberFocus.current = null
      memberTabRefs.current.get(memberId)?.focus()
    } else if (previousLoadoutView.current !== loadoutView) {
      loadoutHeadingRef.current?.focus()
    }
    previousLoadoutView.current = loadoutView
  }, [selectedMember?.agentId, loadoutView])
  if (!selectedMember) return null
  return (
    <section className={`team-execution is-${view.status}`} aria-labelledby={headingId}>
      <section className="team-execution__loadout" ref={loadoutMotionScope}>
        <div className="team-execution__top-rail">
          <div className="team-execution__formation">
            <div className="team-execution__member-strip" role="tablist" aria-label="选择队伍成员">
              {view.members.map((member, position) => {
                const substitutes = substitutesForMember(member, alternate)
                const mindscape = resolveMemberMindscapeDisplay(
                  member.agentId,
                  targetTeamFit?.formedTeamReference,
                  currentCultivation[member.agentId],
                )
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
                        memberTabRefs.current.get(view.members[next].agentId)?.focus()
                        handleDeselect()
                        setSelectedMemberId(view.members[next].agentId)
                        setLoadoutView('member')
                      }}
                      className={selectedMember.agentId === member.agentId ? 'is-selected' : ''}
                      onClick={() => {
                        setSelectedMemberId(member.agentId)
                        setLoadoutView('member')
                        handleDeselect()
                      }}
                    >
                      <span className="team-execution__member-portrait">
                        <TeamMemberVisual
                          agentId={member.agentId}
                          name={member.agentName}
                          className="team-execution__member-avatar"
                        />
                        <TeamLoadoutMindscapeBadge display={mindscape} />
                      </span>
                      <span className="team-execution__member-copy">
                        <span className="team-execution__member-summary-line">
                          <strong className="team-execution__member-name">
                            {member.agentName}
                          </strong>
                          <TeamLoadoutMindscapeSuggestion display={mindscape} />
                          <span className="team-execution__member-status">
                            {position + 1}号位 · {member.statusLabel}
                          </span>
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
                  {bangbooId ? bangbooStarLabel.replace(/^ · /, '') || '星级未记录' : ''}
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
                    {hasCompleteTeamLoadout ? null : (
                      <p id={descriptionId}>{loadoutProgressLabel}</p>
                    )}
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
                    全队驱动盘<span aria-hidden="true"> · {expectedDiscCount}槽</span>
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
                    <TeamExecutionDiscCard
                      disc={disc}
                      key={disc.id}
                      selected={selectedDiscId === disc.id}
                      highlighted={isDiscHighlighted(disc, selectedMember.agentId)}
                      onSelect={() => handleDiscSelect(disc, selectedMember.agentId)}
                      onDeselect={handleDeselect}
                    />
                  ))}
                </ol>
              ) : null}
              <MissingTeamDiscsNotice count={selectedMember.missingDiscIds.length} />
            </article>
          ) : (
            <TeamExecutionAllMembersView
              view={view}
              headingId={headingId}
              descriptionId={descriptionId}
              loadoutHeadingRef={loadoutHeadingRef}
              hasCompleteTeamLoadout={hasCompleteTeamLoadout}
              loadoutProgressLabel={loadoutProgressLabel}
              expectedDiscCount={expectedDiscCount}
              selectedDiscId={selectedDiscId}
              isDiscHighlighted={isDiscHighlighted}
              onSelectDisc={handleDiscSelect}
              onDeselect={handleDeselect}
              onSelectMemberView={(memberId) => {
                if (memberId) {
                  setSelectedMemberId(memberId)
                  handleDeselect()
                }
                setLoadoutView('member')
              }}
              onSelectTeamView={() => setLoadoutView('team')}
            />
          )}
          <TeamExecutionAttributeInspector
            accountId={warehouse.accountId ?? undefined}
            selectedMember={selectedMember}
            attributePanel={attributePanel}
            matchedAttributeKeys={matchedAttributeKeys}
            selectedAttributeKey={selectedAttributeKey}
            onSelectAttribute={handleAttributeSelect}
            onDeselectAttribute={handleDeselect}
          />
        </div>
      </section>
    </section>
  )
}

export type * from './teamExecutionWorkspaceTypes'
