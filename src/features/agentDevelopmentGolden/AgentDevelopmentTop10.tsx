import { useMemo, useRef, useState } from 'react'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { BackNavigation } from '../../components/BackNavigation'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { DevelopmentDiscCard } from './DevelopmentDiscCard'
import { Top10StatTable } from './Top10StatTable'
import { SetSummary, Top10CandidateNav } from './Top10CandidateNav'
import type { AgentDevelopmentGoldenProps, GoldenTop10Data, JourneyScenario } from './types'
import {
  benchmarkLabel,
  benchmarkOverallReason,
  benchmarkScopeNote,
  candidateSearchLabel,
} from './top10Labels'
import { staticPanelTargetDisplay } from '../../gameDataPacks/targetPanelSemantics'

function PanelReferenceConditions({ data }: { data: GoldenTop10Data }) {
  if (data.statPresentation !== 'static_panel') return null
  const notes = new Map<string, Set<string>>()
  for (const stat of data.allStats) {
    if (!staticPanelTargetDisplay(stat.target)) continue
    for (const condition of data.targetConditionsByLabel?.[stat.label] ?? []) {
      const text = condition.trim()
      if (!text) continue
      const labels = notes.get(text) ?? new Set<string>()
      labels.add(stat.label)
      notes.set(text, labels)
    }
  }
  if (!notes.size) return null
  return (
    <section aria-label="毕业推荐适用条件">
      <p>毕业推荐适用条件</p>
      <ul>
        {[...notes].map(([condition, labels]) => (
          <li key={condition}>
            {Array.from(labels).join('、')}：{condition}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Top10({
  back,
  scenario,
  data,
  onSavePlan,
  onSelectCandidatePlan,
  onReanalyzeWarehouse,
  comparisonScenarioControl,
}: {
  back: () => void
  scenario: JourneyScenario
  data: GoldenTop10Data
  onSavePlan?: AgentDevelopmentGoldenProps['onSavePlan']
  onSelectCandidatePlan?: AgentDevelopmentGoldenProps['onSelectCandidatePlan']
  onReanalyzeWarehouse?: AgentDevelopmentGoldenProps['onReanalyzeWarehouse']
  comparisonScenarioControl?: AgentDevelopmentGoldenProps['comparisonScenarioControl']
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

  const retainedCurrent = data.currentLoadout ?? data.currentPlan
  const selectedRow =
    selected === 0 && retainedCurrent && (!conflictFreeOnly || !retainedCurrent.conflict)
      ? retainedCurrent
      : selected === -1 && data.currentPlan && (!conflictFreeOnly || !data.currentPlan.conflict)
        ? data.currentPlan
        : (visibleCandidates.find((row) => row.rank === selected) ?? visibleCandidates[0])
  const selectedBenchmark = selectedRow ? data.valueBenchmarks?.[selectedRow.rank - 1] : undefined
  const selectedSearch =
    data.candidateSearchByRank?.[selectedRow?.rank ?? 0] ?? data.candidateSearch
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
          <div className="comparison-heading__identity">
            <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
            <div className="comparison-heading__text">
              <h1 id="top10-title">暂时没有匹配方案</h1>
              <p>{data.agentName}暂时没有完整方案。未记录游戏当前实装，可从仓库搭配方案。</p>
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
              <small>{data.baseline.effective} 有效词条</small>
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
                <ExplanationPopover
                  label="排序与计算限制"
                  title="方案排序与计算限制"
                  className="comparison-method-popover"
                >
                  <p>{candidateSearchLabel(selectedSearch)}</p>
                  <PanelReferenceConditions data={data} />
                </ExplanationPopover>
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
        <div className="comparison-heading__identity">
          <BackNavigation label="返回养成" className="back-navigation--heading" onClick={back} />
          <div className="comparison-heading__text">
            <h1 id="top10-title">方案比较</h1>
            <p>比较驱动盘搭配和属性，选择适合的方案保存。</p>
            {!actualBaseline && !baselineAvailable ? (
              <p className="comparison-heading__subnote">暂无当前实装，可先查看仓库方案。</p>
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
                    ? '按同条件单次异常结算排序，不含循环收益。'
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
              <ExplanationPopover
                label="排序与计算限制"
                title="方案排序与计算限制"
                className="comparison-method-popover"
              >
                <div className="comparison-method-popover__content">
                  <p>{candidateSearchLabel(selectedSearch)}</p>
                  {selectedBenchmark?.status !== 'supported' && selectedBenchmark ? (
                    <p>当前输出对比受限或未支持，未假设 0% 收益。</p>
                  ) : null}
                  <PanelReferenceConditions data={data} />
                </div>
              </ExplanationPopover>
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
                selectedRow.rank <= 0
              }
              onClick={save}
            >
              {saving
                ? '正在保存…'
                : selectedRow?.rank === 0 && data.currentLoadout
                  ? '保留当前实装'
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
