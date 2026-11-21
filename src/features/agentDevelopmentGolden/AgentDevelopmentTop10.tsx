import { useMemo, useRef, useState } from 'react'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { BackNavigation } from '../../components/BackNavigation'
import { useTop10SaveFeedback } from './useTop10SaveFeedback'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { ComparisonDiscResult } from './ComparisonDiscResult'
import { Top10StatTable } from './Top10StatTable'
import { SetSummary, Top10CandidateNav } from './Top10CandidateNav'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data, JourneyScenario } from './types'
import { benchmarkLabel, benchmarkOverallReason, benchmarkScopeNote } from './top10Labels'
import { comparisonImpactTone } from './comparisonImpactTone'

function Top10Content({
  back,
  scenario,
  data,
  onSavePlan,
  onSelectCandidatePlan,
  onReanalyzeWarehouse,
  comparisonScenarioControl,
  comparisonEquipmentControl,
  onComparisonDetailsOpen,
}: {
  back: () => void
  scenario: JourneyScenario
  data: GoldenTop10Data
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onSelectCandidatePlan?: AgentDevelopmentGoldenProps['onSelectCandidatePlan']
  onReanalyzeWarehouse?: AgentDevelopmentGoldenProps['onReanalyzeWarehouse']
  comparisonScenarioControl?: AgentDevelopmentGoldenProps['comparisonScenarioControl']
  comparisonEquipmentControl?: AgentDevelopmentGoldenProps['comparisonEquipmentControl']
  onComparisonDetailsOpen?: AgentDevelopmentGoldenProps['onComparisonDetailsOpen']
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
    setSelection({
      externalRank: data.selectedCandidateRank,
      rank: preferredRank,
    })
  }
  const resultRef = useRef<HTMLElement>(null)
  const reanalyzeGeneration = useRef(0)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzeMessage, setReanalyzeMessage] = useState<string | null>(null)
  const setSelected = (rank: number) => {
    reanalyzeGeneration.current += 1
    setReanalyzing(false)
    setReanalyzeMessage(null)
    setSelection({ externalRank: data.selectedCandidateRank, rank })
    if (resultRef.current) resultRef.current.scrollTop = 0
  }
  const [conflictFreeOnly, setConflictFreeOnly] = useState(false)
  const visibleCandidates = data.candidates.filter((row) => !conflictFreeOnly || !row.conflict)

  const retainedCurrent = data.currentLoadout ?? data.currentPlan
  const selectedRow =
    selected === 0 && retainedCurrent && (!conflictFreeOnly || !retainedCurrent.conflict)
      ? retainedCurrent
      : selected === -1 && data.currentPlan && (!conflictFreeOnly || !data.currentPlan.conflict)
        ? data.currentPlan
        : (visibleCandidates.find((row) => row.rank === selected) ?? visibleCandidates[0])
  const { save, saving, saveError, saveMessage, saveScope } = useTop10SaveFeedback(
    data,
    selected,
    selectedRow,
    onSavePlan,
  )
  const selectedBenchmark = selectedRow ? data.valueBenchmarks?.[selectedRow.rank - 1] : undefined
  const selectedSearch =
    data.candidateSearchByRank?.[selectedRow?.rank ?? 0] ?? data.candidateSearch
  const selectedImpactTone = comparisonImpactTone(
    data.valueBenchmarks?.[Math.max(selectedRow?.rank ?? 1, 1) - 1],
    Boolean(data.snapshot?.stale),
  )
  const hasComparisonMethodDetails = Boolean(
    selectedRow &&
    selectedRow.rank > 0 &&
    !data.snapshot?.stale &&
    (onComparisonDetailsOpen || comparisonEquipmentControl),
  )
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
      return disc ? [[disc.slot, disc] as const] : []
    }),
  )
  const baselineDiscIds = data.baseline.discIds
  const baselineHasCompleteDiscs =
    baselineDiscIds?.length === 6 &&
    new Set(baselineDiscIds).size === 6 &&
    baselineDiscs.length === 6 &&
    new Set(baselineDiscs.map((disc) => disc.slot)).size === 6 &&
    baselineDiscs.every((disc) => disc.slot >= 1 && disc.slot <= 6)
  const baselineDeclared =
    data.baselineAvailability === 'unavailable'
      ? false
      : data.baselineAvailability === 'available'
        ? true
        : data.baselineKind
          ? data.baselineKind !== 'none'
          : baselineHasCompleteDiscs
  const baselineAvailable = baselineDeclared && baselineHasCompleteDiscs
  const actualBaseline =
    baselineAvailable && (data.baselineKind ? data.baselineKind === 'actual' : baselineDeclared)
  const baselineLabel =
    data.baselineLabel ??
    (actualBaseline ? '当前装备' : baselineAvailable ? '比较方案' : '尚无比较基线')
  const baselineDisplay = !baselineAvailable
    ? '尚无比较基线'
    : data.baselineKind === 'saved'
      ? '已保存方案'
      : data.baselineKind === 'candidate'
        ? '方案 1'
        : actualBaseline
          ? '当前装备'
          : baselineLabel.length > 18
            ? '比较方案'
            : baselineLabel
  useStateTransitionMotion({
    scope: resultRef,
    stateKey: `${selectedRow?.rank ?? 0}:${selectedRow?.discIds?.join('|') ?? ''}`,
    includeScope: true,
    enabled: !reanalyzing,
    transition: 'result',
  })
  const reanalyze = async () => {
    if (!onReanalyzeWarehouse || reanalyzing) return
    const generation = ++reanalyzeGeneration.current
    setReanalyzing(true)
    setReanalyzeMessage('正在重新搭配当前仓库…')
    try {
      await onReanalyzeWarehouse()
      if (generation !== reanalyzeGeneration.current) return
      setReanalyzeMessage('搭配完成，方案已刷新。')
    } catch (error) {
      if (generation !== reanalyzeGeneration.current) return
      if (error instanceof Error && error.name === 'AbortError') {
        setReanalyzeMessage(null)
        return
      }
      setReanalyzeMessage(playerErrorMessage(error, '重新搭配失败，请稍后重试。'))
    } finally {
      if (generation === reanalyzeGeneration.current) setReanalyzing(false)
    }
  }

  if (!data.candidates.length && !baselineAvailable) {
    return (
      <section className="top10 top10-empty" aria-labelledby="top10-title">
        <header className="page-heading compact comparison-heading">
          <div className="comparison-heading__identity">
            <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
            <div className="comparison-heading__text">
              <h1 id="top10-title">暂时没有匹配方案</h1>
              <p>
                {data.agentName}
                暂时没有完整方案。未记录当前装备，可从仓库搭配方案。
              </p>
            </div>
          </div>
          <div className="comparison-heading__actions">
            {comparisonScenarioControl}
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
          </div>
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
          <div className="comparison-heading__identity">
            <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
            <div className="comparison-heading__text">
              <h1 id="top10-title">{baselineDisplay}</h1>
              <p>这份方案已配齐 6 张驱动盘，暂时没有其他匹配方案。</p>
            </div>
          </div>
          <div className="comparison-heading__actions">
            {comparisonScenarioControl}
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
          </div>
        </header>

        <div className="top10-layout comparison-workbench">
          <aside className="comparison-candidates" aria-label={baselineDisplay}>
            <div className="comparison-baseline">
              <span>{baselineDisplay}</span>
              <strong>
                <SetSummary text={data.baseline.sets} />
              </strong>
              {/^(?:\d+)(?:\.\d+)?$/.test(data.baseline.effective) ? (
                <small>{data.baseline.effective} 有效词条</small>
              ) : null}
            </div>
            <p className="comparison-empty-candidates" role="status">
              可重新搭配，查找其他搭配。
            </p>
          </aside>

          <section className="comparison-detail" aria-label="方案明细">
            <header className="comparison-detail__summary">
              <div className="comparison-summary-intro">
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
                  <ComparisonDiscResult key={disc.id} disc={disc} baselineLabel={baselineDisplay} />
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
        <div className="comparison-heading__identity">
          <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
          <div className="comparison-heading__text">
            <h1 id="top10-title">方案比较</h1>
            <p>比较驱动盘搭配和属性，选择适合的方案保存。</p>
            {!actualBaseline && !baselineAvailable ? (
              <p className="comparison-heading__subnote">
                尚无完整六盘比较基准，可先查看仓库方案。
              </p>
            ) : null}
          </div>
        </div>
        <div className="comparison-heading__actions">
          {comparisonScenarioControl}
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
        </div>
      </header>

      <div className="top10-layout comparison-workbench">
        <Top10CandidateNav
          data={data}
          conflictFreeOnly={conflictFreeOnly}
          setConflictFreeOnly={setConflictFreeOnly}
          selected={selected}
          selectedRow={selectedRow}
          visibleCandidates={visibleCandidates}
          baselineAvailable={baselineAvailable}
          baselineLabel={baselineLabel}
          baselineDisplay={baselineDisplay}
          onSelectCandidatePlan={onSelectCandidatePlan}
          setSelected={setSelected}
        />

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
                <span className="comparison-main-stat-diff">
                  主词条：{selectedRow.mainStatDifferences.join('；')}
                </span>
              ) : null}
              {!data.snapshot?.stale &&
              (selectedSearch?.rankingMethod === 'prepared_anomaly_settlement' ||
                (selectedBenchmark &&
                  (selectedBenchmark.coverage.domain === 'fixed_event_direct_damage' ||
                    benchmarkOverallReason(selectedBenchmark)))) ? (
                <span className="comparison-summary-intro__note">
                  {selectedSearch?.rankingMethod === 'prepared_anomaly_settlement'
                    ? '同条件下先比较单次异常伤害；伤害相同时参考推荐套装。'
                    : benchmarkScopeNote(selectedBenchmark)}
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
              {hasComparisonMethodDetails ? (
                <ExplanationPopover
                  key={selectedRow?.rank}
                  label="方案设置"
                  title="方案设置"
                  className="comparison-method-popover"
                  onOpenChange={(open) => {
                    if (open && selectedRow) onComparisonDetailsOpen?.(selectedRow.rank)
                  }}
                >
                  <div className="comparison-method-popover__content">
                    {selectedRow && selectedRow.rank > 0 ? comparisonEquipmentControl : null}
                  </div>
                </ExplanationPopover>
              ) : null}
            </div>
            <dl>
              {baselineAvailable ? (
                <>
                  <div>
                    <dt>相比{baselineDisplay}</dt>
                    <dd data-impact-tone={selectedImpactTone}>
                      {benchmarkLabel(selectedBenchmark, Boolean(data.snapshot?.stale))}
                    </dd>
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
                {data.snapshot.staleReason === 'session_unavailable'
                  ? '本次搭配会话已结束，重新搭配后即可保存。'
                  : '装备已更新，重新搭配后即可保存。'}
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
                selectedRow.rank <= 0
              }
              onClick={save}
            >
              {saving
                ? '正在保存…'
                : selectedRow?.rank === 0 && data.currentLoadout
                  ? '保留当前装备'
                  : (selectedRow?.rank ?? 1) <= 0
                    ? '已保存方案'
                    : '保存为养成方案'}
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
          {saveMessage?.key ===
          `${saveScope}:${selectedRow?.rank ?? 0}:${selectedRow?.discIds?.join('|') ?? ''}` ? (
            <p className="development-save-success" role="status" aria-live="polite">
              {saveMessage.message}
              {saveMessage.savedPlanUrl ? (
                <a href={saveMessage.savedPlanUrl}>查看已保存方案</a>
              ) : null}
            </p>
          ) : null}

          <section className="comparison-evidence" aria-labelledby="comparison-discs-title">
            <div className="comparison-disc-strip">
              {selectedDiscs?.map((disc) => (
                <ComparisonDiscResult
                  key={disc.id}
                  disc={disc}
                  baseline={baselineAvailable ? baselineBySlot.get(disc.slot) : undefined}
                  baselineLabel={baselineDisplay}
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

export function Top10(props: Parameters<typeof Top10Content>[0]) {
  return (
    <Top10Content key={`${props.data.panelScopeKey ?? ''}:${props.data.agentName}`} {...props} />
  )
}
