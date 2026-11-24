import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { teamDiscCompletion } from '../domain/teamDiscCompletion'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import {
  equipmentParameterSelection,
  wEngineOptions,
} from '../application/equipmentParameterSelection'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { getAgentName } from '../application/publicRosterNames'
import type { TeamDeploymentOrder } from '../decision/teamDeployment'
import type { TeamExecutionPresentation } from './teamExecutionPresentation'
import type { TeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { PublicTeamAttributeInspector } from './PublicTeamAttributeInspector'
import type { TeamExecutionWorkspaceAlternate } from './TeamExecutionWorkspaceSurface'
import { substitutesForMember } from './teamExecutionWorkspaceSubstitutes'
import { TeamExecutionDiscCard } from './teamExecutionDiscCard'
import { PlayerSelect } from '../components/PlayerSelect'
import { currentTeamCultivation } from '../application/formedCultivationGaps'
import { resolveMemberMindscapeDisplay } from './teamMemberMindscapePresentation'
import { TeamLoadoutMindscapeSuggestion } from './TeamLoadoutMindscapeBadge'
import { useTeamDiscAttributeLinkage } from './useTeamDiscAttributeLinkage'
import './team-equipment-parameters.css'

/** The public browser renders only the private Query's accepted player-facing facts. */
export function PublicTeamExecutionPanel({
  view,
  attributePanelsByAgent,
  alternate,
  warehouse,
  targetTeamFit,
  onConfirmEquipmentParameters,
  onDeploymentOrderChange,
  deploymentOrder,
  readOnly = false,
  evidence,
}: {
  view: TeamExecutionPresentation
  attributePanelsByAgent?: Record<string, TeamExecutionAttributePanel>
  alternate?: TeamExecutionWorkspaceAlternate
  warehouse: CoreWarehouse
  targetTeamFit?: TargetTeamWarehouseFitQueryResult
  onConfirmEquipmentParameters?: (selection: TargetTeamEquipmentParameterSelection) => Promise<void>
  onDeploymentOrderChange?: (order: TeamDeploymentOrder | undefined) => void
  deploymentOrder?: TeamDeploymentOrder
  readOnly?: boolean
  evidence?: ReactNode
}) {
  const headingId = useId()
  const [selectedMemberId, setSelectedMemberId] = useState(view.members[0]?.agentId ?? '')
  const [showWholeTeam, setShowWholeTeam] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const memberTabRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingMemberFocus = useRef<string | null>(null)
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
  const expectedDiscCount = 18
  const completion = teamDiscCompletion(
    targetTeamFit?.memberIds ?? view.members.map((member) => member.agentId),
    view.members,
    warehouse.discs,
  )
  const actualDiscCount = completion.matchedSlots
  const selection = targetTeamFit
    ? equipmentParameterSelection({
        memberIds: targetTeamFit.memberIds,
        recommendations: targetTeamFit.equipmentRecommendations,
        effectiveParameters: targetTeamFit.effectiveEquipmentParameters,
      })
    : null
  const bangbooOptions = targetTeamFit?.equipmentRecommendations.bangboo.options ?? []
  const selectedBangboo = bangbooOptions.find((option) => option.bangbooId === selection?.bangbooId)
  const currentOrder =
    deploymentOrder ??
    targetTeamFit?.targetExecution.deploymentOrder ??
    view.members.map((member) => member.agentId)
  const orderedMembers = [
    ...new Set(currentOrder),
    ...view.members.map((member) => member.agentId),
  ].flatMap((agentId, index, all) => {
    if (all.indexOf(agentId) !== index) return []
    const member = view.members.find((item) => item.agentId === agentId)
    return member ? [member] : []
  })
  const orderedNames = currentOrder.map(getAgentName)

  useLayoutEffect(() => {
    const memberId = pendingMemberFocus.current
    if (!memberId || memberId !== selectedMember?.agentId) return
    pendingMemberFocus.current = null
    memberTabRefs.current.get(memberId)?.focus()
  }, [selectedMember?.agentId, showWholeTeam])

  const apply = async (next: TargetTeamEquipmentParameterSelection) => {
    if (!onConfirmEquipmentParameters || pending || readOnly) return
    setPending(true)
    setError('')
    try {
      await onConfirmEquipmentParameters({ ...next, koledaFixedEventConditions32: undefined })
    } catch {
      setError('方案参数未应用，请重试。')
    } finally {
      setPending(false)
    }
  }

  if (!selectedMember) return null
  const engineRecommendation = targetTeamFit?.equipmentRecommendations.wEngines.find(
    (item) => item.agentId === selectedMember.agentId,
  )
  const engineOptions = engineRecommendation ? wEngineOptions(engineRecommendation) : []
  const selectedEngine = selection?.wEngines.find((item) => item.agentId === selectedMember.agentId)
  const memberDiscCount = selectedMember.discFacts.length
  return (
    <section className={`team-execution is-${view.status}`} aria-label="队伍配装">
      <section className="team-execution__loadout">
        <div className="team-execution__top-rail">
          <div className="team-execution__formation">
            <div className="team-execution__member-strip" role="tablist" aria-label="选择队伍成员">
              {orderedMembers.map((member, index) => {
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
                      aria-selected={selectedMember.agentId === member.agentId}
                      aria-controls={`${headingId}-panel`}
                      tabIndex={selectedMember.agentId === member.agentId ? 0 : -1}
                      className={selectedMember.agentId === member.agentId ? 'is-selected' : ''}
                      onKeyDown={(event) => {
                        const next =
                          event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? orderedMembers.length - 1
                              : event.key === 'ArrowRight'
                                ? (index + 1) % orderedMembers.length
                                : event.key === 'ArrowLeft'
                                  ? (index + orderedMembers.length - 1) % orderedMembers.length
                                  : null
                        if (next === null) return
                        event.preventDefault()
                        pendingMemberFocus.current = orderedMembers[next].agentId
                        memberTabRefs.current.get(orderedMembers[next].agentId)?.focus()
                        handleDeselect()
                        setSelectedMemberId(orderedMembers[next].agentId)
                        setShowWholeTeam(false)
                      }}
                      onClick={() => {
                        setSelectedMemberId(member.agentId)
                        setShowWholeTeam(false)
                        handleDeselect()
                      }}
                    >
                      <span className="team-execution__member-copy">
                        <strong>{member.agentName}</strong>
                        <span>
                          {index + 1}号位 · {member.statusLabel}
                        </span>
                        <TeamLoadoutMindscapeSuggestion display={mindscape} />
                      </span>
                    </button>
                    {substitutesForMember(member, alternate).length ? (
                      <div
                        className="team-execution__replacement"
                        aria-label={`${member.agentName}的替补`}
                      >
                        <span>替补</span>
                        <div className="team-execution__replacement-list">
                          {substitutesForMember(member, alternate).map((replacement) => (
                            <button
                              key={`${replacement.targetAgentId}:${replacement.agentId}`}
                              type="button"
                              disabled={!replacement.onSelect}
                              aria-label={`用${replacement.agentName}替换${member.agentName}`}
                              onClick={replacement.onSelect}
                            >
                              {replacement.agentName}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="team-execution__deployment" aria-label="队伍站位">
              <span>当前站位 · {orderedNames.join(' → ')}</span>
              {onDeploymentOrderChange && !readOnly && currentOrder.length === 3 ? (
                <div role="group" aria-label="调整站位">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      onDeploymentOrderChange([currentOrder[1], currentOrder[2], currentOrder[0]])
                    }
                  >
                    轮换首发
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      onDeploymentOrderChange([currentOrder[0], currentOrder[2], currentOrder[1]])
                    }
                  >
                    交换2、3号位
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="team-execution__bangboo" aria-label="邦布设置">
            {selection && bangbooOptions.length ? (
              <div className="team-execution__scheme-control team-execution__scheme-control--bangboo">
                <label>
                  <span>邦布</span>
                  <PlayerSelect
                    aria-label="方案邦布"
                    value={selection.bangbooId}
                    disabled={readOnly || pending || !onConfirmEquipmentParameters}
                    onChange={(value) => {
                      const option = bangbooOptions.find((item) => item.bangbooId === value)
                      void apply({
                        ...selection,
                        bangbooId: value,
                        bangbooStars: option?.defaultStars ?? selection.bangbooStars,
                      })
                    }}
                  >
                    {bangbooOptions.map((option) => (
                      <option key={option.bangbooId} value={option.bangbooId}>
                        {option.name}
                      </option>
                    ))}
                  </PlayerSelect>
                </label>
                <label>
                  <span>星级</span>
                  <PlayerSelect
                    aria-label="方案邦布星级"
                    value={selection.bangbooStars}
                    disabled={readOnly || pending || !onConfirmEquipmentParameters}
                    onChange={(value) => void apply({ ...selection, bangbooStars: Number(value) })}
                  >
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <option key={stars} value={stars}>
                        {stars} 星
                      </option>
                    ))}
                  </PlayerSelect>
                </label>
              </div>
            ) : (
              <p>
                邦布：
                {selectedBangboo?.name ??
                  (targetTeamFit?.targetExecution.bangbooId
                    ? playerFacingBangbooLabel(targetTeamFit.targetExecution.bangbooId)
                    : '未记录')}
              </p>
            )}
          </div>
        </div>
        <div
          className="team-execution__workspace"
          id={`${headingId}-panel`}
          role="tabpanel"
          aria-labelledby={`${headingId}-${selectedMember.agentId}`}
        >
          <div className="team-execution__main">
            <header className="team-execution__loadout-heading">
              <div>
                <h2>{showWholeTeam ? '全队配装' : `${selectedMember.agentName}的方案配装`}</h2>
                <p>
                  {completion.complete
                    ? `本次方案 ${actualDiscCount}/${expectedDiscCount} 张已匹配驱动盘`
                    : `已匹配 ${actualDiscCount}/${expectedDiscCount} 张驱动盘`}
                </p>
              </div>
              {!showWholeTeam ? (
                <div className="team-execution__header-engine">
                  {selection && engineRecommendation ? (
                    <div className="team-execution__scheme-control team-execution__scheme-control--wengine">
                      <label>
                        <span>音擎</span>
                        <PlayerSelect
                          aria-label={`${selectedMember.agentName} 方案音擎`}
                          value={selectedEngine?.engineId ?? ''}
                          disabled={readOnly || pending || !onConfirmEquipmentParameters}
                          onChange={(value) => {
                            const option = engineOptions.find((item) => item.engineId === value)
                            void apply({
                              ...selection,
                              wEngines: selection.wEngines.map((item) =>
                                item.agentId === selectedMember.agentId
                                  ? {
                                      ...item,
                                      engineId: value,
                                      level: option?.level,
                                      ascension: option?.ascension,
                                      refinement: option?.refinement ?? item.refinement,
                                    }
                                  : item,
                              ),
                            })
                          }}
                        >
                          {engineOptions.map((option) => (
                            <option key={option.engineId} value={option.engineId}>
                              {option.name}
                            </option>
                          ))}
                        </PlayerSelect>
                      </label>
                      <label>
                        <span>精炼</span>
                        <PlayerSelect
                          aria-label={`${selectedMember.agentName} 方案音擎精炼`}
                          value={selectedEngine?.refinement ?? 1}
                          disabled={readOnly || pending || !onConfirmEquipmentParameters}
                          onChange={(value) =>
                            void apply({
                              ...selection,
                              wEngines: selection.wEngines.map((item) =>
                                item.agentId === selectedMember.agentId
                                  ? { ...item, refinement: Number(value) }
                                  : item,
                              ),
                            })
                          }
                        >
                          {[1, 2, 3, 4, 5].map((rank) => (
                            <option key={rank} value={rank}>
                              P{rank}
                            </option>
                          ))}
                        </PlayerSelect>
                      </label>
                    </div>
                  ) : (
                    <p>音擎：{selectedMember.suggestedWEngineLabel}</p>
                  )}
                </div>
              ) : null}
              <div className="team-execution__view-toggle" role="group" aria-label="完整配装视图">
                <button
                  type="button"
                  aria-pressed={!showWholeTeam}
                  onClick={() => setShowWholeTeam(false)}
                >
                  当前角色
                </button>
                <button
                  type="button"
                  aria-pressed={showWholeTeam}
                  onClick={() => setShowWholeTeam(true)}
                >
                  全队驱动盘
                </button>
              </div>
            </header>
            {error ? (
              <p role="alert" className="team-execution__scheme-error">
                {error}
              </p>
            ) : null}
            {view.blockers.length ? (
              <p className="team-execution__scheme-note">
                <strong>配装提示</strong>
                <span>{view.blockers.join('；')}</span>
              </p>
            ) : null}
            {evidence && completion.complete ? (
              <div className="team-execution__evidence">{evidence}</div>
            ) : null}
            {showWholeTeam ? (
              <div className="team-execution__all-members" aria-label="全队驱动盘配装">
                {orderedMembers.map((member) => (
                  <article key={member.agentId}>
                    <header>
                      <h3>{member.agentName}</h3>
                      <span>{member.suggestedWEngineLabel}</span>
                    </header>
                    <ol aria-label={`${member.agentName}的六张驱动盘`}>
                      {member.discFacts.map((disc) => (
                        <TeamExecutionDiscCard
                          key={disc.id}
                          disc={disc}
                          condensed
                          selected={selectedDiscId === disc.id}
                          highlighted={isDiscHighlighted(disc, member.agentId)}
                          onSelect={() => handleDiscSelect(disc, member.agentId)}
                          onDeselect={handleDeselect}
                        />
                      ))}
                    </ol>
                    {member.missingDiscIds.length ? (
                      <p role="status">
                        有 {member.missingDiscIds.length} 张方案驱动盘当前不在仓库。
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <article
                className="team-execution__member-workspace"
                aria-label={`${selectedMember.agentName}配装`}
              >
                <ol
                  className="team-execution__disc-slots"
                  aria-label={`${selectedMember.agentName}的六张驱动盘`}
                >
                  {selectedMember.discFacts.map((disc) => (
                    <TeamExecutionDiscCard
                      key={disc.id}
                      disc={disc}
                      selected={selectedDiscId === disc.id}
                      highlighted={isDiscHighlighted(disc, selectedMember.agentId)}
                      onSelect={() => handleDiscSelect(disc, selectedMember.agentId)}
                      onDeselect={handleDeselect}
                    />
                  ))}
                </ol>
                {selectedMember.missingDiscIds.length ? (
                  <p role="status">
                    有 {selectedMember.missingDiscIds.length} 张方案驱动盘当前不在仓库。
                  </p>
                ) : null}
                {memberDiscCount === 0 && warehouse.discs.length === 0 ? (
                  <p>当前仓库没有驱动盘记录。</p>
                ) : null}
              </article>
            )}
          </div>
          <PublicTeamAttributeInspector
            accountId={warehouse.accountId ?? ''}
            agentId={selectedMember.agentId}
            agentName={selectedMember.agentName}
            panel={attributePanelsByAgent?.[selectedMember.agentId] ?? null}
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
