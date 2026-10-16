import { useId } from 'react'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import type { GoldenWorkbenchData } from './types'
import { isCharacterPanelDetailRelevant } from '../../application/characterPanelFields'

export function WorkbenchPanelSnapshot({ subject }: { subject: GoldenWorkbenchData }) {
  const scope = subject.panelScopeKey ?? subject.agentId
  const panelId = useId()
  const refreshState = subject.currentPanel.refreshState
  const hasDetails = subject.panelFacts.some((fact) => fact.detail)
  const detailFacts = subject.panelFacts.filter((fact) =>
    isCharacterPanelDetailRelevant(
      { key: fact.key ?? '', detail: fact.detail, group: fact.group },
      fact.currentValue,
    ),
  )
  return (
    <section
      className="panel-snapshot current-overview__panel"
      aria-labelledby="panel-snapshot-title"
      tabIndex={0}
      aria-busy={refreshState === 'updating'}
    >
      <header>
        <div>
          <h2 id="panel-snapshot-title">当前面板</h2>
        </div>
        {hasDetails && subject.currentPanel.availability === 'available' ? (
          <span
            className={refreshState ? 'panel-snapshot__placeholder' : undefined}
            aria-hidden={refreshState ? true : undefined}
            inert={Boolean(refreshState)}
          >
            <ExplanationPopover
              key={`${scope}:${refreshState ?? 'ready'}`}
              className="character-panel-more"
              label="查看完整面板"
              title="角色完整面板"
              closeLabel="关闭完整面板"
            >
              <dl className="character-panel-more__facts">
                {detailFacts.map((fact) => (
                  <div className={fact.focus ? 'focus' : undefined} key={fact.key ?? fact.name}>
                    <dt>{fact.name}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </ExplanationPopover>
          </span>
        ) : null}
      </header>
      {subject.currentPanel.availability === 'available' ? (
        <dl
          className={`stat-grid${refreshState ? ' panel-snapshot__placeholder' : ''}`}
          id={panelId}
          aria-hidden={refreshState ? true : undefined}
        >
          {subject.panelFacts
            .filter((fact) => !fact.detail)
            .map((fact) => (
              <div className={fact.focus ? 'focus' : undefined} key={fact.key ?? fact.name}>
                <dt>{fact.name}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p
          className={`panel-snapshot__unavailable${refreshState ? ' panel-snapshot__placeholder' : ''}`}
          aria-hidden={refreshState ? true : undefined}
        >
          {refreshState
            ? subject.currentPanel.refreshPlaceholderSummary
            : subject.currentPanel.summary}
        </p>
      )}
      {refreshState ? (
        <span className="panel-snapshot__refresh-status" role="status">
          {subject.currentPanel.summary}
        </span>
      ) : null}
      <WorkbenchGraduationTargets subject={subject} />
    </section>
  )
}

function WorkbenchGraduationTargets({ subject }: { subject: GoldenWorkbenchData }) {
  const isOptionalTarget = (fact: GoldenWorkbenchData['graduation']['panel'][number]) =>
    /（可选(?:\s*·|）)/.test(fact.value)
  const panelTargets = subject.graduation.panel.filter((fact) => !isOptionalTarget(fact))
  const optionalTargets = subject.graduation.panel.filter(isOptionalTarget)
  const hasPanelTargets = subject.graduation.panel.length > 0
  return (
    <section className="panel-graduation-targets" aria-labelledby="panel-target-title">
      <small id="panel-target-title">{hasPanelTargets ? '毕业推荐' : '副词条方向'}</small>
      <div className="panel-graduation-targets__items">
        {!hasPanelTargets && subject.graduation.panelDirection ? (
          <span className="panel-graduation-targets__direction">
            {subject.graduation.panelDirection}
          </span>
        ) : null}
        {panelTargets.map((fact) => (
          <span className="panel-graduation-targets__item" key={fact.name}>
            <small>{fact.name}</small>
            <b>{fact.value}</b>
          </span>
        ))}
        {optionalTargets.length || subject.graduation.panelConditions?.length ? (
          <ExplanationPopover
            key={subject.agentId}
            label={optionalTargets.length ? '更多' : '适用条件'}
            title={optionalTargets.length ? '更多毕业推荐' : '毕业推荐适用条件'}
          >
            {optionalTargets.length ? (
              <dl className="panel-graduation-targets__optional">
                {optionalTargets.map((fact) => (
                  <div key={fact.name}>
                    <dt>{fact.name}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {subject.graduation.panelConditions?.length ? (
              <ul>
                {subject.graduation.panelConditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            ) : null}
          </ExplanationPopover>
        ) : null}
      </div>
    </section>
  )
}
