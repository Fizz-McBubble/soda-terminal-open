import type { GoldenWorkbenchData } from './types'
import type { ReactNode } from 'react'
import {
  workbenchPanelPresentation,
  workbenchTargetPresentation,
} from './workbenchPanelPresentation'
import { DecisionConditions } from '../../components/DecisionConditions'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import './WorkbenchPanelSnapshot.css'
import { formatDevelopmentEntityText } from '../../application/publicRosterNames'

export function WorkbenchPanelSnapshot({
  subject,
  comparisonConditions,
}: {
  subject: GoldenWorkbenchData
  comparisonConditions?: ReactNode
}) {
  const refreshState = subject.currentPanel.refreshState
  const facts = workbenchPanelPresentation(subject)
  const available = subject.currentPanel.availability === 'available'
  const contextKey = JSON.stringify([
    subject.panelScopeKey ?? subject.agentId,
    subject.discSource,
    subject.mode,
    available,
    refreshState,
    facts.full.map((fact) => [fact.key, fact.value]),
    subject.graduation.panel,
    subject.comparisonTarget,
  ])
  const usesInheritedConditions = Boolean(
    subject.comparisonTarget &&
    (!subject.comparisonTarget.wEngine ||
      (subject.supportsPotential && subject.comparisonTarget.potential === null)),
  )
  const renderFacts = (items: typeof subject.panelFacts) =>
    items.map((fact) => (
      <div className={fact.focus ? 'focus' : undefined} key={fact.key ?? fact.name}>
        <dt>{fact.name}</dt>
        <dd>{fact.value}</dd>
      </div>
    ))
  return (
    <section
      className="panel-snapshot panel-snapshot--menu current-overview__panel"
      aria-labelledby="panel-snapshot-title"
      tabIndex={0}
      aria-busy={refreshState === 'updating'}
    >
      <header className="panel-snapshot__heading">
        <div>
          <h2 id="panel-snapshot-title">
            {subject.mode === 'saved' || subject.discSource === '当前方案'
              ? '方案面板'
              : subject.discSource === '仓库候选'
                ? '配装预览面板'
                : '当前面板'}
          </h2>
        </div>
        <ExplanationPopover
          key={contextKey}
          className="panel-snapshot__complete"
          label="完整属性"
          title="完整属性"
          closeLabel="关闭完整属性"
          disabled={!available}
        >
          <dl className="panel-snapshot__full-grid">{renderFacts(facts.full)}</dl>
        </ExplanationPopover>
      </header>
      <div className="panel-snapshot__body">
        <dl className="stat-grid panel-snapshot__main-grid">{renderFacts(facts.main)}</dl>
        <div className="panel-snapshot__status-slot">
          {refreshState ? (
            <span
              className="panel-snapshot__refresh-status"
              role={refreshState === 'failed' ? 'alert' : 'status'}
            >
              {refreshState === 'failed'
                ? available
                  ? '当前面板未更新，已保留上次结果，可重试。'
                  : '当前面板暂未更新，可重试。'
                : subject.currentPanel.summary}
            </span>
          ) : !available ? (
            <span className="panel-snapshot__unavailable" title={subject.currentPanel.summary}>
              {subject.currentPanel.summary ===
              '关联完整6张驱动盘后可查看面板；上方等级、技能和音擎仍为当前记录。'
                ? '关联完整6张驱动盘后可查看面板。'
                : subject.currentPanel.summary}
            </span>
          ) : usesInheritedConditions &&
            (subject.mode === 'saved' || subject.discSource === '当前方案') ? (
            <small className="panel-snapshot__context">未记录条件按当前状态预览</small>
          ) : null}
        </div>
      </div>
      <WorkbenchGraduationTargets
        subject={subject}
        contextKey={contextKey}
        comparisonConditions={comparisonConditions}
      />
    </section>
  )
}

function WorkbenchGraduationTargets({
  subject,
  contextKey,
  comparisonConditions,
}: {
  subject: GoldenWorkbenchData
  contextKey: string
  comparisonConditions?: ReactNode
}) {
  const { main, reference, optionalOnly } = workbenchTargetPresentation(subject)
  const hasPanelTargets = main.length > 0
  const conditions = subject.graduation.panelConditions ?? []
  const configurationNotes = conditions.filter((condition) => condition.startsWith('参考配置：'))
  const actionConditions = conditions.filter((condition) => !condition.startsWith('参考配置：'))
  const displayValue = (fact: (typeof main)[number]) =>
    fact.semantic?.requirement === 'optional' ? fact.value.replace(/（可选）$/, '') : fact.value
  return (
    <section className="panel-graduation-targets" aria-labelledby="panel-target-title">
      <header className="panel-graduation-targets__heading">
        <div className="panel-graduation-targets__title">
          <h3 id="panel-target-title">培养目标</h3>
          <small className="panel-graduation-targets__kind">
            {optionalOnly
              ? '可选参考'
              : hasPanelTargets
                ? '配装参考'
                : reference.length
                  ? '条件参考'
                  : '副词条方向'}
          </small>
        </div>
        {conditions.length ||
        reference.length ||
        subject.comparisonTarget ||
        comparisonConditions ? (
          <ExplanationPopover
            key={contextKey}
            className="panel-graduation-targets__conditions"
            label="适用条件"
            title="培养目标适用条件"
          >
            {subject.comparisonTarget ? (
              <section
                className="panel-graduation-targets__comparison-context"
                aria-label="方案培养条件"
              >
                <h4>
                  {subject.comparisonTarget.source === 'candidate'
                    ? '本次方案条件'
                    : '已保存方案条件'}
                </h4>
                <p>
                  目标音擎：
                  {subject.comparisonTarget.wEngine
                    ? `${formatDevelopmentEntityText(subject.comparisonTarget.wEngine.name)} · 等级 ${subject.comparisonTarget.wEngine.level} · 突破${subject.comparisonTarget.wEngine.ascension == null ? '未记录' : ` ${subject.comparisonTarget.wEngine.ascension}`} · 精炼 ${subject.comparisonTarget.wEngine.refinement}`
                    : '未记录'}
                </p>
                {subject.supportsPotential || subject.comparisonTarget.potential !== null ? (
                  <p>目标潜能：{subject.comparisonTarget.potential ?? '未记录'}</p>
                ) : null}
              </section>
            ) : null}
            {configurationNotes.map((note) => (
              <p className="panel-graduation-targets__reference-config" key={note}>
                {note}
              </p>
            ))}
            {reference.length ? (
              <dl className="panel-graduation-targets__references">
                {reference.map((fact) => (
                  <div key={fact.key ?? fact.name}>
                    <dt>
                      {fact.name}
                      {fact.semantic?.observation === 'in_combat' ? (
                        <small>战斗内</small>
                      ) : fact.semantic?.requirement === 'optional' ? (
                        <small>可选</small>
                      ) : fact.semantic?.observation === 'reference' ? (
                        <small>配装参考</small>
                      ) : null}
                    </dt>
                    <dd>{displayValue(fact)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <DecisionConditions
              className="panel-graduation-targets__condition-list"
              conditions={actionConditions}
              label="适用条件"
            />
            {comparisonConditions}
          </ExplanationPopover>
        ) : null}
      </header>
      <div className="panel-graduation-targets__items">
        {!hasPanelTargets ? (
          <span className="panel-graduation-targets__direction">
            {reference.length ? '参考目标见适用条件' : subject.graduation.panelDirection}
          </span>
        ) : null}
        {main.map((fact) => (
          <span className="panel-graduation-targets__item" key={fact.name}>
            <small>{fact.name}</small>
            <b>{displayValue(fact)}</b>
          </span>
        ))}
      </div>
    </section>
  )
}
