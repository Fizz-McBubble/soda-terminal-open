import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import { gameData32BuildGuidance, gameData32BuildSources } from './gameData32BuildGuidance'
import { playerBuildProfiles30 } from './playerBuildProfiles'
import { asStrings, candidatePriorityToken } from './candidateStatParsing'
import { parseCandidateSubstatPriority } from './candidateSubstatPriority'

/** Ephemeral source guidance; frozen schemas and numeric retention weights are unchanged. */
export function candidatePriorityEvidence(constraint: CandidateWarehouseConstraint) {
  const useful = new Set(
    Object.entries(constraint.subStatWeights)
      .filter(([, weight]) => (weight ?? 0) > 0)
      .map(([stat]) => stat),
  )
  const token = (text: string) => {
    const keys = candidatePriorityToken(text)
    return keys.every((key) => useful.has(key)) ? keys : []
  }
  const matches = (
    source: { id: string; contentHash: string | null; verified?: boolean } | undefined,
  ) =>
    source &&
    source.verified !== false &&
    constraint.sources.some(
      (entry) =>
        entry.verified &&
        entry.id === source.id &&
        Boolean(entry.contentHash && source.contentHash) &&
        entry.contentHash!.toLowerCase() === source.contentHash!.toLowerCase(),
    )
  const guidance = gameData32BuildGuidance[constraint.agentId]
  if (
    guidance &&
    guidance.sourceKeys.length > 0 &&
    guidance.sourceKeys.every((key) => matches(gameData32BuildSources[key])) &&
    guidance.subStatPriorities.every((stat) => useful.has(stat)) &&
    useful.size === guidance.subStatPriorities.length
  ) {
    // The flat useful-stat projection cannot represent equality or conditions.
    // Remove only our exact editorial boundary, never arbitrary source prose.
    const parsed = parseCandidateSubstatPriority(
      guidance.subStatLines.map((line) => line.replace(/；不转为数值权重。$/, '')),
      token,
    )
    if (parsed.kind !== 'unparsed' && parsed.tiers.flat().length === useful.size) {
      return { ...parsed, sourceText: [...guidance.subStatLines] }
    }
  }
  const field = playerBuildProfiles30
    .find((row) => row.agentId === constraint.agentId)
    ?.fields.find((row) => row.path === 'build.main_sub_stats')
  if (field && matches(field.source ?? undefined)) {
    const value = field.value
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? 'subStats' in value
          ? asStrings(value.subStats)
          : 'sub' in value
            ? asStrings(value.sub)
            : []
        : asStrings(value)
    const parsed = parseCandidateSubstatPriority(raw, token)
    if (parsed.kind !== 'unparsed') return parsed
  }
  return parseCandidateSubstatPriority([...useful].sort(), token)
}
