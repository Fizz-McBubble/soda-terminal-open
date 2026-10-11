import { ExplanationPopover } from '../../components/ExplanationPopover'
import type { GoldenWorkbenchData } from './types'

export function WorkbenchPanelSnapshot({ subject }: { subject: GoldenWorkbenchData }) {
  // The displayed qualifier comes from the sourced target requirement; only its
  // presentation order changes, preserving the source order within each group.
  const isOptionalTarget = (fact: GoldenWorkbenchData['graduation']['panel'][number]) =>
    /（可选(?:\s*·|）)/.test(fact.value)
  const panelTargets = [
    ...subject.graduation.panel.filter((fact) => !isOptionalTarget(fact)),
    ...subject.graduation.panel.filter(isOptionalTarget),
  ]
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
      </header>
      {subject.currentPanel.availability === 'available' ? (
        <dl className="stat-grid">
          {subject.panelFacts.map((fact) => (
            <div className={fact.focus ? 'focus' : undefined} key={fact.name}>
              <dt>{fact.name}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="panel-snapshot__unavailable">{subject.currentPanel.summary}</p>
      )}
      <section className="panel-graduation-targets" aria-labelledby="panel-target-title">
        <small id="panel-target-title">毕业面板推荐</small>
        <div className="panel-graduation-targets__items">
          {panelTargets.map((fact) => (
            <span className="panel-graduation-targets__item" key={fact.name}>
              <small>{fact.name}</small>
              <b>{fact.value}</b>
            </span>
          ))}
          {subject.graduation.panelConditions?.length ? (
            <ExplanationPopover label="适用条件" title="毕业面板适用条件">
              <ul>
                {subject.graduation.panelConditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </ExplanationPopover>
          ) : null}
        </div>
      </section>
    </section>
  )
}
