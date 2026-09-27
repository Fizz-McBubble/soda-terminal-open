import { useEffect } from 'react'
import { createReadonlyReviewFixture } from './reviewFixture'

type ReviewFilter =
  | 'needs_review'
  | 'missing_set'
  | 'missing_main_stat'
  | 'missing_sub_stat'
  | 'multiple'

export default function ReadonlyReviewFixturePanel({
  filter,
  sequence,
  onChange,
}: {
  filter: string
  sequence: number
  onChange: (filter: ReviewFilter, sequence: number) => void
}) {
  const fixture = createReadonlyReviewFixture()
  const effectiveFilter: ReviewFilter = [
    'needs_review',
    'missing_set',
    'missing_main_stat',
    'missing_sub_stat',
    'multiple',
  ].includes(filter)
    ? (filter as ReviewFilter)
    : 'needs_review'
  const entries = fixture.entries.filter((entry) => {
    if (effectiveFilter === 'missing_set') return entry.reason.includes('缺套装')
    if (effectiveFilter === 'missing_main_stat') return entry.reason.includes('缺主词条')
    if (effectiveFilter === 'missing_sub_stat') return entry.reason.includes('缺副词条')
    if (effectiveFilter === 'multiple') return entry.reason.includes('多字段')
    return true
  })
  const active = entries.find((entry) => entry.sequence === sequence) ?? entries[0]!
  useEffect(() => {
    if (effectiveFilter !== filter || active.sequence !== sequence)
      onChange(effectiveFilter, active.sequence)
  }, [active.sequence, effectiveFilter, filter, onChange, sequence])

  return (
    <div
      className="scan-staging-panel readonly-review-fixture"
      data-testid="readonly-review-fixture"
    >
      <p className="preflight-card preflight-card--ready">
        <strong>脱敏只读复验数据</strong>：仅供开发/测试 UI/UX
        验收；不会载入、写入或修改浏览器暂存。
      </p>
      <p>
        当前活动批次 <strong>{fixture.batchId}</strong> · 数据 zzz-drive-disc-fixture · 识别
        review-fixture
      </p>
      <dl className="count-comparison scan-staging-summary">
        <div>
          <dt>原始条目</dt>
          <dd>343 / 343</dd>
        </div>
        <div>
          <dt>可预检</dt>
          <dd>272</dd>
        </div>
        <div>
          <dt>待复核条目</dt>
          <dd>71</dd>
        </div>
        <div>
          <dt>字段待确认</dt>
          <dd>73</dd>
        </div>
        <div>
          <dt>无效 / 重名 / 锁定未知</dt>
          <dd>0 / 0 / 0</dd>
        </div>
      </dl>
      <p role="status" aria-live="polite" className="muted-note">
        343 / 343 原始条目已保留 · 272 可预检 · 71 条待复核 · 73 个字段待确认 · 54 缺套装 / 13
        缺副词条 / 6 缺主词条 / 2 多字段 · 未导入
      </p>
      <div className="scan-review-workspace">
        <nav aria-label="待复核条目" className="scan-review-queue">
          {[
            ['needs_review', '全部待复核（71）'],
            ['missing_set', '缺套装（54）'],
            ['missing_main_stat', '缺主词条（6）'],
            ['missing_sub_stat', '缺副词条（13）'],
            ['multiple', '涉及多字段（2）'],
          ].map(([nextFilter, label]) => (
            <button
              key={nextFilter}
              className="button button--secondary"
              type="button"
              onClick={() => {
                const nextEntries = fixture.entries.filter((entry) => {
                  if (nextFilter === 'missing_set') return entry.reason.includes('缺套装')
                  if (nextFilter === 'missing_main_stat') return entry.reason.includes('缺主词条')
                  if (nextFilter === 'missing_sub_stat') return entry.reason.includes('缺副词条')
                  if (nextFilter === 'multiple') return entry.reason.includes('多字段')
                  return true
                })
                onChange(nextFilter as ReviewFilter, nextEntries[0]!.sequence)
              }}
            >
              {label}
            </button>
          ))}
          {entries.map((entry) => (
            <button
              key={entry.sequence}
              type="button"
              aria-current={active.sequence === entry.sequence ? 'page' : undefined}
              onClick={() => onChange(effectiveFilter, entry.sequence)}
            >
              第 {entry.sequence} 条 · {entry.reason}
            </button>
          ))}
        </nav>
        <article className="scan-review-item" aria-labelledby="readonly-review-title">
          <h3 id="readonly-review-title">第 {active.sequence} 条 / 343 · 待复核</h3>
          <div className="scan-review-evidence">
            <img alt={`第 ${active.sequence} 条详情原始截图（脱敏复验）`} src={active.detailPath} />
            <img alt={`第 ${active.sequence} 条卡面原始截图（脱敏复验）`} src={active.cardPath} />
          </div>
          <p>
            OCR 原文：{active.ocr} · 来源：{active.source} · 置信：{active.confidence} · 规则：
            {active.rule}
          </p>
          <p className="danger-note">{active.reason}：需要人工确认；此页面不把候选视为事实。</p>
          <p className="muted-note">
            只读复验：确认候选、手动修正、保持待复核、重新预检、确认导入均已禁用，不会产生草稿或导入。
          </p>
          <button className="button button--secondary" disabled type="button">
            确认当前候选（只读）
          </button>
          <button className="button button--secondary" disabled type="button">
            手动修正（只读）
          </button>
          <button className="button button--secondary" disabled type="button">
            保持待复核，下一条（只读）
          </button>
          <button className="button button--secondary" disabled type="button">
            显式重新预检（只读）
          </button>
        </article>
      </div>
      <p className="muted-note">
        人工复核完成不等于已导入；真实批次仍须完成重新预检 343 ready / 0 guard 和独立确认。
      </p>
    </div>
  )
}
