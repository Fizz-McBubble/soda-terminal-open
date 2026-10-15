import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { registerScannerDiagnosticReceiptCases } from './ScannerDiagnosticFeedback.testCases'
import { registerScannerDiagnosticGuidanceCases } from './ScannerDiagnosticFeedback.guidance.testCases'
import { sanitizeScanDiagnostic } from '../scanner/diagnostics'
import { scannerDiagnosticGuidance } from './scannerDiagnosticGuidance'
import { readLastScanDiagnostic, saveLastScanDiagnostic } from '../scanner/scanFeedback'
import { readySnapshot } from '../scanner/runtime.testFixture'
// jsdom does not implement the native Popover API. The browser regression covers
// its actual positioning, dismissal and unchanged page geometry.
vi.mock('../components/ExplanationPopover', () => ({
  ExplanationPopover: ({
    label,
    children,
  }: {
    label: string
    children: import('react').ReactNode
  }) => (
    <details>
      <summary>{label}</summary>
      {children}
    </details>
  ),
}))
const makeReport = () =>
  sanitizeScanDiagnostic({
    schema: 1,
    reportId: crypto.randomUUID(),
    release: 'test',
    outcome: 'failed',
    code: 'panel_capture_timeout',
    stage: 'capture',
    counts: { processed: 4, total: null },
  })!
it('allows explicit feedback before a failure is recognized and keeps the entry across steps', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const view = render(<ScannerDiagnosticFeedback report={null} snapshot={readySnapshot} compact />)
  const entry = screen.getByRole('region', { name: '扫描诊断' })
  expect(screen.getByRole('button', { name: '反馈当前状态' })).toBeEnabled()
  view.rerender(
    <ScannerDiagnosticFeedback
      report={null}
      snapshot={{ ...readySnapshot, state: 'scanning' }}
      compact
    />,
  )
  expect(screen.getByRole('region', { name: '扫描诊断' })).toBe(entry)
  view.rerender(
    <ScannerDiagnosticFeedback
      report={null}
      snapshot={{ ...readySnapshot, state: 'completed' }}
      compact
    />,
  )
  expect(screen.getByRole('region', { name: '扫描诊断' })).toBe(entry)
  expect(fetcher).not.toHaveBeenCalled()
})
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('keeps compact empty and recorded diagnostics in the same two-layer footer', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const view = render(<ScannerDiagnosticFeedback report={null} compact />)
  const entry = screen.getByRole('region', { name: '扫描诊断' })
  expect(entry.children).toHaveLength(2)
  expect(entry.children[0]).toHaveClass('scanner-diagnostic-entry__heading')
  expect(entry.children[1]).toHaveClass('scanner-diagnostic-entry__status')
  expect(entry.children[1]).toHaveTextContent('暂无扫描问题记录。')
  expect(entry.querySelector('svg')).toHaveAttribute('width', '18')
  expect(screen.getByText('查看诊断')).toBeInTheDocument()
  view.rerender(<ScannerDiagnosticFeedback report={makeReport()} compact />)
  expect(entry.children).toHaveLength(2)
  expect(entry.children[1]).toHaveTextContent('未能及时读取')
  expect(view.container.querySelector('pre')).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('查看诊断'))
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeVisible()
})
it('shows only the product version and keeps internal versions out of the summary', () => {
  const report = makeReport()
  const view = render(
    <ScannerDiagnosticFeedback
      report={{ ...report, versions: { installer: '1.0.10', helper: '2.3.12' } }}
    />,
  )
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText('画面扫描 v1.0.10')).toBeVisible()
  expect(view.container).not.toHaveTextContent('2.3.12')
  view.rerender(
    <ScannerDiagnosticFeedback report={{ ...report, versions: { helper: '2.3.11' } }} />,
  )
  expect(view.container).not.toHaveTextContent('2.3.11')
  expect(view.container).not.toHaveTextContent('v1.0.10')
})
it('keeps workspace errors in the existing diagnostic status without sending private text', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: '2bb3e219-8526-4157-a687-3cda97f3c900',
        receivedAt: '2026-10-12T00:00:00Z',
      }),
      { status: 200 },
    ),
  )
  vi.stubGlobal('fetch', fetcher)
  const report = { ...makeReport(), code: 'scanner_workspace_failed' }
  render(
    <ScannerDiagnosticFeedback
      report={report}
      workspaceMessage="合成账户操作失败"
      workspaceMessageRole="alert"
      compact
    />,
  )
  const entry = screen.getByRole('region', { name: '扫描诊断' })
  expect(entry.children).toHaveLength(2)
  expect(entry.children[1]).toBe(screen.getByRole('alert'))
  expect(entry.children[1]).toHaveTextContent('合成账户操作失败')
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).code).toBe('scanner_workspace_failed')
  expect(fetcher.mock.calls[0]![1].body).not.toContain('合成账户')
})
it('copies, downloads and restores the acknowledged ID after a conflict retry', async () => {
  const report = makeReport()
  saveLastScanDiagnostic(report)
  let receivedId = ''
  const fetcher = vi.fn().mockImplementation((_url, init) => {
    const outgoing = JSON.parse(init.body)
    if (fetcher.mock.calls.length === 1)
      return Promise.resolve(new Response('conflict', { status: 409 }))
    receivedId = outgoing.reportId
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: receivedId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  })
  vi.stubGlobal('fetch', fetcher)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const createObjectURL = vi.fn().mockReturnValue('blob:diagnostic')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    filename = this.download
  })
  const { unmount } = render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  fireEvent.click(screen.getByText('查看诊断信息'))
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({ ...report, reportId: receivedId })
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(filename).toBe(`soda-scan-diagnostic-${receivedId}.json`)
  const downloaded = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(createObjectURL.mock.calls[0][0])
  })
  expect(JSON.parse(downloaded).reportId).toBe(receivedId)
  expect(readLastScanDiagnostic()).toEqual({ ...report, reportId: receivedId })
  expect(receivedId).not.toBe(report.reportId)
  expect(fetcher).toHaveBeenCalledTimes(2)
  unmount()
  const restored = readLastScanDiagnostic()!
  const helpCard = render(<ScannerDiagnosticFeedback report={restored} />)
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(receivedId)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
  expect(JSON.parse(writeText.mock.calls[1][0])).toEqual(restored)
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(filename).toBe(`soda-scan-diagnostic-${receivedId}.json`)
  expect(fetcher).toHaveBeenCalledTimes(2)
  helpCard.unmount()
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(receivedId)).toBeVisible()
})

it('keeps submission explicit, disables duplicate pending clicks, and shows only a matching receipt', async () => {
  const report = makeReport()
  let resolve!: (response: Response) => void
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeVisible()
  expect(screen.getByText(/不含账户和驱动盘资料/)).toBeVisible()
  expect(screen.getByText(/未能及时读取/)).not.toBeVisible()
  expect(screen.getByText(/保留 30 天/)).not.toBeVisible()
  expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制诊断' })).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  fireEvent.click(screen.getByRole('button', { name: '发送中…' }))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '发送中…' })).toBeDisabled()
  resolve(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-07T00:00:00Z',
      }),
    ),
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  expect(screen.getByText(report.reportId)).not.toBeVisible()
  expect(screen.getByText('回执编号')).not.toBeVisible()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(report.reportId)).toBeVisible()
})
it('retains report and copy/download options after a network failure, then retries in-page', async () => {
  const report = makeReport()
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline private error'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  vi.stubGlobal('fetch', fetcher)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const createObjectURL = vi.fn().mockReturnValue('blob:diagnostic')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('发送失败'))
  expect(screen.getByRole('status')).not.toHaveTextContent('private')
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/已处理 4 张/)).toBeVisible()
  expect(screen.getByText(/未能及时读取/)).toBeVisible()
  expect(screen.getByText(/更新画面扫描后重试/)).toBeVisible()
  expect(screen.getByText(/保留 30 天/)).toBeVisible()
  expect(screen.queryByText(/未知|错误码|Cloudflare/)).not.toBeInTheDocument()
  expect(screen.queryByText(report.code)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(report)
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(createObjectURL).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostic')
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('ignores late receipt for an earlier failure while a newer report remains independently submit-ready', async () => {
  const first = makeReport()
  const next = makeReport()
  let resolve!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    ),
  )
  const { rerender } = render(<ScannerDiagnosticFeedback report={first} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  rerender(<ScannerDiagnosticFeedback report={next} />)
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  await act(async () => {
    resolve(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: first.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
  expect(screen.queryByText(next.reportId)).not.toBeInTheDocument()
})

it.each([
  [404, '反馈暂时无法发送，请稍后再试'],
  [409, '这份反馈已更新，请重新尝试'],
])(
  'preserves offline diagnosis and gives an actionable message for HTTP %s',
  async (status, message) => {
    const report = makeReport()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })))
    render(<ScannerDiagnosticFeedback report={report} />)
    fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message))
    fireEvent.click(screen.getByText('查看诊断信息'))
    expect(screen.getByRole('button', { name: '下载诊断' })).toBeEnabled()
    expect(screen.getByText(/未能及时读取/)).toBeVisible()
    expect(screen.queryByText(report.reportId)).not.toBeInTheDocument()
    expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
  },
)

it('matches review guidance to manual calibration and displays the affected count without requiring feedback', () => {
  const report = {
    ...makeReport(),
    code: 'scan_import_review_required',
    stage: 'import',
    counts: {
      processed: 12,
      total: 12,
      reviewRequired: 11,
      unresolvedSet: 11,
      unresolvedSubStat: 11,
      invalidValue: 0,
      otherReview: null,
    },
  }
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/对照盘面手动校准，再确认导入/)).toBeVisible()
  expect(screen.getByText('需校准 11 张')).toBeVisible()
  expect(screen.getByText(/导入检查已保护性暂停/)).toBeVisible()
  expect(screen.getByText(/无需先发送反馈/)).toBeVisible()
  expect(screen.getByText('套装名称未确认：11 张')).toBeVisible()
  expect(screen.getByText('副词条信息不完整：11 张')).toBeVisible()
  expect(screen.getByText(/分类数量不相加/)).toBeVisible()
  expect(screen.queryByText(/词条或等级校验未通过：/)).not.toBeInTheDocument()
  expect(screen.queryByText(/其他检查问题：/)).not.toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
})

it('restores protective review details from local history without automatically sending them', () => {
  const report = sanitizeScanDiagnostic({
    ...makeReport(),
    code: 'scan_import_review_required',
    stage: 'import',
    counts: { reviewRequired: 1, invalidValue: 1 },
  })!
  saveLastScanDiagnostic(report)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={null} compact />)
  expect(screen.getByText(/上次：导入检查已保护性暂停/)).toBeVisible()
  fireEvent.click(screen.getByText('查看诊断'))
  expect(screen.getByText('词条或等级校验未通过：1 张')).toBeVisible()
  expect(screen.queryByText(/分类数量不相加/)).not.toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not suggest accepting an incomplete batch or force a particular supported resolution', () => {
  expect(
    scannerDiagnosticGuidance({ ...makeReport(), code: 'direct_fork_partial' }).nextAction,
  ).toContain('暂不能更新仓库')
  const geometry = scannerDiagnosticGuidance({
    ...makeReport(),
    code: 'ppocrv6_detail_geometry_incompatible',
  })
  expect(geometry.nextAction).toContain('16:9')
  expect(geometry.nextAction).not.toContain('1920')
})

it('keeps unknown failures neutral and omits unknown metadata', () => {
  const report = sanitizeScanDiagnostic({
    ...makeReport(),
    code: 'unknown',
    stage: 'unknown',
    counts: {},
  })!
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/暂时无法确定原因/)).toBeVisible()
  expect(screen.getByLabelText('本次扫描概况')).toBeEmptyDOMElement()
  expect(screen.queryByText(/未知|权限|未打开|错误码/)).not.toBeInTheDocument()
  expect(document.querySelector('pre')).toBeNull()
})

it('explains duplicate protection, preserves its diagnosis, and waits for explicit submission', () => {
  const report = sanitizeScanDiagnostic({
    ...makeReport(),
    code: 'duplicate_guard',
    stage: 'ocr',
    counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
    evidence: { itemIndex: 508, targetVerificationKind: 'ChangedText' },
  })!
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/将相同属性判断为重复/)).toBeVisible()
  expect(screen.getByText(/更新画面扫描后重试/)).toBeVisible()
  expect(screen.queryByText(/权限|未能及时读取/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  saveLastScanDiagnostic(report)
  expect(readLastScanDiagnostic()?.evidence).toEqual(report.evidence)
})

it('collapses details when a new report arrives and hides old local messages', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  const { rerender } = render(<ScannerDiagnosticFeedback report={makeReport()} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(screen.getByText('诊断已复制。')).toBeVisible())
  rerender(<ScannerDiagnosticFeedback report={makeReport()} />)
  expect(screen.getByText(/未能及时读取/)).not.toBeVisible()
  expect(screen.queryByText('诊断已复制。')).not.toBeInTheDocument()
})

registerScannerDiagnosticReceiptCases()
registerScannerDiagnosticGuidanceCases(makeReport)
