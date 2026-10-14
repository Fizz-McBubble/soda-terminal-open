import { Fragment } from 'react'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data } from './types'
import { benchmarkLabel, effectiveHitLabel } from './top10Labels'

type CandidateRow = GoldenTop10Data['candidates'][number]

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
  return (
    <nav className="comparison-candidates" aria-label="仓库方案比较">
      <div className="comparison-candidates-heading">
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
        {!data.currentLoadout && !data.currentPlan ? (
          <div className="comparison-baseline">
            <span title={baselineLabel}>{baselineDisplay}</span>
            <strong>
              <SetSummary text={baselineAvailable ? data.baseline.sets : '尚无比较基线'} />
            </strong>
            <small>
              {baselineAvailable
                ? `${data.baseline.effective} 有效词条`
                : '可先查看并保存生成方案。'}
            </small>
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
            <small className="comparison-hit-count">
              {effectiveHitLabel(data.currentPlan.effective)}
            </small>
          </button>
        ) : null}
      </div>
      {conflictFreeOnly && !visibleCandidates.length ? (
        <p className="comparison-filter-empty" role="status">
          当前候选中没有无冲突方案。
        </p>
      ) : null}
      {visibleCandidates.map((row) => {
        const benchmark = data.valueBenchmarks?.[row.rank - 1]
        const isSelected = selectedRow?.rank === row.rank
        return (
          <button
            key={row.rank}
            title={row.sets}
            className={`comparison-candidate${isSelected ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              setSelected(row.rank)
              onSelectCandidatePlan?.(row.rank)
            }}
          >
            <span className="comparison-candidate__rank">{row.rank}</span>
            <span className="comparison-candidate__identity">
              <strong>{row.label}</strong>
              <small>
                <SetSummary text={row.sets} />
              </small>
            </span>
            {baselineAvailable ? (
              <span className="comparison-candidate__impact">
                <b>{benchmarkLabel(benchmark, Boolean(data.snapshot?.stale))}</b>
                <small>{row.swaps === null ? '—' : `${row.swaps} 张替换`}</small>
              </span>
            ) : null}
            <span className="comparison-candidate__metrics">
              <small className="comparison-hit-count">{effectiveHitLabel(row.effective)}</small>
              <b aria-label={`配装评分 ${row.fit}`}>{row.fit}</b>
              {row.conflict ? <small className="comparison-conflict-badge">有冲突</small> : null}
            </span>
            <em>{isSelected ? '已选' : '查看'}</em>
          </button>
        )
      })}
    </nav>
  )
}
