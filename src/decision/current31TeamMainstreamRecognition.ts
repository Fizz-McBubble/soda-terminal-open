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
      .map((item) => {
        const sourceRefs = item.sourceRefs.filter(
          (ref) => ref.observationRole !== 'author_comparison_setup',
        )
        return {
          ...item,
          sourceRefs,
          conditions: item.conditionsBySourceId
            ? [...new Set(sourceRefs.flatMap((ref) => item.conditionsBySourceId![ref.id] ?? []))]
            : item.conditions,
        }
      })
      .filter((item) => item.sourceRefs.length > 0)
      .map((item) => [
        formationKey(item.memberIds),
        {
          evidenceRefs: item.sourceRefs.map((ref) => ref.url),
          conditions: [...item.conditions],
          sourceBangbooOptionIds: [...(item.sourceBangbooOptionIds ?? [])],
          evidenceClass: (() => {
            const currentSources = item.sourceRefs.filter(
              (ref) => ref.verificationStatus !== 'historical_membership_reference',
            )
            const publisherCount = new Set(
              currentSources.flatMap((ref) => {
                try {
                  return [new URL(ref.url).hostname]
                } catch {
                  return []
                }
              }),
            ).size
            if (publisherCount >= 2) return 'current_multi_publisher' as const
            if (publisherCount === 1) return 'current_single_publisher' as const
            return 'historical_reference' as const
          })(),
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
  evidenceClass?:
    | 'current_multi_publisher'
    | 'current_single_publisher'
    | 'historical_reference'
    | 'unknown'
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
        evidenceClass: recognized.evidenceClass,
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
        evidenceClass: 'unknown',
        evidenceRefs,
        conditions,
        explanation: note
          ? '来源讨论了该组合的适用性限制，未据此确认它为推荐方向。'
          : '当前来源化主流识别目录未确认该精确三人组合；unknown 不等于 weak。',
      }
}

// Recovered kernel bands are provenance diagnostics only. They cannot project a
// product Team Strength for every eligible third-member expansion.
