import { useMemo, useRef, useState } from 'react'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { BackNavigation } from '../../components/BackNavigation'
import { DevelopmentDiscCard } from './DevelopmentDiscCard'
import { Top10StatTable } from './Top10StatTable'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data, JourneyScenario } from './types'
import {
  benchmarkLabel,
  benchmarkOverallReason,
  benchmarkScopeNote,
  effectiveHitLabel,
} from './top10Labels'

export function Top10({
  back,
  scenario,
  data,
  onSavePlan,
  onSelectCandidatePlan,
  onReanalyzeWarehouse,
}: {
  back: () => void
  scenario: JourneyScenario
  data: GoldenTop10Data
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onSelectCandidatePlan?: AgentDevelopmentGoldenProps['onSelectCandidatePlan']
  onReanalyzeWarehouse?: AgentDevelopmentGoldenProps['onReanalyzeWarehouse']
}) {
  const preferredRank =
    data.selectedCandidateRank ??
    (scenario === 'conflict'
      ? (data.candidates[2]?.rank ?? data.candidates[0]?.rank ?? 0)
      : (data.candidates[0]?.rank ?? 0))
  const [selection, setSelection] = useState({
    externalRank: data.selectedCandidateRank,
    rank: preferredRank,
  })
  // A saved/recomputed candidate can move to a new rank without remounting this view.
  const changedSelection = selection.externalRank !== data.selectedCandidateRank
  const selected = changedSelection ? preferredRank : selection.rank
  if (changedSelection) {
    setSelection({ externalRank: data.selectedCandidateRank, rank: preferredRank })
  }
  const resultRef = useRef<HTMLElement>(null)
  const setSelected = (rank: number) => {
    setSelection({ externalRank: data.selectedCandidateRank, rank })
    if (resultRef.current) resultRef.current.scrollTop = 0
  }
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzeMessage, setReanalyzeMessage] = useState<string | null>(null)
  const [conflictFreeOnly, setConflictFreeOnly] = useState(false)
  const visibleCandidates = data.candidates.filter((row) => !conflictFreeOnly || !row.conflict)

  const selectedRow =
    selected === 0 && data.currentPlan && (!conflictFreeOnly || !data.currentPlan.conflict)
      ? data.currentPlan
      : (visibleCandidates.find((row) => row.rank === selected) ?? visibleCandidates[0])
  const selectedBenchmark = selectedRow ? data.valueBenchmarks?.[selectedRow.rank - 1] : undefined
  const discsById = useMemo(() => new Map(data.discs.map((disc) => [disc.id, disc])), [data.discs])
  const selectedDiscs = selectedRow?.discIds?.flatMap((id) => {
    const disc = discsById.get(id)
    return disc ? [disc] : []
  })
  const baselineDiscs = (data.baseline.discIds ?? []).flatMap((id) => {
    const disc = discsById.get(id)
    return disc ? [disc] : []
  })
  const baselineBySlot = new Map(
    (data.baseline.discIds ?? []).flatMap((id) => {
      const disc = discsById.get(id)
      return disc ? [[disc.slot, disc.id] as const] : []
    }),
  )
  const baselineAvailable = data.baselineKind
    ? data.baselineKind !== 'none'
    : data.baselineAvailability !== 'unavailable'
  const actualBaseline = data.baselineKind ? data.baselineKind === 'actual' : baselineAvailable
  const baselineLabel = data.baselineLabel ?? (actualBaseline ? '当前实装' : '比较方案')
  const baselineDisplay =
    data.baselineKind === 'saved'
      ? '已保存方案'
      : data.baselineKind === 'candidate'
        ? '方案 1'
        : actualBaseline
          ? '当前实装'
          : baselineLabel.length > 18
            ? '比较方案'
            : baselineLabel
  useStateTransitionMotion({
    scope: resultRef,
    stateKey: `${selectedRow?.rank ?? 0}:${selectedRow?.discIds?.join('|') ?? ''}`,
    includeScope: true,
    enabled: !reanalyzing,
  })

  const reanalyze = async () => {
    if (!onReanalyzeWarehouse || reanalyzing) return
    setReanalyzing(true)
    setReanalyzeMessage('正在重新搭配当前仓库…')
    try {
      await onReanalyzeWarehouse()
      setReanalyzeMessage('搭配完成，方案已刷新。')
    } catch (error) {
      setReanalyzeMessage(playerErrorMessage(error, '重新搭配失败，请稍后重试。'))
    } finally {
      setReanalyzing(false)
    }
  }

  const save = () => {
    if (!onSavePlan || !selectedRow) return
    setSaveError(null)
    setSaving(true)
    void Promise.resolve(onSavePlan(selectedRow.rank))
      .catch((error: unknown) => setSaveError(playerErrorMessage(error, '保存失败，请稍后重试。')))
      .finally(() => setSaving(false))
  }

  if (!data.candidates.length && !baselineAvailable) {
    return (
      <section className="top10 top10-empty" aria-labelledby="top10-title">
        <header className="page-heading compact comparison-heading">
          <div>
            <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
            <h1 id="top10-title">暂时没有匹配方案</h1>
            <p>{data.agentName}暂时没有完整方案。未记录游戏当前实装，可从仓库搭配方案。</p>
          </div>
          {onReanalyzeWarehouse ? (
            <button
              className="comparison-reanalyze"
              type="button"
              disabled={reanalyzing}
              onClick={() => void reanalyze()}
            >
              {reanalyzing ? '正在搭配…' : '从仓库搭配方案'}
            </button>
          ) : null}
        </header>
        {reanalyzeMessage ? (
          <p className="comparison-feedback" role="status" aria-live="polite">
            {reanalyzeMessage}
          </p>
        ) : null}
      </section>
    )
  }

  if (!data.candidates.length) {
    return (
      <section className="top10 top10-baseline-only" aria-labelledby="top10-title">
        <header className="page-heading compact comparison-heading">
          <div>
            <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
            <h1 id="top10-title">{baselineDisplay}</h1>
            <p>这份方案已配齐 6 张驱动盘，暂时没有其他匹配方案。</p>
          </div>
          {onReanalyzeWarehouse ? (
            <button
              className="comparison-reanalyze"
              type="button"
              disabled={reanalyzing}
              onClick={() => void reanalyze()}
            >
              {reanalyzing ? '正在搭配…' : '重新搭配'}
            </button>
          ) : null}
        </header>

        <div className="top10-layout comparison-workbench">
          <aside className="comparison-candidates" aria-label={baselineDisplay}>
            <div className="comparison-baseline">
              <span>{baselineDisplay}</span>
              <strong>{data.baseline.sets}</strong>
              <small>{data.baseline.effective} 有效词条</small>
            </div>
            <p className="comparison-empty-candidates" role="status">
              可重新搭配，查找其他搭配。
            </p>
          </aside>

          <section className="comparison-detail" aria-label="方案明细">
            <header className="comparison-detail__summary">
              <div>
                <small>{baselineDisplay}</small>
                <h2 id="comparison-discs-title">{data.baseline.label} · 六盘明细</h2>
                <p>{data.baseline.sets}</p>
              </div>
              <dl>
                <div>
                  <dt>换盘</dt>
                  <dd>{baselineDisplay}</dd>
                </div>
                <div>
                  <dt>替换候选</dt>
                  <dd>暂无</dd>
                </div>
              </dl>
            </header>
            {reanalyzeMessage ? (
              <p className="comparison-feedback" role="status" aria-live="polite">
                {reanalyzeMessage}
              </p>
            ) : null}
            <section className="comparison-evidence" aria-labelledby="comparison-discs-title">
              <header>
                <strong>{baselineDiscs.length} / 6</strong>
              </header>
              <div className="comparison-disc-strip">
                {baselineDiscs.map((disc) => (
                  <DevelopmentDiscCard key={disc.id} disc={disc} changed={false} />
                ))}
              </div>
            </section>
          </section>
        </div>
      </section>
    )
  }

  return (
    <section className="top10" aria-labelledby="top10-title">
      <header className="page-heading compact comparison-heading">
        <div>
          <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
          <h1 id="top10-title">方案比较</h1>
          <p>比较驱动盘搭配和属性，选择适合的方案保存。</p>
          {!actualBaseline && !baselineAvailable ? <p>暂无当前实装，可先查看仓库方案。</p> : null}
        </div>
        {onReanalyzeWarehouse ? (
          <button
            className="comparison-reanalyze"
            type="button"
            disabled={reanalyzing}
            onClick={() => void reanalyze()}
          >
            {reanalyzing ? '正在搭配…' : '重新搭配'}
          </button>
        ) : null}
      </header>

      <div className="top10-layout comparison-workbench">
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
            {!data.currentPlan ? (
              <div className="comparison-baseline">
                <span title={baselineLabel}>{baselineDisplay}</span>
                <strong>{baselineAvailable ? data.baseline.sets : '尚无比较基线'}</strong>
                <small>
                  {baselineAvailable
                    ? `${data.baseline.effective} 有效词条`
                    : '可先查看并保存生成方案。'}
                </small>
              </div>
            ) : null}
            {data.currentPlan ? (
              <button
                type="button"
                className="comparison-baseline comparison-current-plan"
                aria-pressed={selected === 0}
                onClick={() => setSelected(0)}
              >
                <strong>已保存方案</strong>
                <span>{data.currentPlan.sets}</span>
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
                  <small>{row.sets}</small>
                </span>
                <span className="comparison-candidate__metrics">
                  <b aria-label={`配装评分 ${row.fit}`}>{row.fit}</b>
                  <small className="comparison-hit-count">{effectiveHitLabel(row.effective)}</small>
                  {row.conflict ? (
                    <small className="comparison-conflict-badge">有冲突</small>
                  ) : null}
                </span>
                {baselineAvailable ? (
                  <span>
                    <b>{benchmarkLabel(benchmark, Boolean(data.snapshot?.stale))}</b>
                    <small>{row.swaps === null ? '—' : `${row.swaps} 张替换`}</small>
                  </span>
                ) : null}
                <em>{isSelected ? '已选' : '查看'}</em>
              </button>
            )
          })}
        </nav>

        <section
          hidden={!selectedRow}
          ref={resultRef}
          className="comparison-detail"
          aria-label="当前方案操作"
          tabIndex={0}
        >
          <header className="comparison-detail__summary comparison-detail__summary--inline">
            <div className="comparison-summary-intro">
              <h2 id="comparison-discs-title">{selectedRow?.label ?? '方案'} · 六盘明细</h2>
              <span>{selectedRow?.sets ?? '未找到套装组合'}</span>
              {selectedRow?.mainStatDifferences?.length ? (
                <span>主词条：{selectedRow.mainStatDifferences.join('；')}</span>
              ) : null}
              {!data.snapshot?.stale &&
              selectedBenchmark &&
              (selectedBenchmark.coverage.domain === 'fixed_event_direct_damage' ||
                benchmarkOverallReason(selectedBenchmark)) ? (
                <span className="comparison-summary-intro__note">
                  {benchmarkScopeNote(selectedBenchmark)}
                </span>
              ) : null}
              {baselineAvailable &&
              !data.snapshot?.stale &&
              selectedBenchmark?.status === 'supported' &&
              selectedBenchmark.comparisonBasis.changedDimensions.length > 1 ? (
                <span className="comparison-summary-intro__note">
                  输出对比同时计入
                  {selectedBenchmark.comparisonBasis.changedDimensions
                    .map((dimension) =>
                      dimension === 'disc_loadout'
                        ? '驱动盘'
                        : dimension === 'w_engine'
                          ? '音擎'
                          : dimension === 'bangboo'
                            ? '邦布'
                            : dimension === 'potential'
                              ? '潜能'
                              : dimension,
                    )
                    .join('、')}
                  的变化。
                </span>
              ) : null}
            </div>
            <dl>
              {baselineAvailable ? (
                <>
                  <div>
                    <dt>相比{baselineDisplay}</dt>
                    <dd>{benchmarkLabel(selectedBenchmark, Boolean(data.snapshot?.stale))}</dd>
                  </div>
                  <div>
                    <dt>换盘</dt>
                    <dd>{selectedRow?.swaps === null ? '—' : `${selectedRow?.swaps ?? 0} 张`}</dd>
                  </div>
                </>
              ) : null}
              {selectedRow?.conflict ? (
                <div>
                  <dt>其他养成方案也在用</dt>
                  <dd>{selectedRow.conflict}</dd>
                </div>
              ) : null}
            </dl>
            {data.snapshot?.stale && !saving ? (
              <span className="comparison-status" role="status">
                装备已更新，重新搭配后即可保存。
              </span>
            ) : null}
            <strong className="comparison-disc-count">{selectedDiscs?.length ?? 0} / 6</strong>
            <button
              className="primary"
              type="button"
              disabled={
                saving ||
                reanalyzing ||
                Boolean(data.snapshot?.stale) ||
                !onSavePlan ||
                !selectedRow ||
                selectedRow.rank === 0
              }
              onClick={save}
            >
              {saving ? '正在保存…' : selectedRow?.rank === 0 ? '已保存方案' : '保存为养成方案'}
            </button>
          </header>

          {reanalyzeMessage ? (
            <p className="comparison-feedback" role="status" aria-live="polite">
              {reanalyzeMessage}
            </p>
          ) : null}
          {saveError ? (
            <p className="error-message" role="alert">
              {saveError}
            </p>
          ) : null}

          <section className="comparison-evidence" aria-labelledby="comparison-discs-title">
            <div className="comparison-disc-strip">
              {selectedDiscs?.map((disc) => (
                <DevelopmentDiscCard
                  key={disc.id}
                  disc={disc}
                  changed={baselineAvailable ? baselineBySlot.get(disc.slot) !== disc.id : null}
                />
              ))}
            </div>
          </section>

          <Top10StatTable
            data={data}
            selectedRow={selectedRow}
            baselineAvailable={baselineAvailable}
            baselineLabel={baselineDisplay}
          />
        </section>
      </div>
    </section>
  )
}
