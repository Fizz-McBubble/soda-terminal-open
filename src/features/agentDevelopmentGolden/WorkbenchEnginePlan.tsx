import { VisualEntityImage } from '../../components/VisualEntityImage'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { workbenchEnginePresentation } from './workbenchEnginePresentation'
import type { GoldenWorkbenchData } from './types'
import './WorkbenchEnginePlan.css'

export function WorkbenchEnginePlan({
  subject,
}: {
  subject: Pick<GoldenWorkbenchData, 'agentId' | 'engine' | 'graduation'>
}) {
  const { current, visibleRecommendations, advice } = workbenchEnginePresentation(subject)
  const explanationKey = `${subject.agentId}:${current.id}:${current.level}:${current.refinement}`
  const icon = (visual: { entityId: string; name: string } | undefined) =>
    visual ? (
      <VisualEntityImage
        className="recommendation-item-icon"
        entityType="wengine"
        entityId={visual.entityId}
        name={visual.name}
        slotId="wengine.equipment-icon"
        consumer="agent-development.workbench"
      />
    ) : (
      <span className="engine__fallback" aria-hidden="true" />
    )
  return (
    <section className="current-engine-plan" aria-label="当前音擎与推荐">
      <header className="current-engine-plan__heading">
        <small>当前音擎</small>
        <div>
          <small>推荐音擎</small>
          {advice.length ? (
            <ExplanationPopover
              key={explanationKey}
              className="current-engine-plan__notes"
              label="选择说明"
              title="音擎选择说明"
            >
              {advice.map((group) => (
                <section className="engine-choice-note" key={group.engineId}>
                  <strong>{group.name}</strong>
                  {group.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </section>
              ))}
            </ExplanationPopover>
          ) : null}
        </div>
      </header>
      <div className="current-engine-plan__strip">
        <div className="current-engine-plan__actual">
          {icon(current.visual)}
          <b title={current.name}>{current.name}</b>
          <small className="current-engine-plan__detail" aria-label={current.parameterLabel}>
            {current.parameters}
          </small>
        </div>
        <ol className="current-engine-plan__options" aria-label="推荐音擎">
          {visibleRecommendations.map((engine) => (
            <li key={engine.visual?.entityId ?? `${engine.tier}:${engine.name}`}>
              {icon(engine.visual)}
              <small>{engine.isCurrent ? `当前 · ${engine.tierLabel}` : engine.tierLabel}</small>
              <b title={engine.name}>{engine.name}</b>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
