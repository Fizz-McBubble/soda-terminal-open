import {
  decisionSectionLabels,
  playerConditionLines,
} from '../application/playerDecisionPresentation'
import './DecisionConditions.css'

/** Required conditions stay beside the result they qualify. */
export function DecisionConditions({
  conditions,
  label = decisionSectionLabels.conditions,
  className,
}: {
  conditions: readonly string[]
  label?: string
  className?: string
}) {
  const lines = playerConditionLines(conditions)
  if (!lines.length) return null
  return (
    <section
      className={['decision-conditions', className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      <h3>{label}</h3>
      <ul>
        {lines.map((line) => (
          <li key={line.source}>{line.text}</li>
        ))}
      </ul>
    </section>
  )
}
