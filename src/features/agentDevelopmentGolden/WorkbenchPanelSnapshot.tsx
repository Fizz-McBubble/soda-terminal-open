import { useId } from 'react'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import type { GoldenWorkbenchData } from './types'

export function WorkbenchPanelSnapshot({ subject }: { subject: GoldenWorkbenchData }) {
  const scope = subject.panelScopeKey ?? subject.agentId
  const panelId = useId()
  const hasDetails = subject.panelFacts.some((fact) => fact.detail)
  return (
    <section
      className="panel-snapshot current-overview__panel"
      aria-labelledby="panel-snapshot-title"
      tabIndex={0}
    >
      <header>
        <div>
          <h2 id="panel-snapshot-title">当前面板</h2>
        </div>
        {hasDetails && subject.currentPanel.availability === 'available' ? (
          <ExplanationPopover
            key={scope}
            className="character-panel-more"
            label="查看完整面板"
            title="角色完整面板"
            closeLabel="关闭完整面板"
          >
            <dl className="character-panel-more__facts">
              {subject.panelFacts.map((fact) => (
                <div className={fact.focus ? 'focus' : undefined} key={fact.key ?? fact.name}>
                  <dt>{fact.name}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </ExplanationPopover>
        ) : null}
      </header>
      {subject.currentPanel.availability === 'available' ? (
        <dl className="stat-grid" id={panelId}>
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
        <p className="panel-snapshot__unavailable">{subject.currentPanel.summary}</p>
      )}
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
      <small id="panel-target-title">{hasPanelTargets ? '毕业面板推荐' : '副词条方向'}</small>
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
            title={optionalTargets.length ? '毕业面板更多参考' : '毕业面板适用条件'}
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
