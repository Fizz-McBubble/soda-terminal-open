import { Fragment } from 'react'
import type {
  DevelopmentCandidateRankingBasis,
  DevelopmentCandidateRankingEntry,
} from '../../decision/developmentCandidateRanking'
import { stableContentHash } from '../../gameDataPacks/types'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data } from './types'
import { benchmarkLabel, effectiveHitLabel } from './top10Labels'
import { comparisonImpactTone } from './comparisonImpactTone'
import {
  developmentCandidateRankingContract as candidateRankingContract,
  developmentCandidateRankingVersion as candidateRankingVersion,
} from '../../decision/developmentCandidateRankingIdentity'

type CandidateRow = GoldenTop10Data['candidates'][number]
type TrustedRankingEntry = DevelopmentCandidateRankingEntry

function rankingLabel(entry: TrustedRankingEntry | undefined) {
  if (!entry) return null
  const basis: DevelopmentCandidateRankingBasis = entry.basis
  if (entry.comparable && entry.groupRank !== null) {
    const method =
      basis.kind === 'panel_target'
        ? '面板目标'
        : basis.kind === 'fixed_event_output'
          ? '固定事件输出'
          : basis.kind === 'prepared_anomaly_output'
            ? '单次异常结算'
            : basis.kind === 'functional_capacity'
              ? basis.unit === '失衡量'
                ? '固定动作失衡量'
                : basis.unit === '护盾量'
                  ? '单次护盾'
                  : `支援${basis.unit}增益`
              : null
    if (method) return `${method} · 组内 ${entry.groupRank}/${entry.groupSize}`
  }
  if (basis.kind === 'source_priority') return '同类搭配'
  return null
}

function candidateDiscIdentity(data: GoldenTop10Data, row: CandidateRow) {
  if (!data.panelScopeKey || !row.discIds || row.discIds.length !== 6) return null
  let agentId: unknown
  try {
    const scope = JSON.parse(data.panelScopeKey)
    agentId = Array.isArray(scope) ? scope[1] : undefined
  } catch {
    return null
  }
  if (typeof agentId !== 'string' || !agentId) return null
  const discsById = new Map(data.discs.map((disc) => [disc.id, disc]))
  const discs = row.discIds.flatMap((id) => {
    const disc = discsById.get(id)
    return disc ? [[disc.slot, disc.id] as const] : []
  })
  if (
    discs.length !== 6 ||
    new Set(row.discIds).size !== 6 ||
    new Set(discs.map(([slot]) => slot)).size !== 6 ||
    discs.some(([slot]) => slot < 1 || slot > 6)
  )
    return null
  return stableContentHash({
    agentId,
    discs: discs.toSorted((left, right) => left[0] - right[0]),
  })
}

function trustedCandidateRanking(data: GoldenTop10Data) {
  const ranking = data.candidateSearch?.candidateRanking
  if (
    !ranking ||
    data.snapshot?.stale ||
    ranking.contract !== candidateRankingContract ||
    ranking.version !== candidateRankingVersion ||
    ranking.candidateRarityScope !== 'S' ||
    !ranking.identity ||
    ranking.identity !==
      stableContentHash({
        contract: ranking.contract,
        version: ranking.version,
        source: ranking.source,
        comparisonParametersIdentity: ranking.comparisonParametersIdentity,
        entries: ranking.entries,
      })
  )
    return null

  const rowsByRank = new Map(data.candidates.map((row) => [row.rank, row]))
  const entriesByRank = new Map<number, TrustedRankingEntry>()
  const identities = new Set<string>()
  for (const entry of ranking.entries) {
    const groupId = entry.groupId
    if (
      !Number.isInteger(entry.candidateRank) ||
      entry.candidateRank < 1 ||
      !rowsByRank.has(entry.candidateRank) ||
      entriesByRank.has(entry.candidateRank) ||
      !entry.candidateIdentity ||
      identities.has(entry.candidateIdentity) ||
      !groupId ||
      !Number.isInteger(entry.groupSize) ||
      entry.groupSize < 1 ||
      (entry.basis.kind === 'unranked' &&
        entry.basis.reason === 'parameter_bound_projection_mismatch') ||
      entry.comparisonParametersIdentity !== ranking.comparisonParametersIdentity
    )
      return null
    entriesByRank.set(entry.candidateRank, entry)
    identities.add(entry.candidateIdentity)
  }
  if (entriesByRank.size !== rowsByRank.size) return null

  for (const row of data.candidates) {
    const entry = entriesByRank.get(row.rank)
    const identity = candidateDiscIdentity(data, row)
    if (!entry || !identity || identity !== entry.candidateIdentity) return null
  }

  for (const [rankKey, search] of Object.entries(data.candidateSearchByRank ?? {})) {
    const rank = Number(rankKey)
    if (!Number.isInteger(rank) || rank < 1) continue
    const boundRanking = search.candidateRanking
    if (
      !boundRanking ||
      boundRanking.identity !== ranking.identity ||
      boundRanking.comparisonParametersIdentity !== ranking.comparisonParametersIdentity
    )
      return null
  }

  const groups = new Map<string, TrustedRankingEntry[]>()
  for (const entry of ranking.entries) {
    const groupId = entry.groupId
    if (!groupId) return null
    const group = groups.get(groupId) ?? []
    group.push(entry)
    groups.set(groupId, group)
  }
  for (const group of groups.values()) {
    const basis = group[0]?.basis
    const comparable = group[0]?.comparable
    if (
      !basis ||
      typeof comparable !== 'boolean' ||
      group.some(
        (entry) =>
          entry.groupSize !== group.length ||
          entry.comparable !== comparable ||
          entry.basis.kind !== basis.kind ||
          entry.basis.direction !== basis.direction,
      )
    )
      return null
    const ranked = group.flatMap((entry) =>
      entry.groupRank === null ? [] : [{ entry, rank: entry.groupRank }],
    )
    if (comparable) {
      if (
        ranked.length !== group.length ||
        new Set(ranked.map(({ rank }) => rank)).size !== group.length ||
        ranked.some(({ rank }) => rank < 1 || rank > group.length)
      )
        return null
    } else if (ranked.length) {
      return null
    }
  }
  return entriesByRank
}

/** Keep each set/count together while allowing breaks between set items. */
export function SetSummary({ text }: { text: string }) {
  return (
    <span className="comparison-set-summary">
      {text.split(/\s+\+\s+/u).map((item, index) => {
        const parts = /^(.*?)(\s*\d+件)$/u.exec(item)
        return (
          <Fragment key={`${index}:${item}`}>
            {index > 0 ? <span className="comparison-set-delimiter"> + </span> : null}
            <span className="comparison-set-item">
              <span className="comparison-set-item__name">{parts?.[1] ?? item}</span>
              {parts ? <span className="comparison-set-item__count">{parts[2]}</span> : null}
            </span>
          </Fragment>
        )
      })}
    </span>
  )
}

export interface Top10CandidateNavProps {
  data: GoldenTop10Data
  conflictFreeOnly: boolean
  setConflictFreeOnly: (value: boolean) => void
  selected: number
  selectedRow?: CandidateRow
  visibleCandidates: CandidateRow[]
  baselineAvailable: boolean
  baselineLabel: string
  baselineDisplay: string
  onSelectCandidatePlan?: AgentDevelopmentGoldenProps['onSelectCandidatePlan']
  setSelected: (rank: number) => void
}

export function Top10CandidateNav({
  data,
  conflictFreeOnly,
  setConflictFreeOnly,
  selected,
  selectedRow,
  visibleCandidates,
  baselineAvailable,
  baselineLabel,
  baselineDisplay,
  onSelectCandidatePlan,
  setSelected,
}: Top10CandidateNavProps) {
  const rankingEntries = trustedCandidateRanking(data)
  const renderCandidate = (row: CandidateRow, entry?: TrustedRankingEntry) => {
    const isSelected = selectedRow?.rank === row.rank
    const benchmark = data.valueBenchmarks?.[row.rank - 1]
    const impactTone = comparisonImpactTone(benchmark, Boolean(data.snapshot?.stale))
    const rankLabel = rankingLabel(entry)
    const hasScore =
      !data.snapshot?.stale && row.fit.trim() !== '' && Number.isFinite(Number(row.fit))
    return (
      <button
        key={row.rank}
        data-candidate-id={row.rank}
        data-ranking-basis={entry?.basis.kind ?? 'unranked'}
        title={rankLabel ? `${row.sets} · ${rankLabel}` : row.sets}
        className={`comparison-candidate${isSelected ? ' is-selected' : ''}`}
        type="button"
        aria-pressed={isSelected}
        onClick={() => {
          setSelected(row.rank)
          onSelectCandidatePlan?.(row.rank)
        }}
      >
        <span className="comparison-candidate__rank" aria-hidden="true">
          {row.rank}
        </span>
        <span className="comparison-candidate__identity">
          <strong>{row.label}</strong>
          <small>
            <SetSummary text={row.sets} />
          </small>
          {rankLabel ? <small>{rankLabel}</small> : null}
        </span>
        {baselineAvailable ? (
          <span className="comparison-candidate__impact">
            <b data-impact-tone={impactTone}>
              {benchmarkLabel(benchmark, Boolean(data.snapshot?.stale))}
            </b>
            <small>{row.swaps === null ? '—' : `${row.swaps} 张替换`}</small>
          </span>
        ) : null}
        <span className="comparison-candidate__metrics">
          {/^\d+(?:\.\d+)?$/.test(row.effective) ? (
            <small className="comparison-hit-count" aria-label={effectiveHitLabel(row.effective)}>
              有效命中 {row.effective} 次
            </small>
          ) : null}
          {hasScore ? <b>配装评分 {row.fit}</b> : null}
          {row.conflict ? <small className="comparison-conflict-badge">有冲突</small> : null}
        </span>
        <em>{isSelected ? '已选' : '查看'}</em>
      </button>
    )
  }

  return (
    <nav className="comparison-candidates" aria-label="仓库方案比较" tabIndex={0}>
      <div className="comparison-candidates-heading">
        {!data.currentLoadout && !data.currentPlan ? (
          <div className="comparison-baseline">
            <span title={baselineLabel}>{baselineDisplay}</span>
            <strong>
              <SetSummary text={baselineAvailable ? data.baseline.sets : '尚无比较基线'} />
            </strong>
            {!baselineAvailable ? (
              <small>可先查看并保存生成方案。</small>
            ) : /^\d+(?:\.\d+)?$/.test(data.baseline.effective) ? (
              <small>{effectiveHitLabel(data.baseline.effective)}</small>
            ) : null}
          </div>
        ) : null}
        {data.currentLoadout ? (
          <button
            type="button"
            className="comparison-baseline comparison-current-plan"
            aria-pressed={selected === 0}
            onClick={() => {
              setSelected(0)
              onSelectCandidatePlan?.(0)
            }}
          >
            <span title={baselineLabel}>比较基准 · {baselineDisplay}</span>
            <strong>
              <SetSummary text={data.currentLoadout.sets} />
            </strong>
            <small>无需换盘，可继续查看当前六盘。</small>
          </button>
        ) : null}
        {data.currentPlan ? (
          <button
            type="button"
            className="comparison-baseline comparison-current-plan"
            aria-pressed={selected === data.currentPlan.rank}
            onClick={() => {
              setSelected(data.currentPlan!.rank)
              onSelectCandidatePlan?.(data.currentPlan!.rank)
            }}
          >
            <strong>已保存方案</strong>
            <span>
              <SetSummary text={data.currentPlan.sets} />
            </span>
            {/^\d+(?:\.\d+)?$/.test(data.currentPlan.effective) ? (
              <small className="comparison-hit-count">
                {effectiveHitLabel(data.currentPlan.effective)}
              </small>
            ) : null}
          </button>
        ) : null}
        <div className="comparison-filter">
          <button
            type="button"
            aria-pressed={conflictFreeOnly}
            onClick={() => {
              const next = !conflictFreeOnly
              setConflictFreeOnly(next)
              if (next && selectedRow?.conflict) {
                const first = data.candidates.find((row) => !row.conflict)
                if (first) {
                  setSelected(first.rank)
                  onSelectCandidatePlan?.(first.rank)
                }
              }
            }}
          >
            仅无冲突
          </button>
        </div>
      </div>
      {conflictFreeOnly && !visibleCandidates.length ? (
        <p className="comparison-filter-empty" role="status">
          当前候选中没有无冲突方案。
        </p>
      ) : null}
      {visibleCandidates.map((row) => renderCandidate(row, rankingEntries?.get(row.rank)))}
    </nav>
  )
}
