import { ExplanationPopover } from '../components/ExplanationPopover'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { playerDecisionText } from './teamEquipmentParameterPresentation'
import { displayableLocalAnalysis } from './teamLocalAnalysisPresentation'

function playerFacingConditions(item: TeamLoadoutOverviewItem, analysisConditions: string[]) {
  const seen = new Set<string>()
  return [...(item.sourceConditions ?? []), ...analysisConditions]
    .map((condition) => playerDecisionText(condition).trim())
    .filter((condition) => {
      const key = condition.replace(/[。；;]+$/u, '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function TeamRecommendationConditions({ item }: { item: TeamLoadoutOverviewItem }) {
  const analysis = displayableLocalAnalysis(
    item.ratingAnalysis,
    item.teamRatingBand,
    item.confidence,
    item.mechanicValidity,
  )
    ? item.ratingAnalysis
    : undefined
  const conditions = playerFacingConditions(item, analysis?.conditions ?? [])
  const evidence = [
    ...new Map(
      (analysis?.evidenceRefs ?? []).map((reference) => [reference.url, reference]),
    ).values(),
  ]
  if (!conditions.length) return null

  return (
    <ExplanationPopover label="适用条件" title="适用条件">
      {conditions.length ? (
        <>
          <ul>
            {conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </>
      ) : null}
      {evidence.length ? (
        <p>
          {evidence.map((reference, index) => (
            <span key={reference.url}>
              {index ? ' · ' : ''}
              <a href={reference.url} target="_blank" rel="noreferrer">
                参考来源 {index + 1}
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </ExplanationPopover>
  )
}
