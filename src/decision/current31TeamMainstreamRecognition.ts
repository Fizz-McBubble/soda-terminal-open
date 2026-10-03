import {
  currentReviewedTeamCompatibilityNotes,
  currentReviewedTeamSourceDirections,
} from '../gameDataPacks/reviewedTeamSourceDirections'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'

export function formationKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function createMainstreamRecognitionIndex(reviewVersion: string) {
  return new Map(
    currentReviewedTeamSourceDirections(reviewVersion)
      .map((item) => ({
        ...item,
        sourceRefs: item.sourceRefs.filter(
          (ref) => ref.observationRole !== 'author_comparison_setup',
        ),
      }))
      .filter((item) => item.sourceRefs.length > 0)
      .map((item) => [
        formationKey(item.memberIds),
        {
          evidenceRefs: item.sourceRefs.map((ref) => ref.url),
          conditions: [...item.conditions],
          sourceBangbooOptionIds: [...(item.sourceBangbooOptionIds ?? [])],
          historicalReferenceOnly: item.sourceRefs.every(
            (ref) => ref.verificationStatus === 'historical_membership_reference',
          ),
        },
      ]),
  )
}
const indicesByReviewVersion = new Map<
  string,
  ReturnType<typeof createMainstreamRecognitionIndex>
>()
export function recognitionIndex(reviewVersion: string) {
  let index = indicesByReviewVersion.get(reviewVersion)
  if (!index) {
    index = createMainstreamRecognitionIndex(reviewVersion)
    indicesByReviewVersion.set(reviewVersion, index)
  }
  return index
}

const compatibilityNotesByFormationKey = new Map(
  currentReviewedTeamCompatibilityNotes().map((item) => [formationKey(item.memberIds), item]),
)

export type Current31MainstreamRecognition = {
  status: 'confirmed' | 'unknown'
  evidenceRefs: string[]
  explanation: string
  conditions?: string[]
  sourceBangbooOptionIds?: string[]
  historicalReferenceOnly?: boolean
}

export function resolveCurrent31MainstreamRecognition(
  memberIds: readonly [string, string, string],
  reviewVersion: string = currentVersionProjection.gameVersion,
): Current31MainstreamRecognition {
  const recognized = recognitionIndex(reviewVersion).get(formationKey(memberIds))
  const note = compatibilityNotesByFormationKey.get(formationKey(memberIds))
  const conditions = [...new Set([...(recognized?.conditions ?? []), ...(note?.conditions ?? [])])]
  const evidenceRefs = [
    ...new Set([
      ...(recognized?.evidenceRefs ?? []),
      ...(note?.sourceRefs.map((ref) => ref.url) ?? []),
    ]),
  ]
  return recognized
    ? {
        status: 'confirmed',
        evidenceRefs,
        conditions,
        sourceBangbooOptionIds: [...recognized.sourceBangbooOptionIds],
        historicalReferenceOnly: recognized.historicalReferenceOnly,
        explanation: recognized.historicalReferenceOnly
          ? `历史来源收录该精确三人搭配；仅作成员组合参考，不提供 ${reviewVersion} 当前版本资格、强度档位或排序。`
          : '当前已审阅配队来源收录该精确三人搭配；这只支持候选可达，不提供强度档位或排序。',
      }
    : {
        status: 'unknown',
        evidenceRefs,
        conditions,
        explanation: note
          ? '来源讨论了该组合的适用性限制，未据此确认它为推荐方向。'
          : '当前来源化主流识别目录未确认该精确三人组合；unknown 不等于 weak。',
      }
}

// Recovered kernel bands are provenance diagnostics only. They cannot project a
// product Team Strength for every eligible third-member expansion.
