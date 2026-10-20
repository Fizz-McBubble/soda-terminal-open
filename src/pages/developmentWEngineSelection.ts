import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import type { DevelopmentWEngineComparisonSelection } from '../application/publicDevelopmentWEngineComparison'
import { contentHash } from '../application/contentHash'

function wEngineParameterIdentity(
  parameters: NonNullable<
    DevelopmentCandidateAlternativesQueryResult['candidateParametersByRank']
  >[number]['wEngine'],
) {
  if (!parameters) return null
  return JSON.stringify([
    parameters.engineId,
    parameters.level,
    parameters.ascension ?? null,
    parameters.refinement,
  ])
}

/** Bind an existing comparison selector to the issued physical six-disc plan. */
export function developmentWEngineComparisonSelection(
  snapshot: DevelopmentCandidateAlternativesQueryResult,
  candidateRank: number,
): DevelopmentWEngineComparisonSelection {
  const discs = snapshot.candidates[candidateRank - 1]?.loadouts[0]?.discs.map((row) => row.disc)
  if (!Number.isSafeInteger(candidateRank) || candidateRank < 1 || discs?.length !== 6)
    throw new Error('音擎比较须选择当前有效的六盘方案。')
  return {
    candidateRank,
    inputFingerprint: snapshot.inputFingerprint,
    loadoutFingerprint: contentHash(discs),
  }
}

export function selectedDevelopmentWEngineOptionKey(
  snapshot: DevelopmentCandidateAlternativesQueryResult,
  candidateRank: number,
) {
  const comparison = snapshot.wEngineComparison
  if (!comparison || comparison.candidateRank !== candidateRank) return null
  const selected = wEngineParameterIdentity(
    snapshot.candidateParametersByRank?.[candidateRank]?.wEngine,
  )
  if (!selected) return null
  return (
    comparison.entries.find(
      (entry) => entry.optionKey && wEngineParameterIdentity(entry.parameters) === selected,
    )?.optionKey ?? null
  )
}

/** A late selector response cannot install parameters into another captured run,
 * re-ranked loadout or scenario. Existing save code already persists this map. */
export function selectDevelopmentWEngineOption(
  snapshot: DevelopmentCandidateAlternativesQueryResult,
  issued: {
    runId: string
    comparisonFingerprint: string
    candidateRank: number
    optionKey: string
  },
): NonNullable<DevelopmentCandidateAlternativesQueryResult['candidateParametersByRank']> {
  const binding = developmentWEngineComparisonSelection(snapshot, issued.candidateRank)
  const comparison = snapshot.wEngineComparison
  if (
    snapshot.runId !== issued.runId ||
    snapshot.comparisonFingerprint !== issued.comparisonFingerprint ||
    !comparison ||
    comparison.candidateRank !== binding.candidateRank ||
    comparison.inputFingerprint !== binding.inputFingerprint ||
    comparison.loadoutFingerprint !== binding.loadoutFingerprint
  )
    throw new Error('音擎选项已过期，请重新比较。')
  const option = comparison.entries.find((row) => row.optionKey === issued.optionKey)
  if (!option?.parameters) throw new Error('此音擎养成事实未完整记录，不能直接应用该选项。')
  return {
    ...structuredClone(snapshot.candidateParametersByRank ?? {}),
    [issued.candidateRank]: {
      ...structuredClone(snapshot.candidateParametersByRank?.[issued.candidateRank] ?? {}),
      wEngine: structuredClone(option.parameters),
    },
  }
}
