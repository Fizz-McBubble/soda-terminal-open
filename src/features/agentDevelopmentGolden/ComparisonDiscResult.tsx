import { DevelopmentDiscCard } from './DevelopmentDiscCard'
import { DiscStatComparisonDisclosure } from './DiscStatComparison'
import type { DiscFact } from './types'

export function ComparisonDiscResult({
  disc,
  baseline,
  baselineLabel,
}: {
  disc: DiscFact
  baseline?: DiscFact
  baselineLabel: string
}) {
  const changed = baseline ? baseline.id !== disc.id : null
  return (
    <div
      className="comparison-disc-result"
      data-comparison-difference={
        changed === null ? 'unavailable' : changed ? 'changed' : 'retained'
      }
    >
      <DevelopmentDiscCard disc={disc} changed={changed} />
      {changed ? (
        <DiscStatComparisonDisclosure
          before={baseline!}
          after={disc}
          baselineLabel={baselineLabel}
        />
      ) : null}
    </div>
  )
}
