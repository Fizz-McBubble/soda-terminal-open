import performance323 from '../gameDataPacks/data/reviewed-team-performance.3.2.3.json'
import performance31 from '../gameDataPacks/data/reviewed-team-performance.3.1.json'
import { currentBangbooNumericCatalog } from '../gameDataPacks/currentBangbooNumericCatalog'

const formationKey = (ids: readonly string[]) => [...ids].sort().join('|')
const bangbooById = new Map(currentBangbooNumericCatalog.items.map((item) => [item.stableId, item]))

type PerformanceData = typeof performance323 | typeof performance31

function extractRecordsFromPerformance(perf: PerformanceData, memberIds: readonly string[]) {
  const target = perf.targetTrios.find(
    (row) => formationKey(row.stableMemberIds) === formationKey(memberIds),
  )
  if (!target) return null

  const sourceMembers = formationKey(Object.values(target.sourceSlugByStableMemberId))
  const records = perf.sources.flatMap((source) =>
    source.observations.flatMap((row) => {
      if (row.targetTrioId !== target.id || formationKey(row.characterSlugs) !== sourceMembers)
        return []
      const observedBangboo = bangbooById.get(`bangboo-${row.bangbooSlug}`)
      return [
        {
          context: `${source.phase === 'shiyu_defense' ? '式舆防卫战' : '危局强袭'} ${source.partition}`,
          bangbooId: observedBangboo?.stableId ?? null,
          bangbooName: observedBangboo?.playerName ?? '未公布',
          // Zero includes unpublished/suppressed results. It is not evidence
          // that no player used this team at that investment.
          hasM0: row.avgRoundM0 > 0,
          hasM1: row.avgRoundM1 > 0,
          m0Value: row.avgRoundM0 > 0 ? row.avgRoundM0 : null,
          m1Value: row.avgRoundM1 > 0 ? row.avgRoundM1 : null,
          metric: source.metric,
          sourceUrl: source.url,
          appearanceRank: 'rank' in row ? row.rank : null,
          appRatePercent: row.appRate,
        },
      ]
    }),
  )

  return { target, records, checkedAt: perf.checkedAt, gameVersion: perf.gameVersion }
}

export type ReviewedTeamCombatEvidenceOptions = {
  preferredVersion?: '3.2.3' | '3.1.3'
}

/** Upstream groups performance by three agents. Its Bangboo field is the most
 * used Bangboo in that aggregate, not the subject of the performance measure.
 * Prioritizes current 3.2.3 7-partition records, while preserving 3.1.3 fallback. */
export function reviewedTeamCombatEvidence(
  memberIds: readonly string[],
  bangbooId: string | null,
  options?: ReviewedTeamCombatEvidenceOptions,
) {
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return null

  const preferred = options?.preferredVersion ?? '3.2.3'

  let extracted: ReturnType<typeof extractRecordsFromPerformance>
  let activeVersion: typeof preferred

  if (preferred === '3.1.3') {
    extracted = extractRecordsFromPerformance(performance31, memberIds)
    activeVersion = '3.1.3'
  } else {
    // 3.2.3 prioritized
    extracted = extractRecordsFromPerformance(performance323, memberIds)
    activeVersion = '3.2.3'
    // Fall back to 3.1.3 if not found in 3.2.3, preserving 3.1.3 without pretending to be current
    if (!extracted) {
      extracted = extractRecordsFromPerformance(performance31, memberIds)
      if (extracted) {
        activeVersion = '3.1.3'
      }
    }
  }

  // Absence from this bounded corpus is not absence from all public data.
  if (!extracted) return null

  const { records, checkedAt } = extracted
  const selected = records.filter((row) => row.bangbooId === bangbooId)
  const selectedStatus = !bangbooId
    ? ('unselected' as const)
    : selected.length
      ? ('listed_as_common' as const)
      : ('not_listed_as_common' as const)

  const summary = !records.length
    ? '已核对的实战资料中暂无这套三人组合。'
    : records.some((row) => row.hasM0)
      ? '这套三人组合有已公布的限定 S 级零影汇总表现。'
      : records.some((row) => row.hasM1)
        ? '这套三人组合有高影分组汇总表现，零影分组未公布有效数值。'
        : '资料收录了这套三人组合，尚未公布有效表现数值。'

  return {
    version: activeVersion,
    checkedAt,
    selectedBangbooId: bangbooId,
    selectedStatus,
    grain: 'exact_three_aggregate' as const,
    bangbooRole: 'most_used_in_aggregate' as const,
    summary,
    records,
    boundary:
      '表现按三人组合汇总，列出的邦布是该分组最常用的选择，不代表换用它后的收益。零影筛选仅针对限定 S 级代理人；未公布数值不等于无人使用。缺少队伍样本量和统一配装、操作条件，不能据此判定强弱。',
  }
}

export type ReviewedTeamCombatEvidence = NonNullable<ReturnType<typeof reviewedTeamCombatEvidence>>
