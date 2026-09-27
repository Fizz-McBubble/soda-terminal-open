import type { ReactNode } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { VisualEntityImage } from '../components/VisualEntityImage'
import { ExplanationPopover } from '../components/ExplanationPopover'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  incompleteTeamLoadoutMessage,
  isIncompleteTeamDiscReason,
  playerFacingExecutionBlocker,
  type TeamExecutionDiscPresentation,
} from './teamExecutionPresentation'
import type { TeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { DevelopmentDiscCard } from '../features/agentDevelopmentGolden/DevelopmentDiscCard'
import '../features/agentDevelopmentGolden/development-disc-card.css'

export type TeamExecutionSelectedMember = ReturnType<
  typeof import('./teamExecutionPresentation').presentTeamExecution
>['members'][number]

export function MissingTeamDiscsNotice({ count }: { count: number }) {
  return count ? (
    <p className="team-execution__disc-missing" role="status">
      有 {count} 张方案驱动盘当前不在仓库；原记录已保留，未自动缩减或替换。
    </p>
  ) : null
}

export function SavedPlanExecutionRefreshStatus({
  state,
  onRetry,
}: {
  state: 'loading' | 'mismatch' | 'error'
  onRetry?: () => void
}) {
  return (
    <section className="panel status-card" role="status" aria-label="已保存盘面评分">
      <p>
        {state === 'loading'
          ? '正在更新配装评分…'
          : state === 'mismatch'
            ? '已保留原配装，重新匹配后可查看新评分。'
            : '评分暂时无法加载，已保存的配装仍可查看。'}
      </p>
      {state !== 'loading' && onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          重试读取当前评分
        </button>
      ) : null}
    </section>
  )
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

function discStateLabel(state: TeamExecutionDiscPresentation['state']) {
  return state === 'keep'
    ? '保持'
    : state === 'borrow'
      ? '借用'
      : state === 'recorded'
        ? '方案用盘'
        : '替换当前装备'
}

export function TeamExecutionDiscCard({
  disc,
  condensed = false,
}: {
  disc: TeamExecutionDiscPresentation
  condensed?: boolean
}) {
  if (!condensed) {
    return (
      <li
        aria-label={`${disc.slot}号位 · ${discStateLabel(disc.state)}`}
        className={`team-execution__disc-card team-execution__shared-disc is-${disc.state}`}
      >
        <DevelopmentDiscCard disc={disc} />
        {disc.state === 'borrow' || disc.state === 'change' ? (
          <span className="team-execution__shared-disc-action">{discStateLabel(disc.state)}</span>
        ) : null}
      </li>
    )
  }
  return (
    <li
      aria-label={`${disc.slot}号位 · ${discStateLabel(disc.state)}`}
      className={`team-execution__disc-card is-${disc.state}`}
    >
      <header>
        <span>
          {disc.slot}号位 · +{disc.level}
        </span>
        {(disc.grade !== '未评定' || disc.score !== undefined) && (
          <b>
            {disc.score === undefined
              ? disc.grade
              : disc.grade === '未评定'
                ? `评分 ${disc.score}`
                : `${disc.grade} · ${disc.score}`}
          </b>
        )}
      </header>
      <div className="team-execution__disc-main">
        {disc.visual ? (
          <VisualEntityImage
            className="team-execution__disc-visual"
            entityId={disc.visual.entityId}
            entityType={disc.visual.entityType}
            name={disc.visual.name}
            slotId="drive-disc-set.icon"
            consumer="box.team-workspace"
          />
        ) : null}
        <small>{disc.set}</small>
        <strong>{disc.main}</strong>
        <b>{disc.mainValue}</b>
      </div>
      {condensed ? (
        <p className="team-execution__disc-substats-summary">
          {disc.subs[0]?.name} {disc.subs[0]?.value} · 另 {Math.max(0, disc.subs.length - 1)} 条
        </p>
      ) : (
        <ul className="team-execution__disc-substats" aria-label="副词条">
          {disc.subs.map((sub) => (
            <li
              className={sub.effective ? 'is-effective' : undefined}
              key={`${sub.name}-${sub.value}`}
            >
              <span>{sub.name}</span>
              <em>{sub.hits > 0 ? `+${sub.hits}` : ''}</em>
              <b>{sub.value}</b>
            </li>
          ))}
        </ul>
      )}
      {disc.state === 'borrow' || disc.state === 'change' ? (
        <footer>
          {/\d/.test(disc.effective) ? <span>有效副属性 {disc.effective}</span> : null}
          <em>{discStateLabel(disc.state)}</em>
        </footer>
      ) : null}
    </li>
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
        .map(playerFacingExecutionBlocker),
    ),
  ]
  if (hideEngine && !blockers.length && !degradeReasons.length) return null
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
        {blockers.length ? (
          <p className="team-execution__loadout-impact">注意：{blockers.join('；')}</p>
        ) : null}
      </div>
      {degradeReasons.length ? (
        <p className="team-execution__scheme-degrade">方案注意：{degradeReasons.join('；')}</p>
      ) : null}
    </section>
  )
}

export function TeamExecutionAttributeInspector({
  selectedMember,
  attributePanel,
}: {
  selectedMember: TeamExecutionSelectedMember
  attributePanel: TeamExecutionAttributePanel | null
}) {
  const hasCompleteSuggestedLoadout =
    selectedMember.discFacts.length === 6 && selectedMember.missingDiscIds.length === 0
  const rows =
    hasCompleteSuggestedLoadout || !attributePanel
      ? (attributePanel?.rows ?? [])
      : attributePanel.rows.filter(
          (row) =>
            row.outOfCombatStatus !== 'missing' ||
            row.currentStatus !== 'missing' ||
            row.targetStatus !== 'missing' ||
            row.contribution !== '无可证副词条',
        )
  const currentColumn = attributePanel?.source.current.status === 'exact' ? '方案后' : '六盘贡献'
  const showAccountColumn = rows.some((row) => row.outOfCombatStatus !== 'missing')
  const showTargetColumn = rows.some((row) => row.targetStatus !== 'missing')
  const outOfCombatColumn =
    attributePanel?.source.outOfCombat.status === 'exact'
      ? '局外面板（账户）'
      : attributePanel?.source.outOfCombat.status === 'baseline'
        ? '局外面板（基线）'
        : attributePanel?.source.outOfCombat.wEngineId
          ? '局外面板（缺资料）'
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
        {attributePanel?.source.target.conditions?.length ? (
          <ExplanationPopover label="毕业参考" title="毕业参考条件">
            <p>{attributePanel.copy.target}</p>
          </ExplanationPopover>
        ) : null}
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
                  ? '当前音擎资料未补齐，暂不能比较。'
                  : `当前面板未计算：${attributePanel.source.outOfCombat.reason ?? '资料尚未补齐。'}`}
            </p>
          ) : null}
          {!showTargetColumn ? <p>暂无可量化的毕业参考。</p> : null}
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
          <div
            className={`team-execution__attribute-table${showAccountColumn ? '' : ' without-account'}`}
            role="table"
            aria-label={`${selectedMember.agentName}角色详细属性`}
          >
            <div className="team-execution__attribute-row is-heading" role="row">
              <span role="columnheader">属性</span>
              {showAccountColumn ? <span role="columnheader">{outOfCombatColumn}</span> : null}
              <span role="columnheader">{currentColumn}</span>
              <span role="columnheader">毕业参考</span>
            </div>
            {rows.map((row) => (
              <div
                className={`team-execution__attribute-row${row.isPriority ? ' is-priority' : ''}${row.isBelowTarget ? ' is-below-target' : ''}`}
                key={row.label}
                role="row"
              >
                <strong role="cell">{row.label}</strong>
                {showAccountColumn ? (
                  <span role="cell">
                    {row.outOfCombatStatus === 'missing' ? '—' : row.outOfCombat}
                  </span>
                ) : null}
                <span role="cell" className="team-execution__attribute-proposed">
                  {attributePanel.source.current.status === 'exact'
                    ? row.current
                    : row.contribution === '无可证副词条'
                      ? '—'
                      : row.contribution}
                </span>
                <span role="cell">{row.targetStatus === 'missing' ? '—' : row.target}</span>
              </div>
            ))}
          </div>
        </>
      ) : !attributePanel ? (
        <p className="team-execution__attribute-unavailable">当前展示没有可复算的成员方案。</p>
      ) : null}
    </aside>
  )
}
