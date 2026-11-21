import { TeamExecutionGraduationReference } from './TeamExecutionGraduationReference'
import { TeamExecutionAttributeTable } from './TeamExecutionAttributeTable'
import type { ReactNode } from 'react'
import { visibleTeamAttributeRows } from './teamExecutionAttributeRows'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { VisualEntityImage } from '../components/VisualEntityImage'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  incompleteTeamLoadoutMessage,
  isIncompleteTeamDiscReason,
  playerFacingExecutionBlocker,
} from '@soda/team-execution-blocker-presentation'
import type { TeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { playerFacingTeamSchemeNote } from './teamExecutionPlayerText'

export { TeamExecutionDiscCard } from './teamExecutionDiscCard'
export { SavedPlanExecutionRefreshStatus } from './SavedPlanExecutionRefreshStatus'

export type TeamExecutionSelectedMember = ReturnType<
  typeof import('./teamExecutionPresentation').presentTeamExecution
>['members'][number]

export function MissingTeamDiscsNotice({ count }: { count: number }) {
  return count ? (
    <p className="team-execution__disc-missing" role="status">
      有 {count} 张方案驱动盘当前不在仓库。
    </p>
  ) : null
}

export function TeamMemberVisual({
  agentId,
  name,
  className,
}: {
  agentId: string
  name: string
  className?: string
}) {
  return (
    <VisualEntityImage
      className={className}
      entityId={agentId}
      entityType="agent"
      name={name}
      slotId="agent.square-avatar"
      consumer="box.team-workspace"
    />
  )
}

export function WEngineVisual({
  engineId,
  name,
  className,
}: {
  engineId: string | null
  name: string
  className?: string
}) {
  if (!engineId) {
    return (
      <span
        aria-hidden="true"
        className={`team-execution__equipment-fallback ${className ?? ''}`}
      />
    )
  }
  return (
    <VisualEntityImage
      className={className}
      entityId={engineId}
      entityType="wengine"
      name={name}
      slotId="wengine.equipment-icon"
      consumer="box.team-workspace"
    />
  )
}

export function TeamExecutionLoadoutSummary({
  view,
  selectedMember,
  schemeWEngineControl,
  schemeDegradeReasons = [],
  hideEngine = false,
}: {
  view: ReturnType<typeof import('./teamExecutionPresentation').presentTeamExecution>
  selectedMember: TeamExecutionSelectedMember
  warehouse: CoreWarehouse
  onRosterChange: (roster: CoreWarehouse['roster']) => void
  readOnly?: boolean
  schemeWEngineControl?: ReactNode
  hideEngine?: boolean
  schemeDegradeReasons?: readonly string[]
  discRecommendation?: CandidateWarehouseConstraint | null
}) {
  const hasCompleteTeamLoadout = view.members.every(
    (member) => member.discFacts.length === 6 && member.missingDiscIds.length === 0,
  )
  const blockers = view.blockers.filter(
    (blocker) => hasCompleteTeamLoadout || blocker !== incompleteTeamLoadoutMessage,
  )
  const degradeReasons = [
    ...new Set(
      schemeDegradeReasons
        .filter((reason) => hasCompleteTeamLoadout || !isIncompleteTeamDiscReason(reason))
        .map((reason) => playerFacingTeamSchemeNote(playerFacingExecutionBlocker(reason))),
    ),
  ].filter(Boolean)
  const notes = [
    ...new Set([
      ...blockers.map((reason) => playerFacingTeamSchemeNote(playerFacingExecutionBlocker(reason))),
      ...degradeReasons,
    ]),
  ].filter(Boolean)
  if (hideEngine && !notes.length) return null
  return (
    <section
      className="team-execution__loadout-summary"
      aria-label={`${selectedMember.agentName}配装摘要`}
    >
      {!hideEngine ? (
        <>
          <div className="team-execution__summary-engine team-execution__engine-row">
            <div className="team-execution__engine-choice">
              {schemeWEngineControl ?? (
                <>
                  <WEngineVisual
                    className="team-execution__summary-engine-visual"
                    engineId={selectedMember.suggestedWEngineId}
                    name={selectedMember.suggestedWEngineLabel}
                  />
                  <span>音擎：{selectedMember.suggestedWEngineLabel}</span>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
      <div className="team-execution__summary-followup">
        {notes.length ? (
          <p className="team-execution__scheme-note">
            <span>{notes.join('；')}</span>
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function TeamExecutionAttributeInspector({
  selectedMember,
  attributePanel,
  accountId,
  matchedAttributeKeys,
  selectedAttributeKey,
  onSelectAttribute,
  onDeselectAttribute,
}: {
  selectedMember: TeamExecutionSelectedMember
  attributePanel: TeamExecutionAttributePanel | null
  accountId?: string
  matchedAttributeKeys?: ReadonlySet<string>
  selectedAttributeKey?: string | null
  onSelectAttribute?: (keyOrLabel: string) => void
  onDeselectAttribute?: () => void
}) {
  const hasCompleteSuggestedLoadout =
    selectedMember.discFacts.length === 6 && selectedMember.missingDiscIds.length === 0
  const availableRows =
    hasCompleteSuggestedLoadout || !attributePanel
      ? (attributePanel?.rows ?? [])
      : attributePanel.rows.filter(
          (row) =>
            row.outOfCombatStatus !== 'missing' ||
            row.currentStatus !== 'missing' ||
            row.targetStatus !== 'missing' ||
            row.contribution !== '无可证副词条',
        )
  const rows = visibleTeamAttributeRows(availableRows)
  const currentColumn = attributePanel?.source.current.status === 'exact' ? '方案后' : '六盘贡献'
  const showAccountColumn = rows.some((row) => row.outOfCombatStatus !== 'missing')
  const showTargetColumn = rows.some((row) => row.targetStatus !== 'missing')
  const outOfCombatColumn =
    attributePanel?.source.outOfCombat.status === 'exact'
      ? '局外面板（账户）'
      : attributePanel?.source.outOfCombat.status === 'baseline'
        ? '局外面板（基线）'
        : attributePanel?.source.outOfCombat.wEngineId
          ? '局外面板'
          : '局外面板（缺音擎）'
  return (
    <aside className="team-execution__inspector" aria-label="角色详细属性">
      <header className="team-execution__attribute-heading">
        <TeamMemberVisual
          agentId={selectedMember.agentId}
          className="team-execution__panel-avatar"
          name={selectedMember.agentName}
        />
        <div>
          <p className="team-execution__panel-kicker">所选成员</p>
          <h3>角色详细属性</h3>
        </div>
        <div className="team-execution__attribute-actions">
          {attributePanel ? (
            <TeamExecutionGraduationReference
              panel={attributePanel}
              identity={`${accountId ?? ''}:${selectedMember.agentId}`}
            />
          ) : null}
        </div>
      </header>
      {attributePanel && rows.length > 0 ? (
        <div className="team-execution__attribute-notes" role="status">
          {hasCompleteSuggestedLoadout &&
          attributePanel.source.outOfCombat.status === 'missing' &&
          !(
            attributePanel.source.outOfCombat.discIds.length < 6 &&
            attributePanel.source.current.status === 'exact'
          ) ? (
            <p>
              {attributePanel.source.outOfCombat.discIds.length < 6
                ? `当前配装未记录完整六盘（${attributePanel.source.outOfCombat.discIds.length}/6），暂不能比较。`
                : !attributePanel.source.outOfCombat.wEngineId
                  ? '当前音擎未记录，暂不能比较。'
                  : '当前面板暂时无法计算。'}
            </p>
          ) : null}
          {!showTargetColumn ? <p>暂无可量化的毕业推荐。</p> : null}
          {hasCompleteSuggestedLoadout && attributePanel.source.current.status === 'missing' ? (
            <p>{attributePanel.copy.current}</p>
          ) : null}
        </div>
      ) : null}
      {attributePanel ? (
        <>
          {attributePanel.attackSupport ? (
            <p className="team-execution__attribute-notes">
              入场攻击支援：
              {attributePanel.attackSupport.suggested.status === 'supported'
                ? `全队 +${Math.round(attributePanel.attackSupport.suggested.value!)} 攻击力${attributePanel.attackSupport.delta !== null ? `（较当前${attributePanel.attackSupport.delta >= 0 ? '+' : ''}${Math.round(attributePanel.attackSupport.delta)}）` : ''}（不计入初始面板）`
                : attributePanel.attackSupport.suggested.reason}
            </p>
          ) : null}
          <TeamExecutionAttributeTable
            rows={rows}
            label={`${selectedMember.agentName}角色详细属性`}
            accountLabel={outOfCombatColumn}
            proposedLabel={currentColumn}
            hasFinalPanel={attributePanel.source.current.status === 'exact'}
            showAccount={showAccountColumn}
            matchedKeys={matchedAttributeKeys}
            selectedKey={selectedAttributeKey}
            onSelectRow={onSelectAttribute}
            onDeselect={onDeselectAttribute}
          />
        </>
      ) : !attributePanel ? (
        <p className="team-execution__attribute-unavailable">当前展示没有可复算的成员方案。</p>
      ) : null}
    </aside>
  )
}
